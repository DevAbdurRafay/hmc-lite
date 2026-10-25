from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, enforce_employee_scope
from app.models import User, CompanySettings
from app.schemas.payroll import PayrollRunCreate, PayrollRunResponse, PayslipResponse
from app.services.payroll_service import PayrollService
from app.services.pdf_service import PDFService
from app.services.org_service import OrgService

router = APIRouter(prefix="/payroll", tags=["Payroll Management"])


@router.get("/runs", response_model=List[PayrollRunResponse])
def list_payroll_runs(
    current_user: User = Depends(require_roles(["ADMIN", "HR"])),
    db: Session = Depends(get_db)
):
    """Admin/HR: List all historical and current monthly payroll runs."""
    return PayrollService.list_payroll_runs(db)


@router.get("/runs/{run_id}", response_model=PayrollRunResponse)
def get_payroll_run(
    run_id: int,
    current_user: User = Depends(require_roles(["ADMIN", "HR"])),
    db: Session = Depends(get_db)
):
    """Admin/HR: View specific payroll run breakdown and payslips."""
    return PayrollService.get_payroll_run(db, run_id)


@router.post("/draft", response_model=PayrollRunResponse, status_code=status.HTTP_201_CREATED)
def create_or_refresh_draft(
    data: PayrollRunCreate,
    request: Request,
    hr_actor: User = Depends(require_roles(["HR"])),
    db: Session = Depends(get_db)
):
    """HR only: Prepare, compute, and review monthly payroll draft."""
    client_ip = request.client.host if request.client else None
    return PayrollService.create_or_refresh_draft(
        db, month=data.month, year=data.year, actor=hr_actor, client_ip=client_ip
    )


@router.post("/runs/{run_id}/finalize", response_model=PayrollRunResponse)
def finalize_payroll(
    run_id: int,
    request: Request,
    admin_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    """Admin only: Finalize and permanently lock monthly payroll. Notifies employees."""
    client_ip = request.client.host if request.client else None
    return PayrollService.finalize_payroll(
        db, run_id, admin_actor=admin_user, client_ip=client_ip
    )


@router.get("/payslips/{payslip_id}", response_model=PayslipResponse)
def get_payslip(
    payslip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """View individual payslip breakdown. Employees can only view own payslip."""
    slip = PayrollService.get_payslip(db, payslip_id)
    enforce_employee_scope(current_user, slip.employee_id)
    return slip


@router.get("/payslips/{payslip_id}/pdf")
def download_payslip_pdf(
    payslip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download payslip as a PDF document. Employees can only download own payslip."""
    from app.models import Payslip
    slip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not slip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Payslip not found"})

    enforce_employee_scope(current_user, slip.employee_id)
    settings_rec = OrgService.get_settings(db)
    pdf_bytes = PDFService.generate_payslip_pdf(slip, settings_rec)

    filename = f"payslip_{slip.year}_{slip.month:02d}_{slip.employee.employee_code}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/employees/{employee_id}/payslips", response_model=List[PayslipResponse])
def list_employee_payslips(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all payslips for an employee. Employees can only view own payslips."""
    enforce_employee_scope(current_user, employee_id)
    return PayrollService.list_employee_payslips(db, employee_id)
