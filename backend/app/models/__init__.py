from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date, Numeric, Float, Text,
    ForeignKey, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)  # ADMIN, HR, EMPLOYEE
    is_active = Column(Boolean, default=True, nullable=False)
    must_change_password = Column(Boolean, default=False, nullable=False)
    token_version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    employee = relationship("Employee", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class CompanySettings(Base):
    __tablename__ = "company_settings"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), nullable=False, default="HCM Lite Enterprise")
    office_start_time = Column(String(10), nullable=False, default="09:00")
    grace_period_minutes = Column(Integer, nullable=False, default=15)
    half_day_threshold_hours = Column(Float, nullable=False, default=5.0)
    weekend_days = Column(String(50), nullable=False, default="5,6")  # 5=Sat, 6=Sun
    office_latitude = Column(Float, nullable=False, default=24.8607)
    office_longitude = Column(Float, nullable=False, default=67.0011)
    office_radius_meters = Column(Float, nullable=False, default=150.0)
    late_penalty_enabled = Column(Boolean, default=False, nullable=False)
    is_configured = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    designations = relationship("Designation", back_populates="department", cascade="all, delete-orphan")
    employees = relationship("Employee", back_populates="department")


class Designation(Base):
    __tablename__ = "designations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    department = relationship("Department", back_populates="designations")
    employees = relationship("Employee", back_populates="designation")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True, index=True)
    employee_code = Column(String(50), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    gender = Column(String(20), default="OTHER", nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False, index=True)
    designation_id = Column(Integer, ForeignKey("designations.id", ondelete="RESTRICT"), nullable=False, index=True)
    joining_date = Column(Date, nullable=False)
    exit_date = Column(Date, nullable=True)
    status = Column(String(50), default="ACTIVE", nullable=False)  # ACTIVE, PROBATION, RESIGNED, TERMINATED
    emergency_contact = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="employee")
    department = relationship("Department", back_populates="employees")
    designation = relationship("Designation", back_populates="employees")
    salary_structure = relationship("SalaryStructure", back_populates="employee", uselist=False, cascade="all, delete-orphan")
    attendance_records = relationship("Attendance", back_populates="employee", cascade="all, delete-orphan")
    leave_requests = relationship("LeaveRequest", back_populates="employee", cascade="all, delete-orphan")
    payslips = relationship("Payslip", back_populates="employee", cascade="all, delete-orphan")
    face_enrollment = relationship("FaceEnrollment", back_populates="employee", uselist=False, cascade="all, delete-orphan")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class SalaryStructure(Base):
    __tablename__ = "salary_structures"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    basic_salary = Column(Numeric(12, 2), nullable=False)
    hra = Column(Numeric(12, 2), nullable=False)  # 40% of basic
    medical_allowance = Column(Numeric(12, 2), nullable=False)  # 10% of basic
    other_allowances = Column(Numeric(12, 2), default=0.0, nullable=False)
    gross_salary = Column(Numeric(12, 2), nullable=False)  # 1.5 * basic + other
    effective_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    employee = relationship("Employee", back_populates="salary_structure")


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("employee_id", "date", name="uq_attendance_employee_date"),
        Index("ix_attendance_emp_date", "employee_id", "date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    check_in = Column(DateTime(timezone=True), nullable=True)
    check_out = Column(DateTime(timezone=True), nullable=True)
    working_hours = Column(Float, default=0.0, nullable=False)
    status = Column(String(50), nullable=False)  # PRESENT, LATE, HALF_DAY, ABSENT, MISSING_CHECKOUT, ON_LEAVE
    check_in_latitude = Column(Float, nullable=True)
    check_in_longitude = Column(Float, nullable=True)
    check_in_accuracy = Column(Float, nullable=True)
    source = Column(String(50), default="WEB", nullable=False)  # WEB, CAMERA, MOBILE, MANUAL
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    employee = relationship("Employee", back_populates="attendance_records")
    corrections = relationship("AttendanceCorrection", back_populates="attendance")


class AttendanceCorrection(Base):
    __tablename__ = "attendance_corrections"

    id = Column(Integer, primary_key=True, index=True)
    attendance_id = Column(Integer, ForeignKey("attendance.id", ondelete="SET NULL"), nullable=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    requested_check_in = Column(DateTime(timezone=True), nullable=True)
    requested_check_out = Column(DateTime(timezone=True), nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(String(50), default="PENDING", nullable=False)  # PENDING, APPROVED, REJECTED
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    review_comment = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    attendance = relationship("Attendance", back_populates="corrections")
    employee = relationship("Employee")
    reviewer = relationship("User")


class LeaveType(Base):
    __tablename__ = "leave_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(50), unique=True, nullable=False)  # ANNUAL, SICK, CASUAL, UNPAID
    yearly_quota = Column(Integer, nullable=False)  # 14, 8, 10, 0
    is_unpaid = Column(Boolean, default=False, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    leave_requests = relationship("LeaveRequest", back_populates="leave_type")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    __table_args__ = (
        Index("ix_leave_emp_dates", "employee_id", "start_date", "end_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id", ondelete="RESTRICT"), nullable=False, index=True)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    working_days = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(50), default="PENDING", nullable=False)  # PENDING, APPROVED, REJECTED, CANCELLED
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    review_comment = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    employee = relationship("Employee", back_populates="leave_requests")
    leave_type = relationship("LeaveType", back_populates="leave_requests")
    reviewer = relationship("User")


class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    date = Column(Date, unique=True, nullable=False, index=True)
    is_recurring = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class PayrollRun(Base):
    __tablename__ = "payroll_runs"
    __table_args__ = (
        UniqueConstraint("month", "year", name="uq_payroll_run_month_year"),
        Index("ix_payroll_month_year", "month", "year"),
    )

    id = Column(Integer, primary_key=True, index=True)
    month = Column(Integer, nullable=False)  # 1-12
    year = Column(Integer, nullable=False)
    status = Column(String(50), default="DRAFT", nullable=False)  # DRAFT, FINALIZED
    total_gross = Column(Numeric(14, 2), default=0.0, nullable=False)
    total_net = Column(Numeric(14, 2), default=0.0, nullable=False)
    total_tax = Column(Numeric(14, 2), default=0.0, nullable=False)
    total_deductions = Column(Numeric(14, 2), default=0.0, nullable=False)
    finalized_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    finalized_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    payslips = relationship("Payslip", back_populates="payroll_run", cascade="all, delete-orphan")
    finalizer = relationship("User")


class Payslip(Base):
    __tablename__ = "payslips"
    __table_args__ = (
        UniqueConstraint("payroll_run_id", "employee_id", name="uq_payslip_run_employee"),
        Index("ix_payslip_emp_month_year", "employee_id", "month", "year"),
    )

    id = Column(Integer, primary_key=True, index=True)
    payroll_run_id = Column(Integer, ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    basic_salary = Column(Numeric(12, 2), nullable=False)
    hra = Column(Numeric(12, 2), nullable=False)
    medical_allowance = Column(Numeric(12, 2), nullable=False)
    gross_salary = Column(Numeric(12, 2), nullable=False)
    working_days = Column(Integer, nullable=False)
    days_worked = Column(Float, nullable=False)
    absent_days = Column(Integer, default=0, nullable=False)
    unpaid_leave_days = Column(Integer, default=0, nullable=False)
    half_days = Column(Integer, default=0, nullable=False)
    total_deductions = Column(Numeric(12, 2), default=0.0, nullable=False)
    taxable_income = Column(Numeric(14, 2), default=0.0, nullable=False)
    tax_deducted = Column(Numeric(12, 2), default=0.0, nullable=False)
    net_salary = Column(Numeric(12, 2), nullable=False)
    pdf_path = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    payroll_run = relationship("PayrollRun", back_populates="payslips")
    employee = relationship("Employee", back_populates="payslips")


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    priority = Column(String(20), default="NORMAL", nullable=False)  # NORMAL, URGENT
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    author = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(255), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("User", back_populates="notifications")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, nullable=True, index=True)
    actor_email = Column(String(255), nullable=True)
    actor_role = Column(String(50), nullable=True)
    action = Column(String(100), nullable=False, index=True)  # CREATE, UPDATE, APPROVE, REJECT, FINALIZE, RESET, DEACTIVATE
    entity = Column(String(100), nullable=False, index=True)  # EMPLOYEE, ATTENDANCE, LEAVE, PAYROLL, SETTINGS, USER
    entity_id = Column(String(100), nullable=True)
    before_json = Column(Text, nullable=True)
    after_json = Column(Text, nullable=True)
    client_ip = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)


class AILog(Base):
    __tablename__ = "ai_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    user_role = Column(String(50), nullable=True)
    prompt = Column(Text, nullable=False)
    tool_calls_json = Column(Text, nullable=True)
    response = Column(Text, nullable=False)
    latency_ms = Column(Integer, default=0, nullable=False)
    status = Column(String(50), default="SUCCESS", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class FaceEnrollment(Base):
    __tablename__ = "face_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    descriptor_vector = Column(Text, nullable=False)  # JSON-encoded descriptor array
    enrolled_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    employee = relationship("Employee", back_populates="face_enrollment")
