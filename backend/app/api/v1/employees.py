from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, enforce_employee_scope
from app.models import User
from app.schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeSelfUpdate, EmployeeResponse,
    EmployeeRegistrationResponse, Employee360Response, CSVDryRunResponse
)
from app.schemas.common import PaginatedResponse
from app.services.employee_service import EmployeeService

router = APIRouter(prefix="/employees", tags=["Employee Management"])


@router.get("", response_model=PaginatedResponse[EmployeeResponse])
def list_employees(
    search: Optional[str] = None,
    department_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List employees with server-side search, filtering, and pagination. Admin/HR view all; Employee views own."""
    if current_user.role == "EMPLOYEE":
        if not current_user.employee:
            return PaginatedResponse(items=[], total=0, page=1, page_size=page_size, total_pages=0)
        emp_resp = EmployeeService.get_employee(db, current_user.employee.id)
        return PaginatedResponse(items=[emp_resp], total=1, page=1, page_size=page_size, total_pages=1)

    return EmployeeService.list_employees(
        db, search=search, department_id=department_id, status_filter=status_filter,
        page=page, page_size=page_size
    )


@router.post("", response_model=EmployeeRegistrationResponse, status_code=status.HTTP_201_CREATED)
def register_employee(
    data: EmployeeCreate,
    request: Request,
    hr_actor: User = Depends(require_roles(["HR", "ADMIN"])),
    db: Session = Depends(get_db)
):
    """HR/Admin: Register a new employee. Generates login and temporary password."""
    client_ip = request.client.host if request.client else None
    return EmployeeService.register_employee(db, data, actor=hr_actor, client_ip=client_ip)


@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get employee details. Enforces employee self-service data scope."""
    enforce_employee_scope(current_user, employee_id)
    return EmployeeService.get_employee(db, employee_id)


@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    request: Request,
    hr_actor: User = Depends(require_roles(["HR", "ADMIN"])),
    db: Session = Depends(get_db)
):
    """HR/Admin: Update employee profile, role, or department."""
    client_ip = request.client.host if request.client else None
    return EmployeeService.update_employee(db, employee_id, data, actor=hr_actor, client_ip=client_ip)


@router.patch("/{employee_id}/self", response_model=EmployeeResponse)
def self_update_employee(
    employee_id: int,
    data: EmployeeSelfUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Employee self-service: update ONLY phone, address, and emergency contact."""
    enforce_employee_scope(current_user, employee_id)
    client_ip = request.client.host if request.client else None
    return EmployeeService.self_update_employee(db, employee_id, data, actor=current_user, client_ip=client_ip)


@router.get("/{employee_id}/360", response_model=Employee360Response)
def get_employee_360(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Employee 360 profile view (attendance summary, leave balances, recent payslips, attrition risk)."""
    enforce_employee_scope(current_user, employee_id)
    return EmployeeService.get_employee_360(db, employee_id)


@router.post("/csv-dry-run", response_model=CSVDryRunResponse)
async def dry_run_csv(
    file: UploadFile = File(...),
    hr_actor: User = Depends(require_roles(["HR", "ADMIN"])),
    db: Session = Depends(get_db)
):
    """Dry-run CSV import with field-level error reporting (row, field, reason)."""
    content = await file.read()
    csv_str = content.decode("utf-8-sig", errors="ignore")
    return EmployeeService.dry_run_csv_import(db, csv_str)


@router.post("/csv-import")
async def commit_csv_import(
    request: Request,
    file: UploadFile = File(...),
    hr_actor: User = Depends(require_roles(["HR", "ADMIN"])),
    db: Session = Depends(get_db)
):
    """Execute CSV import after dry-run validation."""
    content = await file.read()
    csv_str = content.decode("utf-8-sig", errors="ignore")
    client_ip = request.client.host if request.client else None
    return EmployeeService.commit_csv_import(db, csv_str, actor=hr_actor, client_ip=client_ip)


@router.get("/export/csv")
def export_employees_csv(
    department_id: Optional[int] = None,
    hr_actor: User = Depends(require_roles(["HR", "ADMIN"])),
    db: Session = Depends(get_db)
):
    """Export employee directory as CSV."""
    csv_data = EmployeeService.export_employees_csv(db, department_id=department_id)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=employees_export.csv"}
    )
