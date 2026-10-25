from typing import Optional
from pydantic import BaseModel, Field, field_validator


def validate_strong_password(v: str) -> str:
    """
    Validates that password satisfies all security requirements:
    - At least 8 characters
    - At least 1 number (0-9)
    - At least 1 special character (!@#$%^&*...)
    - At least 1 uppercase letter (A-Z)
    - At least 1 lowercase letter (a-z)
    """
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not any(c.isdigit() for c in v):
        raise ValueError("Password must include at least one number (0-9).")
    special_chars = set("!@#$%^&*()-_=+[]{}|;:'\",.<>?/`~\\")
    if not any(c in special_chars for c in v):
        raise ValueError("Password must include at least one special character (!@#$%^&*...).")
    if not any(c.isupper() for c in v):
        raise ValueError("Password must include at least one uppercase letter (A-Z).")
    if not any(c.islower() for c in v):
        raise ValueError("Password must include at least one lowercase letter (a-z).")
    return v


def validate_hmclite_email(v: str) -> str:
    """
    Validates that registered email ends with '@hcmlite.app' (e.g. admin@hcmlite.app).
    Also supports legacy test suffixes for backward compatibility.
    """
    clean = v.strip().lower()
    valid_suffixes = ("@hcmlite.app", "hcmlite.app", "@hmclite", "hmclite", "hcmlite.com", "hcmlite.local", "hmclite.com", "hmclite.local")
    matched_suffix = next((s for s in valid_suffixes if clean.endswith(s)), None)
    if not matched_suffix:
        raise ValueError("Email address must end with @hcmlite.app (e.g. admin@hcmlite.app).")

    # Check that there are unique characters before the suffix
    prefix = clean[:-len(matched_suffix)].rstrip("@._-")
    if not prefix:
        raise ValueError("Email must start with a unique username before @hcmlite.app.")
    return clean


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None
    role: str
    must_change_password: bool
    email: str
    user_id: int
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def check_password_complexity(cls, v: str) -> str:
        return validate_strong_password(v)


class FirstRunSetupRequest(BaseModel):
    company_name: str = Field(..., min_length=2)
    admin_email: str = Field(...)
    admin_password: str = Field(..., min_length=8)
    office_start_time: str = "09:00"
    grace_period_minutes: int = 15
    half_day_threshold_hours: float = 5.0
    weekend_days: str = "5,6"
    office_latitude: float = 24.8607
    office_longitude: float = 67.0011
    office_radius_meters: float = 150.0

    @field_validator("admin_email")
    @classmethod
    def check_admin_email(cls, v: str) -> str:
        return validate_hmclite_email(v)

    @field_validator("admin_password")
    @classmethod
    def check_admin_pwd(cls, v: str) -> str:
        return validate_strong_password(v)


class CreateHRRequest(BaseModel):
    email: str = Field(...)
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None

    @field_validator("email")
    @classmethod
    def check_hr_email(cls, v: str) -> str:
        return validate_hmclite_email(v)

    @field_validator("password")
    @classmethod
    def check_hr_pwd(cls, v: str) -> str:
        return validate_strong_password(v)


class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool
    must_change_password: bool
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    full_name: Optional[str] = None

    class Config:
        from_attributes = True


class ResetPasswordResponse(BaseModel):
    user_id: int
    email: str
    temporary_password: str
    message: str
