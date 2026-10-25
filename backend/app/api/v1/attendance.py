from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, enforce_employee_scope
from app.models import User, AttendanceCorrection
from app.schemas.attendance import (
    CheckInRequest, CheckOutRequest, AttendanceResponse,
    AttendanceCorrectionCreate, AttendanceCorrectionReview,
    AttendanceCorrectionResponse, AttendanceBoardItem
)
from app.services.attendance_service import AttendanceService

router = APIRouter(prefix="/attendance", tags=["Attendance & Time Tracking"])


@router.post("/check-in", response_model=AttendanceResponse)
def check_in(
    data: CheckInRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Web/Camera/Mobile check-in. Server stamps UTC time and enforces rules and geofence."""
    if current_user.role == "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ADMIN_NO_CHECKIN", "message": "Admin users do not have attendance tracking."}
        )
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NO_EMPLOYEE_PROFILE", "message": "No employee record associated with this account."}
        )

    client_ip = request.client.host if request.client else None
    return AttendanceService.check_in(
        db, current_user.employee.id, data, actor=current_user, client_ip=client_ip
    )


@router.post("/check-out", response_model=AttendanceResponse)
def check_out(
    data: CheckOutRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check-out. Calculates total worked hours and determines half-day status (< 5h)."""
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NO_EMPLOYEE_PROFILE", "message": "No employee record associated with this account."}
        )

    client_ip = request.client.host if request.client else None
    return AttendanceService.check_out(
        db, current_user.employee.id, data, actor=current_user, client_ip=client_ip
    )


@router.get("/calendar/{employee_id}", response_model=List[AttendanceResponse])
def get_attendance_calendar(
    employee_id: int,
    month: int,
    year: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Monthly attendance calendar. Scoped to own records for employees."""
    enforce_employee_scope(current_user, employee_id)
    return AttendanceService.get_calendar(db, employee_id, month, year)


@router.get("/board", response_model=List[AttendanceBoardItem])
def get_daily_attendance_board(
    target_date: Optional[date] = None,
    department_id: Optional[int] = None,
    current_user: User = Depends(require_roles(["ADMIN", "HR"])),
    db: Session = Depends(get_db)
):
    """HR/Admin: Daily live attendance board across all staff."""
    return AttendanceService.get_daily_board(db, target_date=target_date, department_id=department_id)


@router.post("/corrections", response_model=AttendanceCorrectionResponse, status_code=status.HTTP_201_CREATED)
def request_correction(
    data: AttendanceCorrectionCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Employee: Request attendance correction with reason."""
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NO_EMPLOYEE_PROFILE", "message": "No employee record associated with this account."}
        )
    client_ip = request.client.host if request.client else None
    corr = AttendanceService.request_correction(
        db, current_user.employee.id, data, actor=current_user, client_ip=client_ip
    )
    return AttendanceCorrectionResponse(
        id=corr.id,
        attendance_id=corr.attendance_id,
        employee_id=corr.employee_id,
        employee_name=corr.employee.full_name if corr.employee else None,
        date=corr.date,
        requested_check_in=corr.requested_check_in,
        requested_check_out=corr.requested_check_out,
        reason=corr.reason,
        status=corr.status,
        reviewer_id=corr.reviewer_id,
        review_comment=corr.review_comment,
        reviewed_at=corr.reviewed_at,
        created_at=corr.created_at,
    )


@router.get("/corrections", response_model=List[AttendanceCorrectionResponse])
def list_corrections(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List attendance correction requests. Admin/HR view all; Employee views own."""
    query = db.query(AttendanceCorrection)
    if current_user.role == "EMPLOYEE":
        if not current_user.employee:
            return []
        query = query.filter(AttendanceCorrection.employee_id == current_user.employee.id)
    if status_filter:
        query = query.filter(AttendanceCorrection.status == status_filter.upper())

    results = query.order_by(AttendanceCorrection.id.desc()).all()
    return [
        AttendanceCorrectionResponse(
            id=c.id,
            attendance_id=c.attendance_id,
            employee_id=c.employee_id,
            employee_name=c.employee.full_name if c.employee else None,
            date=c.date,
            requested_check_in=c.requested_check_in,
            requested_check_out=c.requested_check_out,
            reason=c.reason,
            status=c.status,
            reviewer_id=c.reviewer_id,
            review_comment=c.review_comment,
            reviewed_at=c.reviewed_at,
            created_at=c.created_at,
        ) for c in results
    ]


@router.patch("/corrections/{correction_id}/review", response_model=AttendanceCorrectionResponse)
def review_correction(
    correction_id: int,
    review_data: AttendanceCorrectionReview,
    request: Request,
    hr_actor: User = Depends(require_roles(["HR", "ADMIN"])),
    db: Session = Depends(get_db)
):
    """HR/Admin: Approve or reject attendance correction request."""
    client_ip = request.client.host if request.client else None
    corr = AttendanceService.review_correction(
        db, correction_id, review_data, reviewer=hr_actor, client_ip=client_ip
    )
    return AttendanceCorrectionResponse(
        id=corr.id,
        attendance_id=corr.attendance_id,
        employee_id=corr.employee_id,
        employee_name=corr.employee.full_name if corr.employee else None,
        date=corr.date,
        requested_check_in=corr.requested_check_in,
        requested_check_out=corr.requested_check_out,
        reason=corr.reason,
        status=corr.status,
        reviewer_id=corr.reviewer_id,
        review_comment=corr.review_comment,
        reviewed_at=corr.reviewed_at,
        created_at=corr.created_at,
    )
