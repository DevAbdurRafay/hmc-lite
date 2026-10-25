from datetime import date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class SalaryStructureInput(BaseModel):
    basic_salary: float = Field(..., gt=0)
    other_allowances: float = 0.0
    effective_date: Optional[date] = None


class SalaryStructureResponse(BaseModel):
    id: int
    employee_id: int
    basic_salary: float
    hra: float
    medical_allowance: float
    other_allowances: float
    gross_salary: float
    effective_date: date

    class Config:
        from_attributes = True


class EmployeeCreate(BaseModel):
    employee_code: str = Field(..., min_length=2)
    first_name: str = Field(..., min_length=1)
    last_name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=5)
    phone: Optional[str] = None
    address: Optional[str] = None
    gender: str = "OTHER"
    department_id: int
    designation_id: int
    joining_date: date
    status: str = "ACTIVE"
    emergency_contact: Optional[str] = None
    basic_salary: float = Field(..., gt=0)


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[str] = None
    department_id: Optional[int] = None
    designation_id: Optional[int] = None
    joining_date: Optional[date] = None
    exit_date: Optional[date] = None
    status: Optional[str] = None
    emergency_contact: Optional[str] = None


class EmployeeSelfUpdate(BaseModel):
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None


class EmployeeResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    employee_code: str
    first_name: str
    last_name: str
    full_name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    gender: str
    department_id: int
    department_name: Optional[str] = None
    designation_id: int
    designation_title: Optional[str] = None
    joining_date: date
    exit_date: Optional[date] = None
    status: str
    emergency_contact: Optional[str] = None
    salary_structure: Optional[SalaryStructureResponse] = None

    class Config:
        from_attributes = True


class EmployeeRegistrationResponse(BaseModel):
    employee: EmployeeResponse
    temporary_password: str
    message: str


class Employee360Response(BaseModel):
    employee: EmployeeResponse
    attendance_summary: Dict[str, Any]
    leave_summary: Dict[str, Any]
    payroll_summary: Dict[str, Any]
    attrition_risk: Dict[str, Any]


class CSVDryRunError(BaseModel):
    row: int
    field: str
    reason: str


class CSVDryRunResponse(BaseModel):
    is_valid: bool
    total_rows: int
    valid_rows_count: int
    error_count: int
    errors: List[CSVDryRunError]
    preview: List[Dict[str, Any]]
