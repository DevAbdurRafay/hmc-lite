from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, enforce_employee_scope
from app.models import User
from app.schemas.analytics import (
    AdminDashboardResponse, HRDashboardResponse, EmployeeDashboardResponse
)
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Dashboards & Analytics"])


@router.get("/admin", response_model=AdminDashboardResponse)
def get_admin_dashboard(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    department_id: Optional[int] = None,
    admin_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    """Admin company-wide dashboard: headcount, attrition YTD, payroll cost, average salary, forecasts."""
    return AnalyticsService.get_admin_dashboard(
        db, from_date=from_date, to_date=to_date, department_id=department_id
    )


@router.get("/hr", response_model=HRDashboardResponse)
def get_hr_dashboard(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    department_id: Optional[int] = None,
    hr_actor: User = Depends(require_roles(["ADMIN", "HR"])),
    db: Session = Depends(get_db)
):
    """HR operations dashboard: daily attendance, top late-comers, absenteeism, absence anomalies."""
    return AnalyticsService.get_hr_dashboard(
        db, from_date=from_date, to_date=to_date, department_id=department_id
    )


@router.get("/employee/{employee_id}", response_model=EmployeeDashboardResponse)
def get_employee_dashboard(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Employee personal dashboard: weekly hours ring, late count, leave balances, last payslip."""
    enforce_employee_scope(current_user, employee_id)
    return AnalyticsService.get_employee_dashboard(db, employee_id)
