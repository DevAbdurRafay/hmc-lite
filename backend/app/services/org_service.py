from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import (
    CompanySettings, Department, Designation, LeaveType, Holiday, User
)
from app.schemas.org import (
    CompanySettingsUpdateRequest, DepartmentCreate, DesignationCreate,
    LeaveTypeCreate, HolidayCreate
)
from app.services.audit_service import AuditService


class OrgService:
    @staticmethod
    def get_settings(db: Session) -> CompanySettings:
        settings = db.query(CompanySettings).first()
        if not settings:
            settings = CompanySettings(
                company_name="Saylani Tech Solutions",
                office_start_time="09:00",
                grace_period_minutes=15,
                half_day_threshold_hours=5.0,
                weekend_days="5,6",  # Saturday, Sunday
                office_latitude=24.8607,
                office_longitude=67.0011,
                office_radius_meters=150.0,
                late_penalty_enabled=False,
                is_configured=False,
            )
            db.add(settings)
            db.commit()
            db.refresh(settings)
        return settings

    @staticmethod
    def update_settings(
        db: Session, update_data: CompanySettingsUpdateRequest, actor: User, client_ip: Optional[str] = None
    ) -> CompanySettings:
        settings = OrgService.get_settings(db)
        before_dict = {
            "company_name": settings.company_name,
            "office_start_time": settings.office_start_time,
            "grace_period_minutes": settings.grace_period_minutes,
            "office_latitude": settings.office_latitude,
            "office_longitude": settings.office_longitude,
            "office_radius_meters": settings.office_radius_meters,
            "late_penalty_enabled": settings.late_penalty_enabled,
        }

        update_dict = update_data.model_dump(exclude_unset=True)
        for key, val in update_dict.items():
            setattr(settings, key, val)

        settings.is_configured = True
        db.commit()
        db.refresh(settings)

        AuditService.log(
            db, action="UPDATE", entity="SETTINGS", entity_id=str(settings.id),
            actor=actor, before_obj=before_dict, after_obj=update_dict, client_ip=client_ip
        )
        return settings

    # Departments
    @staticmethod
    def list_departments(db: Session) -> List[Department]:
        return db.query(Department).order_by(Department.name.asc()).all()

    @staticmethod
    def create_department(db: Session, data: DepartmentCreate, actor: User, client_ip: Optional[str] = None) -> Department:
        existing = db.query(Department).filter(
            (Department.name.ilike(data.name)) | (Department.code.ilike(data.code))
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "DUPLICATE_DEPARTMENT", "message": "Department name or code already exists"}
            )
        dept = Department(name=data.name.strip(), code=data.code.strip().upper(), description=data.description)
        db.add(dept)
        db.commit()
        db.refresh(dept)

        AuditService.log(
            db, action="CREATE", entity="DEPARTMENT", entity_id=str(dept.id),
            actor=actor, after_obj={"name": dept.name, "code": dept.code}, client_ip=client_ip
        )
        return dept

    # Designations
    @staticmethod
    def list_designations(db: Session, department_id: Optional[int] = None) -> List[Designation]:
        query = db.query(Designation)
        if department_id:
            query = query.filter(Designation.department_id == department_id)
        return query.order_by(Designation.title.asc()).all()

    @staticmethod
    def create_designation(db: Session, data: DesignationCreate, actor: User, client_ip: Optional[str] = None) -> Designation:
        dept = db.query(Department).filter(Department.id == data.department_id).first()
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "DEPARTMENT_NOT_FOUND", "message": "Associated department does not exist"}
            )
        existing = db.query(Designation).filter(
            Designation.department_id == data.department_id,
            Designation.title.ilike(data.title.strip())
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "DUPLICATE_DESIGNATION", "message": "Designation title already exists in this department"}
            )
        desig = Designation(title=data.title.strip(), department_id=data.department_id, description=data.description)
        db.add(desig)
        db.commit()
        db.refresh(desig)

        AuditService.log(
            db, action="CREATE", entity="DESIGNATION", entity_id=str(desig.id),
            actor=actor, after_obj={"title": desig.title, "department_id": desig.department_id}, client_ip=client_ip
        )
        return desig

    # Leave Types
    @staticmethod
    def list_leave_types(db: Session) -> List[LeaveType]:
        return db.query(LeaveType).order_by(LeaveType.id.asc()).all()

    @staticmethod
    def create_leave_type(db: Session, data: LeaveTypeCreate, actor: User, client_ip: Optional[str] = None) -> LeaveType:
        existing = db.query(LeaveType).filter(
            (LeaveType.name.ilike(data.name.strip())) | (LeaveType.code.ilike(data.code.strip()))
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "DUPLICATE_LEAVE_TYPE", "message": "Leave type name or code already exists"}
            )
        lt = LeaveType(
            name=data.name.strip(),
            code=data.code.strip().upper(),
            yearly_quota=data.yearly_quota,
            is_unpaid=data.is_unpaid,
            description=data.description
        )
        db.add(lt)
        db.commit()
        db.refresh(lt)

        AuditService.log(
            db, action="CREATE", entity="LEAVE_TYPE", entity_id=str(lt.id),
            actor=actor, after_obj={"name": lt.name, "code": lt.code, "yearly_quota": lt.yearly_quota}, client_ip=client_ip
        )
        return lt

    # Holidays
    @staticmethod
    def list_holidays(db: Session) -> List[Holiday]:
        return db.query(Holiday).order_by(Holiday.date.asc()).all()

    @staticmethod
    def create_holiday(db: Session, data: HolidayCreate, actor: User, client_ip: Optional[str] = None) -> Holiday:
        existing = db.query(Holiday).filter(Holiday.date == data.date).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "DUPLICATE_HOLIDAY", "message": f"Holiday on {data.date} already exists"}
            )
        holiday = Holiday(name=data.name.strip(), date=data.date, is_recurring=data.is_recurring)
        db.add(holiday)
        db.commit()
        db.refresh(holiday)

        AuditService.log(
            db, action="CREATE", entity="HOLIDAY", entity_id=str(holiday.id),
            actor=actor, after_obj={"name": holiday.name, "date": str(holiday.date)}, client_ip=client_ip
        )
        return holiday
