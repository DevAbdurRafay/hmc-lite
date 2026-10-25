from typing import List, Optional
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models import User
from app.schemas.org import (
    CompanySettingsResponse, CompanySettingsUpdateRequest,
    DepartmentCreate, DepartmentResponse,
    DesignationCreate, DesignationResponse,
    LeaveTypeCreate, LeaveTypeResponse,
    HolidayCreate, HolidayResponse
)
from app.services.org_service import OrgService

router = APIRouter(prefix="/org", tags=["Organization Setup"])


@router.get("/settings", response_model=CompanySettingsResponse)
def get_company_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """View company operating settings (office hours, location, radius, weekends)."""
    return OrgService.get_settings(db)


@router.put("/settings", response_model=CompanySettingsResponse)
def update_company_settings(
    data: CompanySettingsUpdateRequest,
    request: Request,
    admin_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    """Admin only: Update company operating rules and office geofence."""
    client_ip = request.client.host if request.client else None
    return OrgService.update_settings(db, data, actor=admin_user, client_ip=client_ip)


# Departments
@router.get("/departments", response_model=List[DepartmentResponse])
def list_departments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all company departments."""
    return OrgService.list_departments(db)


@router.post("/departments", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    data: DepartmentCreate,
    request: Request,
    admin_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    """Admin only: Create a new department."""
    client_ip = request.client.host if request.client else None
    return OrgService.create_department(db, data, actor=admin_user, client_ip=client_ip)


# Designations
@router.get("/designations", response_model=List[DesignationResponse])
def list_designations(
    department_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all company designations, optionally filtered by department."""
    desigs = OrgService.list_designations(db, department_id=department_id)
    return [
        DesignationResponse(
            id=d.id,
            title=d.title,
            department_id=d.department_id,
            description=d.description,
            department_name=d.department.name if d.department else None
        ) for d in desigs
    ]


@router.post("/designations", response_model=DesignationResponse, status_code=status.HTTP_201_CREATED)
def create_designation(
    data: DesignationCreate,
    request: Request,
    admin_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    """Admin only: Create a new designation within a department."""
    client_ip = request.client.host if request.client else None
    d = OrgService.create_designation(db, data, actor=admin_user, client_ip=client_ip)
    return DesignationResponse(
        id=d.id,
        title=d.title,
        department_id=d.department_id,
        description=d.description,
        department_name=d.department.name if d.department else None
    )


# Leave Types
@router.get("/leave-types", response_model=List[LeaveTypeResponse])
def list_leave_types(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all leave types and yearly quotas."""
    return OrgService.list_leave_types(db)


@router.post("/leave-types", response_model=LeaveTypeResponse, status_code=status.HTTP_201_CREATED)
def create_leave_type(
    data: LeaveTypeCreate,
    request: Request,
    admin_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    """Admin only: Create a leave type and annual quota."""
    client_ip = request.client.host if request.client else None
    return OrgService.create_leave_type(db, data, actor=admin_user, client_ip=client_ip)


# Holidays
@router.get("/holidays", response_model=List[HolidayResponse])
def list_holidays(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all official company holidays."""
    return OrgService.list_holidays(db)


@router.post("/holidays", response_model=HolidayResponse, status_code=status.HTTP_201_CREATED)
def create_holiday(
    data: HolidayCreate,
    request: Request,
    admin_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    """Admin only: Register an official public holiday."""
    client_ip = request.client.host if request.client else None
    return OrgService.create_holiday(db, data, actor=admin_user, client_ip=client_ip)
