from datetime import date
from typing import Optional, List
from pydantic import BaseModel, Field


class CompanySettingsUpdateRequest(BaseModel):
    company_name: Optional[str] = None
    office_start_time: Optional[str] = None
    grace_period_minutes: Optional[int] = None
    half_day_threshold_hours: Optional[float] = None
    weekend_days: Optional[str] = None
    office_latitude: Optional[float] = None
    office_longitude: Optional[float] = None
    office_radius_meters: Optional[float] = None
    late_penalty_enabled: Optional[bool] = None


class CompanySettingsResponse(BaseModel):
    id: int
    company_name: str
    office_start_time: str
    grace_period_minutes: int
    half_day_threshold_hours: float
    weekend_days: str
    office_latitude: float
    office_longitude: float
    office_radius_meters: float
    late_penalty_enabled: bool
    is_configured: bool

    class Config:
        from_attributes = True


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=2)
    code: str = Field(..., min_length=2)
    description: Optional[str] = None


class DepartmentResponse(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class DesignationCreate(BaseModel):
    title: str = Field(..., min_length=2)
    department_id: int
    description: Optional[str] = None


class DesignationResponse(BaseModel):
    id: int
    title: str
    department_id: int
    description: Optional[str] = None
    department_name: Optional[str] = None

    class Config:
        from_attributes = True


class LeaveTypeCreate(BaseModel):
    name: str
    code: str
    yearly_quota: int
    is_unpaid: bool = False
    description: Optional[str] = None


class LeaveTypeResponse(BaseModel):
    id: int
    name: str
    code: str
    yearly_quota: int
    is_unpaid: bool
    description: Optional[str] = None

    class Config:
        from_attributes = True


class HolidayCreate(BaseModel):
    name: str
    date: date
    is_recurring: bool = False


class HolidayResponse(BaseModel):
    id: int
    name: str
    date: date
    is_recurring: bool

    class Config:
        from_attributes = True
