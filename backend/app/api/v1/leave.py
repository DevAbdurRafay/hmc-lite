from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, enforce_employee_scope
from app.models import User
from app.schemas.leave import (
    LeaveApplyRequest, LeaveReviewRequest, LeaveResponse,
    LeaveBalanceResponse
)
from app.services.leave_service import LeaveService

router = APIRouter(prefix="/leave", tags=["Leave Management"])


@router.get("/balances/{employee_id}", response_model=LeaveBalanceResponse)
def get_leave_balances(
    employee_id: int,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """View leave balances and quotas for employee."""
    enforce_employee_scope(current_user, employee_id)
    return LeaveService.get_employee_leave_balances(db, employee_id, year)


@router.post("/apply", response_model=LeaveResponse, status_code=status.HTTP_201_CREATED)
def apply_leave(
    data: LeaveApplyRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Apply for leave. Validates working days, overlaps, and balances."""
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NO_EMPLOYEE_PROFILE", "message": "No employee record associated with this account."}
        )

    client_ip = request.client.host if request.client else None
    return LeaveService.apply_leave(
        db, current_user.employee.id, data, actor=current_user, client_ip=client_ip
    )


@router.patch("/{leave_id}/cancel", response_model=LeaveResponse)
def cancel_leave(
    leave_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Employee: Cancel own pending or scheduled leave."""
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NO_EMPLOYEE_PROFILE", "message": "No employee record associated with this account."}
        )

    client_ip = request.client.host if request.client else None
    return LeaveService.cancel_leave(
        db, leave_id, current_user.employee.id, actor=current_user, client_ip=client_ip
    )


@router.get("/requests", response_model=List[LeaveResponse])
def list_leaves(
    employee_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    department_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List leave requests. Admin/HR view all; Employee views own."""
    if current_user.role == "EMPLOYEE":
        if not current_user.employee:
            return []
        employee_id = current_user.employee.id

    return LeaveService.list_leaves(
        db, employee_id=employee_id, status_filter=status_filter, department_id=department_id
    )


@router.patch("/requests/{leave_id}/review", response_model=LeaveResponse)
def review_leave(
    leave_id: int,
    review_data: LeaveReviewRequest,
    request: Request,
    hr_actor: User = Depends(require_roles(["HR", "ADMIN"])),
    db: Session = Depends(get_db)
):
    """HR/Admin: Approve or reject a leave request with an optional comment."""
    client_ip = request.client.host if request.client else None
    return LeaveService.review_leave(
        db, leave_id, review_data, reviewer=hr_actor, client_ip=client_ip
    )
