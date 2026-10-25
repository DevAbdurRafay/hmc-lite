import base64
import calendar
import json
from datetime import date, datetime, timedelta, time, timezone
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None

from app.core.config import settings
from app.models import (
    Attendance, AttendanceCorrection, Employee, User,
    CompanySettings, LeaveRequest, FaceEnrollment
)
from app.schemas.attendance import (
    CheckInRequest, CheckOutRequest, AttendanceResponse,
    AttendanceCorrectionCreate, AttendanceCorrectionReview,
    AttendanceBoardItem, AttendanceReportSummary, AttendanceReportItem
)
from app.services.audit_service import AuditService
from app.services.org_service import OrgService
from app.utils.geo import haversine_distance_meters
from app.utils.dates import now_utc, now_company, to_company_tz


def _extract_biometric_vector(image_data: str) -> Optional[np.ndarray]:
    """Extract normalized biometric vector using OpenCV spatial block feature analysis."""
    if not cv2 or not image_data:
        return None
    try:
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]
        raw_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(raw_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        resized = cv2.resize(gray, (128, 128))
        equalized = cv2.equalizeHist(resized)

        blocks = []
        for r in range(8):
            for c in range(8):
                cell = equalized[r*16:(r+1)*16, c*16:(c+1)*16]
                blocks.append(float(np.mean(cell)))
                blocks.append(float(np.std(cell)))

        vec = np.array(blocks, dtype=np.float32)
        vec = vec - np.mean(vec)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec
    except Exception:
        return None


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

            # Check Face Detection & OpenCV Biometric Template Matching
            if data.source.upper() == "CAMERA":
                if not data.face_detected and not data.image_data:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={
                            "code": "FACE_NOT_DETECTED",
                            "message": "Live face could not be detected. Ensure your face is centered in the camera frame."
                        }
                    )

                # If image_data is provided, verify against FaceEnrollment
                if data.image_data and cv2:
                    live_vector = _extract_biometric_vector(data.image_data)
                    if live_vector is not None:
                        enrollment = db.query(FaceEnrollment).filter(FaceEnrollment.employee_id == employee_id).first()
                        if not enrollment:
                            # Auto-enroll verified template for registered employee
                            enrollment = FaceEnrollment(
                                employee_id=employee_id,
                                descriptor_vector=json.dumps(live_vector.tolist())
                            )
                            db.add(enrollment)
                            db.commit()
                        else:
                            # Compare live face against enrolled template
                            enrolled_vec = np.array(json.loads(enrollment.descriptor_vector), dtype=np.float32)
                            sim = float(np.dot(live_vector, enrolled_vec))
                            # Biometric threshold: 0.68 similarity required to match same employee
                            if sim < 0.68:
                                raise HTTPException(
                                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                    detail={
                                        "code": "FACE_MISMATCH",
                                        "message": f"Biometric verification failed. Captured face does not match the enrolled face template for this employee (Similarity: {sim*100:.1f}% vs required 68%). Only the registered employee can verify attendance."
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

        settings_rec = OrgService.get_settings(db)

        # Geofence check on check-out if coordinates are provided
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
                        "message": f"Office Geofence Violation: You are {dist:.1f}m away from the office (allowed radius: {settings_rec.office_radius_meters:.0f}m). You cannot clock out outside the authorized office geofence."
                    }
                )

        record.check_out = utc_timestamp

        # Safely handle offset-naive and offset-aware datetimes
        c_in = record.check_in
        c_out = utc_timestamp
        if hasattr(c_in, 'tzinfo') and c_in.tzinfo is not None and c_out.tzinfo is None:
            c_out = c_out.replace(tzinfo=timezone.utc)
        elif hasattr(c_in, 'tzinfo') and c_in.tzinfo is None and c_out.tzinfo is not None:
            c_in = c_in.replace(tzinfo=timezone.utc)

        # Calculate working hours in hours
        duration = (c_out - c_in).total_seconds() / 3600.0
        record.working_hours = round(max(0.0, duration), 2)

        # Check half-day threshold
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
    def admin_checkout(
        db: Session,
        employee_id: int,
        actor: User,
        client_ip: Optional[str] = None
    ) -> AttendanceResponse:
        """HR/Admin manual check-out override for employee."""
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
                detail={"code": "NOT_CHECKED_IN", "message": "Employee has not checked in today."}
            )

        if record.check_out:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "ALREADY_CHECKED_OUT", "message": "Employee has already checked out."}
            )

        record.check_out = utc_timestamp
        c_in = record.check_in
        c_out = utc_timestamp
        if hasattr(c_in, 'tzinfo') and c_in.tzinfo is not None and c_out.tzinfo is None:
            c_out = c_out.replace(tzinfo=timezone.utc)
        elif hasattr(c_in, 'tzinfo') and c_in.tzinfo is None and c_out.tzinfo is not None:
            c_in = c_in.replace(tzinfo=timezone.utc)

        duration = (c_out - c_in).total_seconds() / 3600.0
        record.working_hours = round(max(0.0, duration), 2)
        record.source = "MANUAL_HR"

        settings_rec = OrgService.get_settings(db)
        if record.working_hours < settings_rec.half_day_threshold_hours:
            record.status = "HALF_DAY"

        db.commit()
        db.refresh(record)

        AuditService.log(
            db, action="ADMIN_CHECK_OUT", entity="ATTENDANCE", entity_id=str(record.id),
            actor=actor, after_obj={"working_hours": record.working_hours, "status": record.status, "manual_by": actor.email},
            client_ip=client_ip
        )
        return AttendanceService._build_attendance_response(record)

    @staticmethod
    def get_monthly_report(
        db: Session,
        employee_id: int,
        month: int,
        year: int
    ) -> AttendanceReportSummary:
        """
        Generates full date-wise monthly attendance report.
        Saturday and Sunday are permanently designated as 'Weekend (Off)' for the entire company.
        """
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "EMPLOYEE_NOT_FOUND", "message": "Employee record not found"}
            )

        company_now = now_company()
        today = company_now.date()

        num_days = calendar.monthrange(year, month)[1]
        start_date = date(year, month, 1)
        end_date = date(year, month, num_days)

        records_db = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.date >= start_date,
            Attendance.date <= end_date
        ).all()
        att_map = {r.date: r for r in records_db}

        leaves_db = db.query(LeaveRequest).filter(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status == "APPROVED",
            LeaveRequest.start_date <= end_date,
            LeaveRequest.end_date >= start_date
        ).all()

        report_items: List[AttendanceReportItem] = []
        present_cnt = 0
        late_cnt = 0
        half_day_cnt = 0
        absent_cnt = 0
        on_leave_cnt = 0
        weekend_cnt = 0
        working_days_cnt = 0
        total_hrs = 0.0

        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

        for d in range(1, num_days + 1):
            curr_date = date(year, month, d)
            w_idx = curr_date.weekday()
            day_str = day_names[w_idx]

            # Saturday (5) & Sunday (6) are permanently OFF
            if w_idx in [5, 6]:
                weekend_cnt += 1
                report_items.append(AttendanceReportItem(
                    date=curr_date,
                    day_name=day_str,
                    is_weekend=True,
                    status="WEEKEND",
                    status_label="Weekend (Off)",
                    check_in_time=None,
                    check_out_time=None,
                    working_hours=0.0,
                    source=None
                ))
                continue

            working_days_cnt += 1
            att_rec = att_map.get(curr_date)

            if att_rec:
                cin_str = to_company_tz(att_rec.check_in).strftime("%I:%M:%S %p") if att_rec.check_in else None
                cout_str = to_company_tz(att_rec.check_out).strftime("%I:%M:%S %p") if att_rec.check_out else None
                wh = att_rec.working_hours or 0.0
                total_hrs += wh

                if att_rec.status == "LATE":
                    late_cnt += 1
                    lbl = "Late Arrival"
                elif att_rec.status == "HALF_DAY":
                    half_day_cnt += 1
                    lbl = "Half Day (<5h)"
                elif att_rec.status == "PRESENT":
                    present_cnt += 1
                    lbl = "Present (On Time)"
                else:
                    lbl = att_rec.status.capitalize()

                report_items.append(AttendanceReportItem(
                    date=curr_date,
                    day_name=day_str,
                    is_weekend=False,
                    status=att_rec.status,
                    status_label=lbl,
                    check_in_time=cin_str,
                    check_out_time=cout_str,
                    working_hours=wh,
                    source=att_rec.source
                ))
            else:
                # Check if on approved leave
                matching_leave = next((l for l in leaves_db if l.start_date <= curr_date <= l.end_date), None)
                if matching_leave:
                    on_leave_cnt += 1
                    lt_name = matching_leave.leave_type.name if matching_leave.leave_type else "Leave"
                    report_items.append(AttendanceReportItem(
                        date=curr_date,
                        day_name=day_str,
                        is_weekend=False,
                        status="ON_LEAVE",
                        status_label=f"On Leave ({lt_name})",
                        check_in_time=None,
                        check_out_time=None,
                        working_hours=0.0,
                        source=None
                    ))
                elif curr_date <= today:
                    absent_cnt += 1
                    report_items.append(AttendanceReportItem(
                        date=curr_date,
                        day_name=day_str,
                        is_weekend=False,
                        status="ABSENT",
                        status_label="Absent",
                        check_in_time=None,
                        check_out_time=None,
                        working_hours=0.0,
                        source=None
                    ))
                else:
                    report_items.append(AttendanceReportItem(
                        date=curr_date,
                        day_name=day_str,
                        is_weekend=False,
                        status="SCHEDULED",
                        status_label="Scheduled Working Day",
                        check_in_time=None,
                        check_out_time=None,
                        working_hours=0.0,
                        source=None
                    ))

        return AttendanceReportSummary(
            employee_id=emp.id,
            employee_name=emp.full_name,
            employee_code=emp.employee_code,
            department_name=emp.department.name if emp.department else "",
            month=month,
            year=year,
            total_days=num_days,
            working_days_count=working_days_cnt,
            weekend_days_count=weekend_cnt,
            present_days=present_cnt,
            late_days=late_cnt,
            half_days=half_day_cnt,
            absent_days=absent_cnt,
            on_leave_days=on_leave_cnt,
            total_working_hours=round(total_hrs, 2),
            records=report_items
        )

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
            work_hours=record.working_hours,
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
