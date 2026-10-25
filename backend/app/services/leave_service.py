from datetime import date
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.models import LeaveRequest, LeaveType, Holiday, Attendance, User, Employee
from app.schemas.leave import LeaveApplyRequest, LeaveReviewRequest, LeaveResponse, LeaveBalanceItem, LeaveBalanceResponse
from app.services.audit_service import AuditService
from app.services.org_service import OrgService
from app.utils.dates import get_working_days_between, now_utc, now_company


class LeaveService:
    @staticmethod
    def get_employee_leave_balances(db: Session, employee_id: int, year: Optional[int] = None) -> LeaveBalanceResponse:
        if not year:
            year = now_company().year

        leave_types = db.query(LeaveType).order_by(LeaveType.id.asc()).all()

        # Approved leaves for this employee in this year
        approved_leaves = db.query(LeaveRequest).filter(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status == "APPROVED",
            LeaveRequest.start_date >= date(year, 1, 1),
            LeaveRequest.start_date <= date(year, 12, 31),
        ).all()

        used_days_by_type: Dict[int, int] = {}
        for l in approved_leaves:
            used_days_by_type[l.leave_type_id] = used_days_by_type.get(l.leave_type_id, 0) + l.working_days

        balances: List[LeaveBalanceItem] = []
        for lt in leave_types:
            used = used_days_by_type.get(lt.id, 0)
            if lt.is_unpaid:
                remaining = 999  # unlimited
            else:
                remaining = max(0, lt.yearly_quota - used)

            balances.append(LeaveBalanceItem(
                leave_type_id=lt.id,
                name=lt.name,
                code=lt.code,
                quota=lt.yearly_quota,
                used_days=used,
                remaining_balance=remaining,
                is_unpaid=lt.is_unpaid,
            ))

        return LeaveBalanceResponse(employee_id=employee_id, year=year, balances=balances)

    @staticmethod
    def apply_leave(
        db: Session, employee_id: int, data: LeaveApplyRequest, actor: User, client_ip: Optional[str] = None
    ) -> LeaveResponse:
        if data.start_date > data.end_date:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "INVALID_DATES", "message": "End date cannot be earlier than start date."}
            )

        leave_type = db.query(LeaveType).filter(LeaveType.id == data.leave_type_id).first()
        if not leave_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "LEAVE_TYPE_NOT_FOUND", "message": "Leave type not found"}
            )

        # 1. Overlapping check: Any PENDING or APPROVED leave overlapping with requested dates -> HTTP 422
        overlap = db.query(LeaveRequest).filter(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status.in_(["PENDING", "APPROVED"]),
            LeaveRequest.start_date <= data.end_date,
            LeaveRequest.end_date >= data.start_date,
        ).first()
        if overlap:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "OVERLAPPING_LEAVE",
                    "message": f"You already have a {overlap.status.lower()} leave request from {overlap.start_date} to {overlap.end_date}."
                }
            )

        # 2. Calculate working days (skipping weekends and public holidays)
        settings_rec = OrgService.get_settings(db)
        holidays = {h.date for h in db.query(Holiday).all()}
        working_days = get_working_days_between(
            data.start_date, data.end_date,
            weekend_days=settings_rec.weekend_days,
            holiday_dates=holidays
        )

        if working_days <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "ZERO_WORKING_DAYS", "message": "The selected range contains only weekends or holidays (0 working days)."}
            )

        # 3. Check quota and balance
        if not leave_type.is_unpaid:
            balance_resp = LeaveService.get_employee_leave_balances(db, employee_id, data.start_date.year)
            target_balance = next((b for b in balance_resp.balances if b.leave_type_id == leave_type.id), None)
            if not target_balance or target_balance.remaining_balance < working_days:
                avail = target_balance.remaining_balance if target_balance else 0
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "code": "INSUFFICIENT_LEAVE_BALANCE",
                        "message": f"Insufficient {leave_type.name} balance. Requested: {working_days} days, Available: {avail} days."
                    }
                )

        leave_req = LeaveRequest(
            employee_id=employee_id,
            leave_type_id=leave_type.id,
            start_date=data.start_date,
            end_date=data.end_date,
            working_days=working_days,
            reason=data.reason.strip(),
            status="PENDING",
        )
        db.add(leave_req)
        db.commit()
        db.refresh(leave_req)

        AuditService.log(
            db, action="APPLY_LEAVE", entity="LEAVE", entity_id=str(leave_req.id),
            actor=actor, after_obj={"working_days": working_days, "type": leave_type.code},
            client_ip=client_ip
        )
        return LeaveService._build_leave_response(leave_req)

    @staticmethod
    def cancel_leave(
        db: Session, leave_id: int, employee_id: int, actor: User, client_ip: Optional[str] = None
    ) -> LeaveResponse:
        leave_req = db.query(LeaveRequest).filter(
            LeaveRequest.id == leave_id,
            LeaveRequest.employee_id == employee_id
        ).first()

        if not leave_req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Leave request not found"})

        if leave_req.status in ["CANCELLED", "REJECTED"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "ALREADY_PROCESSED", "message": f"Leave request is already {leave_req.status.lower()}."}
            )

        before_status = leave_req.status
        leave_req.status = "CANCELLED"
        db.commit()
        db.refresh(leave_req)

        AuditService.log(
            db, action="CANCEL_LEAVE", entity="LEAVE", entity_id=str(leave_req.id),
            actor=actor, before_obj={"status": before_status}, after_obj={"status": "CANCELLED"},
            client_ip=client_ip
        )
        return LeaveService._build_leave_response(leave_req)

    @staticmethod
    def review_leave(
        db: Session, leave_id: int, review_data: LeaveReviewRequest, reviewer: User, client_ip: Optional[str] = None
    ) -> LeaveResponse:
        leave_req = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
        if not leave_req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Leave request not found"})

        if leave_req.status != "PENDING":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "ALREADY_REVIEWED", "message": f"Leave request is already {leave_req.status.lower()}."}
            )

        before_status = leave_req.status
        leave_req.status = review_data.status
        leave_req.reviewer_id = reviewer.id
        leave_req.review_comment = review_data.review_comment
        leave_req.reviewed_at = now_utc()

        # If approved, sync attendance status (ON_LEAVE) for working dates in the range
        if review_data.status == "APPROVED":
            settings_rec = OrgService.get_settings(db)
            weekends = {int(x.strip()) for x in settings_rec.weekend_days.split(",") if x.strip()}
            holidays = {h.date for h in db.query(Holiday).all()}

            from datetime import timedelta
            curr = leave_req.start_date
            while curr <= leave_req.end_date:
                if curr.weekday() not in weekends and curr not in holidays:
                    att = db.query(Attendance).filter(
                        Attendance.employee_id == leave_req.employee_id,
                        Attendance.date == curr
                    ).first()
                    if not att:
                        att = Attendance(
                            employee_id=leave_req.employee_id,
                            date=curr,
                            status="ON_LEAVE",
                            source="MANUAL",
                        )
                        db.add(att)
                    elif not att.check_in:
                        att.status = "ON_LEAVE"
                curr += timedelta(days=1)

        db.commit()
        db.refresh(leave_req)

        AuditService.log(
            db, action=f"LEAVE_{review_data.status}", entity="LEAVE", entity_id=str(leave_req.id),
            actor=reviewer, before_obj={"status": before_status},
            after_obj={"status": leave_req.status, "comment": review_data.review_comment},
            client_ip=client_ip
        )
        return LeaveService._build_leave_response(leave_req)

    @staticmethod
    def list_leaves(
        db: Session,
        employee_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        department_id: Optional[int] = None
    ) -> List[LeaveResponse]:
        query = db.query(LeaveRequest)
        if employee_id:
            query = query.filter(LeaveRequest.employee_id == employee_id)
        if status_filter:
            query = query.filter(LeaveRequest.status == status_filter.upper())
        if department_id:
            query = query.join(Employee).filter(Employee.department_id == department_id)

        requests = query.order_by(LeaveRequest.id.desc()).all()
        return [LeaveService._build_leave_response(r) for r in requests]

    @staticmethod
    def _build_leave_response(leave: LeaveRequest) -> LeaveResponse:
        emp = leave.employee
        return LeaveResponse(
            id=leave.id,
            employee_id=leave.employee_id,
            employee_name=emp.full_name if emp else None,
            department_name=emp.department.name if emp and emp.department else None,
            leave_type_id=leave.leave_type_id,
            leave_type_name=leave.leave_type.name if leave.leave_type else None,
            start_date=leave.start_date,
            end_date=leave.end_date,
            working_days=leave.working_days,
            reason=leave.reason,
            status=leave.status,
            reviewer_id=leave.reviewer_id,
            review_comment=leave.review_comment,
            reviewed_at=leave.reviewed_at,
            created_at=leave.created_at,
        )
