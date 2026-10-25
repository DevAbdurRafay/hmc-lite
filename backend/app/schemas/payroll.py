from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class PayrollRunCreate(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2020, le=2050)


class PayslipResponse(BaseModel):
    id: int
    payroll_run_id: int
    employee_id: int
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    department_name: Optional[str] = None
    designation_title: Optional[str] = None
    month: int
    year: int
    basic_salary: float
    hra: float
    medical_allowance: float
    gross_salary: float
    working_days: int
    days_worked: float
    absent_days: int
    unpaid_leave_days: int
    half_days: int
    total_deductions: float
    taxable_income: float
    tax_deducted: float
    net_salary: float
    pdf_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PayrollRunResponse(BaseModel):
    id: int
    month: int
    year: int
    status: str
    total_gross: float
    total_net: float
    total_tax: float
    total_deductions: float
    finalized_by_id: Optional[int] = None
    finalized_at: Optional[datetime] = None
    created_at: datetime
    payslips: Optional[List[PayslipResponse]] = None

    class Config:
        from_attributes = True
