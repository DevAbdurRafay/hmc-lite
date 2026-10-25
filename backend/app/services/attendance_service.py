from datetime import date, datetime, timedelta, time
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import (
    Attendance, AttendanceCorrection, Employee, User,
    CompanySettings, LeaveRequest
)
from app.schemas.attendance import (
    CheckInRequest, CheckOutRequest, AttendanceResponse,
    AttendanceCorrectionCreate, AttendanceCorrectionReview,
    AttendanceBoardItem
)
from app.services.audit_service import AuditService
from app.services.org_service import OrgService
from app.utils.geo import haversine_distance_meters
from app.utils.dates import now_utc, now_company, to_company_tz


class AttendanceService:
    @staticmethod
    def check_in(
        db: Session,
        employee_id: int,
        data: CheckInRequest,
        actor: User,
        client_ip: Optional[str] = None
    ) -> AttendanceResponse:
        company_now = now_company()
        today = company_now.date()
        utc_timestamp = now_utc()

        # 1. Check for duplicate check-in on the same day -> HTTP 409
        existing = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.date == today
        ).first()
        if existing and existing.check_in:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "ALREADY_CHECKED_IN", "message": "You have already checked in today."}
            )

        settings_rec = OrgService.get_settings(db)

        # 2. Camera & Geofence verification if source is CAMERA or coordinates are provided
        if data.source.upper() == "CAMERA" or (data.latitude is not None and data.longitude is not None):
            # Check GPS accuracy
            if data.accuracy is not None and data.accuracy > settings.FACE_MIN_GPS_ACCURACY_M:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "code": "GPS_INACCURATE",
                        "message": f"GPS accuracy ({data.accuracy:.1f}m) exceeds required {settings.FACE_MIN_GPS_ACCURACY_M}m threshold. Please move to a clearer location or submit an attendance correction request."
                    }
                )

            # Check Haversine distance
            if data.latitude is not None and data.longitude is not None:
                dist = haversine_distance_meters(
                    data.latitude, data.longitude,
                    settings_rec.office_latitude, settings_rec.office_longitude
                )
                if dist > settings_rec.office_radius_meters:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={
                            "code": "GEOFENCE_VIOLATION",
                            "message": f"You are {dist:.1f}m away from the office (allowed radius: {settings_rec.office_radius_meters:.0f}m). Please check in from the office or submit an attendance correction request."
                        }
                    )

            # Check Face Detection
            if data.source.upper() == "CAMERA" and not data.face_detected:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "code": "FACE_NOT_DETECTED",
                        "message": "Live face could not be detected. Ensure your face is centered in the camera frame."
                    }
                )

        # 3. Calculate status: start time (09:00) + grace (15 min) -> 09:15
        start_parts = [int(p) for p in settings_rec.office_start_time.split(":")]
        threshold_dt = company_now.replace(
            hour=start_parts[0], minute=start_parts[1], second=0, microsecond=0
        ) + timedelta(minutes=settings_rec.grace_period_minutes)

        if company_now > threshold_dt:
            att_status = "LATE"
        else:
            att_status = "PRESENT"

        if existing:
            # Row might exist as ON_LEAVE or placeholder
            record = existing
            record.check_in = utc_timestamp
            record.status = att_status
            record.source = data.source.upper()
            record.check_in_latitude = data.latitude
            record.check_in_longitude = data.longitude
            record.check_in_accuracy = data.accuracy
        else:
            record = Attendance(
                employee_id=employee_id,
                date=today,
                check_in=utc_timestamp,
                status=att_status,
                source=data.source.upper(),
                check_in_latitude=data.latitude,
                check_in_longitude=data.longitude,
                check_in_accuracy=data.accuracy,
            )
            db.add(record)

        db.commit()
        db.refresh(record)

        AuditService.log(
            db, action="CHECK_IN", entity="ATTENDANCE", entity_id=str(record.id),
            actor=actor, after_obj={"status": record.status, "source": record.source},
            client_ip=client_ip
        )
        return AttendanceService._build_attendance_response(record)

    @staticmethod
    def check_out(
        db: Session,
        employee_id: int,
        data: CheckOutRequest,
        actor: User,
        client_ip: Optional[str] = None
    ) -> AttendanceResponse:
        company_now = now_company()
        today = company_now.date()
        utc_timestamp = now_utc()

        record = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.date == today
        ).first()

        if not record or not record.check_in:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "NOT_CHECKED_IN", "message": "You must check in before checking out."}
            )

        record.check_out = utc_timestamp
        # Calculate working hours in hours
        duration = (record.check_out - record.check_in).total_seconds() / 3600.0
        record.working_hours = round(max(0.0, duration), 2)

        # Check half-day threshold
        settings_rec = OrgService.get_settings(db)
        if record.working_hours < settings_rec.half_day_threshold_hours:
            record.status = "HALF_DAY"

        db.commit()
        db.refresh(record)

        AuditService.log(
            db, action="CHECK_OUT", entity="ATTENDANCE", entity_id=str(record.id),
            actor=actor, after_obj={"working_hours": record.working_hours, "status": record.status},
            client_ip=client_ip
        )
        return AttendanceService._build_attendance_response(record)

    @staticmethod
    def _build_attendance_response(record: Attendance) -> AttendanceResponse:
        emp = record.employee
        return AttendanceResponse(
            id=record.id,
            employee_id=record.employee_id,
            employee_name=emp.full_name if emp else None,
            employee_code=emp.employee_code if emp else None,
            department_name=emp.department.name if emp and emp.department else None,
            date=record.date,
            check_in=record.check_in,
            check_out=record.check_out,
            working_hours=record.working_hours,
            status=record.status,
            source=record.source,
            check_in_latitude=record.check_in_latitude,
            check_in_longitude=record.check_in_longitude,
            check_in_accuracy=record.check_in_accuracy,
        )

    @staticmethod
    def get_calendar(
        db: Session, employee_id: int, month: int, year: int
    ) -> List[AttendanceResponse]:
        records = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.date >= date(year, month, 1),
            Attendance.date <= date(year, month, 28) + timedelta(days=4)
        ).order_by(Attendance.date.asc()).all()

        # Filter strictly within the target month
        month_records = [r for r in records if r.date.month == month and r.date.year == year]
        return [AttendanceService._build_attendance_response(r) for r in month_records]

    @staticmethod
    def get_daily_board(
        db: Session, target_date: Optional[date] = None, department_id: Optional[int] = None
    ) -> List[AttendanceBoardItem]:
        if not target_date:
            target_date = now_company().date()

        emp_query = db.query(Employee).filter(Employee.status.in_(["ACTIVE", "PROBATION"]))
        if department_id:
            emp_query = emp_query.filter(Employee.department_id == department_id)
        employees = emp_query.all()

        records_map = {
            a.employee_id: a for a in db.query(Attendance).filter(Attendance.date == target_date).all()
        }

        # Check approved leave on target_date
        approved_leaves = db.query(LeaveRequest).filter(
            LeaveRequest.status == "APPROVED",
            LeaveRequest.start_date <= target_date,
            LeaveRequest.end_date >= target_date
        ).all()
        on_leave_emp_ids = {l.employee_id for l in approved_leaves}

        board: List[AttendanceBoardItem] = []
        for emp in employees:
            record = records_map.get(emp.id)
            if record:
                status_val = record.status
                check_in = record.check_in
                check_out = record.check_out
                hours = record.working_hours
                source = record.source
            elif emp.id in on_leave_emp_ids:
                status_val = "ON_LEAVE"
                check_in = None
                check_out = None
                hours = 0.0
                source = None
            else:
                status_val = "ABSENT"
                check_in = None
                check_out = None
                hours = 0.0
                source = None

            board.append(AttendanceBoardItem(
                employee_id=emp.id,
                employee_code=emp.employee_code,
                employee_name=emp.full_name,
                department_name=emp.department.name if emp.department else "",
                status=status_val,
                check_in=check_in,
                check_out=check_out,
                working_hours=hours,
                source=source,
            ))
        return board

    @staticmethod
    def request_correction(
        db: Session, employee_id: int, data: AttendanceCorrectionCreate, actor: User, client_ip: Optional[str] = None
    ) -> AttendanceCorrection:
        attendance = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.date == data.date
        ).first()

        correction = AttendanceCorrection(
            attendance_id=attendance.id if attendance else None,
            employee_id=employee_id,
            date=data.date,
            requested_check_in=data.requested_check_in,
            requested_check_out=data.requested_check_out,
            reason=data.reason,
            status="PENDING",
        )
        db.add(correction)
        db.commit()
        db.refresh(correction)

        AuditService.log(
            db, action="CREATE", entity="ATTENDANCE_CORRECTION", entity_id=str(correction.id),
            actor=actor, after_obj={"date": str(correction.date), "reason": correction.reason},
            client_ip=client_ip
        )
        return correction

    @staticmethod
    def review_correction(
        db: Session,
        correction_id: int,
        review_data: AttendanceCorrectionReview,
        reviewer: User,
        client_ip: Optional[str] = None
    ) -> AttendanceCorrection:
        correction = db.query(AttendanceCorrection).filter(AttendanceCorrection.id == correction_id).first()
        if not correction:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Correction request not found"})
        if correction.status != "PENDING":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": "ALREADY_REVIEWED", "message": "This request has already been reviewed"})

        correction.status = review_data.status
        correction.reviewer_id = reviewer.id
        correction.review_comment = review_data.review_comment
        correction.reviewed_at = now_utc()

        # If approved, update or create Attendance record
        if review_data.status == "APPROVED":
            record = correction.attendance or db.query(Attendance).filter(
                Attendance.employee_id == correction.employee_id,
                Attendance.date == correction.date
            ).first()

            if not record:
                record = Attendance(
                    employee_id=correction.employee_id,
                    date=correction.date,
                    source="MANUAL",
                )
                db.add(record)

            if correction.requested_check_in:
                record.check_in = correction.requested_check_in
            if correction.requested_check_out:
                record.check_out = correction.requested_check_out

            if record.check_in and record.check_out:
                duration = (record.check_out - record.check_in).total_seconds() / 3600.0
                record.working_hours = round(max(0.0, duration), 2)
                record.status = "PRESENT" if record.working_hours >= 5.0 else "HALF_DAY"
            else:
                record.status = "PRESENT"

        db.commit()
        db.refresh(correction)

        AuditService.log(
            db, action=f"CORRECTION_{review_data.status}", entity="ATTENDANCE_CORRECTION",
            entity_id=str(correction.id), actor=reviewer, after_obj={"status": correction.status},
            client_ip=client_ip
        )
        return correction
