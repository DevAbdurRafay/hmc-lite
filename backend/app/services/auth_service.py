from typing import Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    create_refresh_token, generate_temporary_password
)
from app.models import User, CompanySettings, LeaveType
from app.schemas.auth import (
    LoginRequest, TokenResponse, ChangePasswordRequest, FirstRunSetupRequest,
    CreateHRRequest, ResetPasswordResponse
)
from app.services.audit_service import AuditService
from app.services.org_service import OrgService


class AuthService:
    @staticmethod
    def is_first_run(db: Session) -> bool:
        admin_count = db.query(User).filter(User.role == "ADMIN").count()
        return admin_count == 0

    @staticmethod
    def first_run_setup(db: Session, setup_data: FirstRunSetupRequest, client_ip: Optional[str] = None) -> TokenResponse:
        if not AuthService.is_first_run(db):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "SETUP_LOCKED", "message": "First-run setup has already been completed and is locked."}
            )

        # 1. Initialize or update company settings
        company_setting = db.query(CompanySettings).first()
        if not company_setting:
            company_setting = CompanySettings()
            db.add(company_setting)

        company_setting.company_name = setup_data.company_name
        company_setting.office_start_time = setup_data.office_start_time
        company_setting.grace_period_minutes = setup_data.grace_period_minutes
        company_setting.half_day_threshold_hours = setup_data.half_day_threshold_hours
        company_setting.weekend_days = setup_data.weekend_days
        company_setting.office_latitude = setup_data.office_latitude
        company_setting.office_longitude = setup_data.office_longitude
        company_setting.office_radius_meters = setup_data.office_radius_meters
        company_setting.is_configured = True

        # 2. Initialize default leave types if empty
        if db.query(LeaveType).count() == 0:
            defaults = [
                LeaveType(name="Annual Leave", code="ANNUAL", yearly_quota=14, is_unpaid=False),
                LeaveType(name="Sick Leave", code="SICK", yearly_quota=8, is_unpaid=False),
                LeaveType(name="Casual Leave", code="CASUAL", yearly_quota=10, is_unpaid=False),
                LeaveType(name="Unpaid Leave", code="UNPAID", yearly_quota=0, is_unpaid=True),
            ]
            db.add_all(defaults)

        # 3. Check uniqueness and Create Admin user
        admin_email_clean = setup_data.admin_email.strip().lower()
        if db.query(User).filter(User.email == admin_email_clean).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "EMAIL_EXISTS", "message": "This email or username is already in use. Please choose a unique name."}
            )

        admin_user = User(
            email=admin_email_clean,
            hashed_password=get_password_hash(setup_data.admin_password),
            role="ADMIN",
            is_active=True,
            must_change_password=False,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        AuditService.log(
            db, action="CREATE", entity="USER", entity_id=str(admin_user.id),
            actor=admin_user, after_obj={"email": admin_user.email, "role": "ADMIN"},
            client_ip=client_ip
        )

        access_token = create_access_token({
            "sub": str(admin_user.id),
            "role": admin_user.role,
            "email": admin_user.email,
            "token_version": getattr(admin_user, "token_version", 1) or 1
        })
        refresh_token = create_refresh_token({"sub": str(admin_user.id)})

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            role=admin_user.role,
            must_change_password=admin_user.must_change_password,
            email=admin_user.email,
            user_id=admin_user.id,
            employee_id=None,
            employee_name="System Administrator",
        )

    @staticmethod
    def login(db: Session, login_data: LoginRequest, client_ip: Optional[str] = None) -> TokenResponse:
        user = db.query(User).filter(User.email == login_data.email.strip().lower()).first()
        if not user or not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password"}
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "ACCOUNT_DEACTIVATED", "message": "This account has been deactivated. Contact Admin."}
            )

        access_token = create_access_token({
            "sub": str(user.id),
            "role": user.role,
            "email": user.email,
            "token_version": getattr(user, "token_version", 1) or 1
        })
        refresh_token = create_refresh_token({"sub": str(user.id)})

        emp_id = user.employee.id if user.employee else None
        emp_name = user.employee.full_name if user.employee else ("Admin" if user.role == "ADMIN" else "HR Manager")

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            role=user.role,
            must_change_password=user.must_change_password,
            email=user.email,
            user_id=user.id,
            employee_id=emp_id,
            employee_name=emp_name,
        )

    @staticmethod
    def change_password(db: Session, current_user: User, data: ChangePasswordRequest, client_ip: Optional[str] = None):
        if not verify_password(data.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "WRONG_PASSWORD", "message": "Current password is incorrect"}
            )
        current_user.hashed_password = get_password_hash(data.new_password)
        current_user.must_change_password = False
        current_user.token_version = (getattr(current_user, "token_version", 1) or 1) + 1
        db.commit()

        AuditService.log(
            db, action="UPDATE", entity="PASSWORD", entity_id=str(current_user.id),
            actor=current_user, client_ip=client_ip
        )
        return {"message": "Password changed successfully", "success": True}

    @staticmethod
    def create_hr_user(db: Session, data: CreateHRRequest, actor: User, client_ip: Optional[str] = None) -> User:
        email = data.email.strip().lower()
        if db.query(User).filter(User.email == email).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "EMAIL_EXISTS", "message": "A user with this email already exists"}
            )
        hr_user = User(
            email=email,
            hashed_password=get_password_hash(data.password),
            role="HR",
            is_active=True,
            must_change_password=False,
        )
        db.add(hr_user)
        db.commit()
        db.refresh(hr_user)

        AuditService.log(
            db, action="CREATE", entity="USER", entity_id=str(hr_user.id),
            actor=actor, after_obj={"email": hr_user.email, "role": "HR"},
            client_ip=client_ip
        )
        return hr_user

    @staticmethod
    def toggle_user_active(db: Session, user_id: int, actor: User, client_ip: Optional[str] = None) -> User:
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "USER_NOT_FOUND", "message": "Target user not found"}
            )
        if target_user.id == actor.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "SELF_DEACTIVATE", "message": "You cannot deactivate your own account"}
            )

        before_active = target_user.is_active
        target_user.is_active = not target_user.is_active
        db.commit()
        db.refresh(target_user)

        AuditService.log(
            db,
            action="DEACTIVATE" if not target_user.is_active else "ACTIVATE",
            entity="USER",
            entity_id=str(target_user.id),
            actor=actor,
            before_obj={"is_active": before_active},
            after_obj={"is_active": target_user.is_active},
            client_ip=client_ip
        )
        return target_user

    @staticmethod
    def set_user_active(db: Session, user_id: int, active: bool, actor: User, client_ip: Optional[str] = None) -> User:
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "USER_NOT_FOUND", "message": "Target user not found"}
            )
        if target_user.id == actor.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "SELF_DEACTIVATE", "message": "You cannot change your own active status"}
            )

        before_active = target_user.is_active
        target_user.is_active = active
        if not active:
            target_user.token_version = (getattr(target_user, "token_version", 1) or 1) + 1
        db.commit()
        db.refresh(target_user)

        AuditService.log(
            db,
            action="DEACTIVATE" if not active else "ACTIVATE",
            entity="USER",
            entity_id=str(target_user.id),
            actor=actor,
            before_obj={"is_active": before_active},
            after_obj={"is_active": target_user.is_active},
            client_ip=client_ip
        )
        return target_user

    @staticmethod
    def reset_password(db: Session, user_id: int, actor: User, client_ip: Optional[str] = None) -> ResetPasswordResponse:
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "USER_NOT_FOUND", "message": "Target user not found"}
            )

        temp_password = generate_temporary_password()
        target_user.hashed_password = get_password_hash(temp_password)
        target_user.must_change_password = True
        target_user.token_version = (getattr(target_user, "token_version", 1) or 1) + 1
        db.commit()

        AuditService.log(
            db, action="RESET", entity="PASSWORD", entity_id=str(target_user.id),
            actor=actor, client_ip=client_ip
        )

        return ResetPasswordResponse(
            user_id=target_user.id,
            email=target_user.email,
            temporary_password=temp_password,
            message="Password reset successfully. The user must change password upon next login."
        )
