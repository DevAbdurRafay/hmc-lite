from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class CheckInRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy: Optional[float] = None
    source: str = "WEB"  # WEB, CAMERA, MOBILE
    face_detected: Optional[bool] = None
    face_descriptor: Optional[List[float]] = None
    image_data: Optional[str] = None


class CheckOutRequest(BaseModel):
    source: str = "WEB"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy: Optional[float] = None


class AttendanceReportItem(BaseModel):
    date: date
    day_name: str
    is_weekend: bool
    status: str
    status_label: str
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    working_hours: float = 0.0
    source: Optional[str] = None


class AttendanceReportSummary(BaseModel):
    employee_id: int
    employee_name: str
    employee_code: str
    department_name: str
    month: int
    year: int
    total_days: int
    working_days_count: int
    weekend_days_count: int
    present_days: int
    late_days: int
    half_days: int
    absent_days: int
    on_leave_days: int
    total_working_hours: float
    records: List[AttendanceReportItem]


class AttendanceResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    working_hours: float
    work_hours: Optional[float] = None
    status: str
    source: str
    check_in_latitude: Optional[float] = None
    check_in_longitude: Optional[float] = None
    check_in_accuracy: Optional[float] = None

    class Config:
        from_attributes = True


class AttendanceCorrectionCreate(BaseModel):
    date: date
    requested_check_in: Optional[datetime] = None
    requested_check_out: Optional[datetime] = None
    reason: str = Field(..., min_length=5)


class AttendanceCorrectionReview(BaseModel):
    status: str = Field(..., pattern="^(APPROVED|REJECTED)$")
    review_comment: Optional[str] = None


class AttendanceCorrectionResponse(BaseModel):
    id: int
    attendance_id: Optional[int] = None
    employee_id: int
    employee_name: Optional[str] = None
    date: date
    requested_check_in: Optional[datetime] = None
    requested_check_out: Optional[datetime] = None
    reason: str
    status: str
    reviewer_id: Optional[int] = None
    review_comment: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AttendanceBoardItem(BaseModel):
    employee_id: int
    employee_code: str
    employee_name: str
    department_name: str
    status: str
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    working_hours: float
    source: Optional[str] = None
