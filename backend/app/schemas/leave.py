from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class LeaveApplyRequest(BaseModel):
    leave_type_id: int
    start_date: date
    end_date: date
    reason: str = Field(..., min_length=3)


class LeaveReviewRequest(BaseModel):
    status: str = Field(..., pattern="^(APPROVED|REJECTED)$")
    review_comment: Optional[str] = None


class LeaveResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    department_name: Optional[str] = None
    leave_type_id: int
    leave_type_name: Optional[str] = None
    start_date: date
    end_date: date
    working_days: int
    reason: str
    status: str
    reviewer_id: Optional[int] = None
    review_comment: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LeaveBalanceItem(BaseModel):
    leave_type_id: int
    name: str
    code: str
    quota: int
    used_days: int
    remaining_balance: int
    is_unpaid: bool


class LeaveBalanceResponse(BaseModel):
    employee_id: int
    year: int
    balances: List[LeaveBalanceItem]
