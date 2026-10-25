from typing import List, Optional
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models import User
from app.schemas.auth import (
    LoginRequest, TokenResponse, ChangePasswordRequest, FirstRunSetupRequest,
    CreateHRRequest, UserResponse, ResetPasswordResponse
)
from app.schemas.common import MessageResponse
from app.services.auth_service import AuthService
from app.services.audit_service import AuditService

router = APIRouter(prefix="/auth", tags=["Authentication & Access"])


@router.get("/status")
def get_auth_status(db: Session = Depends(get_db)):
    """Check whether first-run setup is required."""
    is_first = AuthService.is_first_run(db)
    return {"setup_required": is_first}


@router.post("/setup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def first_run_setup(
    setup_data: FirstRunSetupRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """First-run setup: creates company profile and initial Admin account. Locks itself after Admin exists."""
    client_ip = request.client.host if request.client else None
    return AuthService.first_run_setup(db, setup_data, client_ip=client_ip)


@router.post("/login", response_model=TokenResponse)
def login(
    login_data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """Authenticate with email and password to receive JWT tokens."""
    client_ip = request.client.host if request.client else None
    return AuthService.login(db, login_data, client_ip=client_ip)


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    data: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change current password. Clears temporary password flag upon first sign-in."""
    client_ip = request.client.host if request.client else None
    return AuthService.change_password(db, current_user, data, client_ip=client_ip)


@router.get("/users", response_model=List[UserResponse])
def list_users(
    admin_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    """Admin only: List all user login accounts across the organization."""
    users = db.query(User).order_by(User.id.asc()).all()
    result = []
    for u in users:
        emp_id = u.employee.id if u.employee else None
        emp_name = u.employee.full_name if u.employee else ("Administrator" if u.role == "ADMIN" else ("HR Specialist" if u.role == "HR" else "Employee"))
        result.append(UserResponse(
            id=u.id,
            email=u.email,
            role=u.role,
            is_active=u.is_active,
            must_change_password=u.must_change_password,
            employee_id=emp_id,
            employee_name=emp_name,
            full_name=emp_name,
        ))
    return result


@router.post("/hr-users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@router.post("/users/hr", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@router.post("/create-hr", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_hr_user(
    data: CreateHRRequest,
    request: Request,
    admin_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    """Admin only: Create an HR Manager login."""
    client_ip = request.client.host if request.client else None
    hr_user = AuthService.create_hr_user(db, data, actor=admin_user, client_ip=client_ip)
    return UserResponse(
        id=hr_user.id,
        email=hr_user.email,
        role=hr_user.role,
        is_active=hr_user.is_active,
        must_change_password=hr_user.must_change_password,
        full_name=data.full_name or "HR Specialist",
    )


@router.post("/users/{user_id}/deactivate", response_model=UserResponse)
def deactivate_user(
    user_id: int,
    request: Request,
    admin_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    """Admin only: Deactivate a user login."""
    client_ip = request.client.host if request.client else None
    u = AuthService.set_user_active(db, user_id, False, actor=admin_user, client_ip=client_ip)
    return UserResponse(
        id=u.id,
        email=u.email,
        role=u.role,
        is_active=u.is_active,
        must_change_password=u.must_change_password,
    )


@router.post("/users/{user_id}/activate", response_model=UserResponse)
def activate_user(
    user_id: int,
    request: Request,
    admin_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    """Admin only: Activate a user login."""
    client_ip = request.client.host if request.client else None
    u = AuthService.set_user_active(db, user_id, True, actor=admin_user, client_ip=client_ip)
    return UserResponse(
        id=u.id,
        email=u.email,
        role=u.role,
        is_active=u.is_active,
        must_change_password=u.must_change_password,
    )


@router.patch("/users/{user_id}/toggle-active", response_model=UserResponse)
def toggle_user_active(
    user_id: int,
    request: Request,
    admin_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    """Admin only: Deactivate or reactivate any user account."""
    client_ip = request.client.host if request.client else None
    u = AuthService.toggle_user_active(db, user_id, actor=admin_user, client_ip=client_ip)
    return UserResponse(
        id=u.id,
        email=u.email,
        role=u.role,
        is_active=u.is_active,
        must_change_password=u.must_change_password,
    )


@router.post("/users/{user_id}/reset-password", response_model=ResetPasswordResponse)
def reset_password(
    user_id: int,
    request: Request,
    admin_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    """Admin only: Reset a user's password to a temporary password."""
    client_ip = request.client.host if request.client else None
    return AuthService.reset_password(db, user_id, actor=admin_user, client_ip=client_ip)


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke user session and record audit event."""
    client_ip = request.client.host if request.client else None
    current_user.token_version = (getattr(current_user, "token_version", 1) or 1) + 1
    db.commit()
    AuditService.log(
        db, action="LOGOUT", entity="SESSION", entity_id=str(current_user.id),
        actor=current_user, client_ip=client_ip
    )
    return MessageResponse(message="Signed out successfully", success=True)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info and employee linkage."""
    emp_id = current_user.employee.id if current_user.employee else None
    emp_name = current_user.employee.full_name if current_user.employee else None
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        must_change_password=current_user.must_change_password,
        employee_id=emp_id,
        employee_name=emp_name,
    )
