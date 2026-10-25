import csv
import io
import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.core.security import get_password_hash, generate_temporary_password
from app.models import (
    Employee, User, Department, Designation, SalaryStructure,
    Attendance, LeaveRequest, Payslip
)
from app.schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeSelfUpdate, EmployeeResponse,
    EmployeeRegistrationResponse, Employee360Response, CSVDryRunResponse,
    CSVDryRunError, SalaryStructureResponse
)
from app.schemas.common import PaginatedResponse
from app.services.audit_service import AuditService


class EmployeeService:
    @staticmethod
    def register_employee(
        db: Session, data: EmployeeCreate, actor: User, client_ip: Optional[str] = None
    ) -> EmployeeRegistrationResponse:
        # 1. Validation checks
        existing_email = db.query(User).filter(User.email == data.email.strip().lower()).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "EMAIL_EXISTS", "message": f"User with email '{data.email}' already exists"}
            )
        existing_code = db.query(Employee).filter(Employee.employee_code == data.employee_code.strip()).first()
        if existing_code:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "CODE_EXISTS", "message": f"Employee code '{data.employee_code}' already exists"}
            )
        dept = db.query(Department).filter(Department.id == data.department_id).first()
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "DEPT_NOT_FOUND", "message": "Department not found"}
            )
        desig = db.query(Designation).filter(Designation.id == data.designation_id).first()
        if not desig:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "DESIG_NOT_FOUND", "message": "Designation not found"}
            )

        # 2. Create User account with temporary password
        temp_password = generate_temporary_password()
        user = User(
            email=data.email.strip().lower(),
            hashed_password=get_password_hash(temp_password),
            role="EMPLOYEE",
            is_active=True,
            must_change_password=True,
        )
        db.add(user)
        db.flush()

        # 3. Create Employee profile
        employee = Employee(
            user_id=user.id,
            employee_code=data.employee_code.strip(),
            first_name=data.first_name.strip(),
            last_name=data.last_name.strip(),
            email=data.email.strip().lower(),
            phone=data.phone.strip() if data.phone else None,
            address=data.address.strip() if data.address else None,
            gender=data.gender.upper() if data.gender else "OTHER",
            department_id=dept.id,
            designation_id=desig.id,
            joining_date=data.joining_date,
            status=data.status.upper() if data.status else "ACTIVE",
            emergency_contact=data.emergency_contact,
        )
        db.add(employee)
        db.flush()

        # 4. Create Salary Structure: Gross = 1.5 * Basic (HRA 40%, Medical 10%)
        basic = float(data.basic_salary)
        hra = basic * 0.40
        medical = basic * 0.10
        gross = basic * 1.50

        salary_struct = SalaryStructure(
            employee_id=employee.id,
            basic_salary=basic,
            hra=hra,
            medical_allowance=medical,
            other_allowances=0.0,
            gross_salary=gross,
            effective_date=data.joining_date,
        )
        db.add(salary_struct)
        db.commit()
        db.refresh(employee)

        AuditService.log(
            db, action="CREATE", entity="EMPLOYEE", entity_id=str(employee.id),
            actor=actor, after_obj={"code": employee.employee_code, "name": employee.full_name},
            client_ip=client_ip
        )

        emp_resp = EmployeeService._build_employee_response(employee)
        return EmployeeRegistrationResponse(
            employee=emp_resp,
            temporary_password=temp_password,
            message="Employee registered successfully. Temporary login credentials created."
        )

    @staticmethod
    def _build_employee_response(employee: Employee) -> EmployeeResponse:
        sal_resp = None
        if employee.salary_structure:
            sal_resp = SalaryStructureResponse(
                id=employee.salary_structure.id,
                employee_id=employee.salary_structure.employee_id,
                basic_salary=float(employee.salary_structure.basic_salary),
                hra=float(employee.salary_structure.hra),
                medical_allowance=float(employee.salary_structure.medical_allowance),
                other_allowances=float(employee.salary_structure.other_allowances),
                gross_salary=float(employee.salary_structure.gross_salary),
                effective_date=employee.salary_structure.effective_date,
            )

        return EmployeeResponse(
            id=employee.id,
            user_id=employee.user_id,
            employee_code=employee.employee_code,
            first_name=employee.first_name,
            last_name=employee.last_name,
            full_name=employee.full_name,
            email=employee.email,
            phone=employee.phone,
            address=employee.address,
            gender=employee.gender,
            department_id=employee.department_id,
            department_name=employee.department.name if employee.department else None,
            designation_id=employee.designation_id,
            designation_title=employee.designation.title if employee.designation else None,
            joining_date=employee.joining_date,
            exit_date=employee.exit_date,
            status=employee.status,
            emergency_contact=employee.emergency_contact,
            salary_structure=sal_resp,
        )

    @staticmethod
    def get_employee(db: Session, employee_id: int) -> EmployeeResponse:
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "EMPLOYEE_NOT_FOUND", "message": f"Employee {employee_id} not found"}
            )
        return EmployeeService._build_employee_response(employee)

    @staticmethod
    def list_employees(
        db: Session,
        search: Optional[str] = None,
        department_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> PaginatedResponse[EmployeeResponse]:
        query = db.query(Employee)
        if search:
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Employee.first_name.ilike(term),
                    Employee.last_name.ilike(term),
                    Employee.employee_code.ilike(term),
                    Employee.email.ilike(term)
                )
            )
        if department_id:
            query = query.filter(Employee.department_id == department_id)
        if status_filter:
            query = query.filter(Employee.status == status_filter.upper())

        total = query.count()
        items = query.order_by(Employee.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
        responses = [EmployeeService._build_employee_response(emp) for emp in items]

        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 1
        return PaginatedResponse(
            items=responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )

    @staticmethod
    def update_employee(
        db: Session, employee_id: int, data: EmployeeUpdate, actor: User, client_ip: Optional[str] = None
    ) -> EmployeeResponse:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Employee not found"})

        before_dict = {
            "first_name": emp.first_name, "last_name": emp.last_name, "status": emp.status,
            "department_id": emp.department_id, "designation_id": emp.designation_id
        }
        update_dict = data.model_dump(exclude_unset=True)
        for key, val in update_dict.items():
            setattr(emp, key, val)

        db.commit()
        db.refresh(emp)

        AuditService.log(
            db, action="UPDATE", entity="EMPLOYEE", entity_id=str(emp.id),
            actor=actor, before_obj=before_dict, after_obj=update_dict, client_ip=client_ip
        )
        return EmployeeService._build_employee_response(emp)

    @staticmethod
    def self_update_employee(
        db: Session, employee_id: int, data: EmployeeSelfUpdate, actor: User, client_ip: Optional[str] = None
    ) -> EmployeeResponse:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Employee not found"})

        before_dict = {"phone": emp.phone, "address": emp.address, "emergency_contact": emp.emergency_contact}
        if data.phone is not None:
            emp.phone = data.phone.strip()
        if data.address is not None:
            emp.address = data.address.strip()
        if data.emergency_contact is not None:
            emp.emergency_contact = data.emergency_contact.strip()

        db.commit()
        db.refresh(emp)

        AuditService.log(
            db, action="UPDATE", entity="EMPLOYEE_PROFILE", entity_id=str(emp.id),
            actor=actor, before_obj=before_dict,
            after_obj={"phone": emp.phone, "address": emp.address, "emergency_contact": emp.emergency_contact},
            client_ip=client_ip
        )
        return EmployeeService._build_employee_response(emp)

    @staticmethod
    def get_employee_360(db: Session, employee_id: int) -> Employee360Response:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Employee not found"})

        # Attendance breakdown
        att_counts = db.query(
            Attendance.status, func.count(Attendance.id)
        ).filter(Attendance.employee_id == employee_id).group_by(Attendance.status).all()
        att_dict = {status: count for status, count in att_counts}

        # Leave summary
        leaves = db.query(LeaveRequest).filter(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status == "APPROVED"
        ).all()
        total_leave_days = sum(l.working_days for l in leaves)

        # Payslip summary
        payslips = db.query(Payslip).filter(Payslip.employee_id == employee_id).order_by(Payslip.year.desc(), Payslip.month.desc()).limit(6).all()
        recent_slips = [{
            "month": p.month, "year": p.year, "net_salary": float(p.net_salary), "gross_salary": float(p.gross_salary)
        } for p in payslips]

        # Explainable Attrition Risk Score (0-100)
        from app.services.analytics_service import AnalyticsService
        attrition_risk = AnalyticsService.calculate_employee_attrition_risk(db, emp)

        return Employee360Response(
            employee=EmployeeService._build_employee_response(emp),
            attendance_summary={
                "present": att_dict.get("PRESENT", 0),
                "late": att_dict.get("LATE", 0),
                "half_day": att_dict.get("HALF_DAY", 0),
                "absent": att_dict.get("ABSENT", 0),
                "on_leave": att_dict.get("ON_LEAVE", 0),
                "missing_checkout": att_dict.get("MISSING_CHECKOUT", 0),
            },
            leave_summary={"approved_leave_days_ytd": total_leave_days},
            payroll_summary={"recent_payslips": recent_slips},
            attrition_risk=attrition_risk,
        )

    @staticmethod
    def dry_run_csv_import(db: Session, csv_content: str) -> CSVDryRunResponse:
        reader = csv.DictReader(io.StringIO(csv_content))
        errors: List[CSVDryRunError] = []
        preview: List[Dict[str, Any]] = []

        departments = {d.code.upper(): d.id for d in db.query(Department).all()}
        designations = {d.title.upper(): (d.id, d.department_id) for d in db.query(Designation).all()}

        existing_emails = {u.email.lower() for u in db.query(User.email).all()}
        existing_codes = {e.employee_code.upper() for e in db.query(Employee.employee_code).all()}

        seen_codes_in_file = set()
        seen_emails_in_file = set()

        row_num = 1
        valid_rows_count = 0
        email_regex = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")

        for row in reader:
            row_num += 1
            has_error = False

            # Required fields
            code = (row.get("employee_code") or "").strip()
            fname = (row.get("first_name") or "").strip()
            lname = (row.get("last_name") or "").strip()
            email = (row.get("email") or "").strip().lower()
            dept_code = (row.get("department_code") or "").strip().upper()
            desig_title = (row.get("designation_title") or "").strip().upper()
            join_date_str = (row.get("joining_date") or "").strip()
            salary_str = (row.get("basic_salary") or "").strip()

            if not code:
                errors.append(CSVDryRunError(row=row_num, field="employee_code", reason="Employee code is required"))
                has_error = True
            elif code.upper() in existing_codes or code.upper() in seen_codes_in_file:
                errors.append(CSVDryRunError(row=row_num, field="employee_code", reason=f"Employee code '{code}' already exists"))
                has_error = True
            seen_codes_in_file.add(code.upper())

            if not email:
                errors.append(CSVDryRunError(row=row_num, field="email", reason="Email is required"))
                has_error = True
            elif not email_regex.match(email):
                errors.append(CSVDryRunError(row=row_num, field="email", reason=f"Email '{email}' is invalid"))
                has_error = True
            elif email in existing_emails or email in seen_emails_in_file:
                errors.append(CSVDryRunError(row=row_num, field="email", reason=f"Email '{email}' is already registered"))
                has_error = True
            seen_emails_in_file.add(email)

            if not fname:
                errors.append(CSVDryRunError(row=row_num, field="first_name", reason="First name is required"))
                has_error = True
            if not lname:
                errors.append(CSVDryRunError(row=row_num, field="last_name", reason="Last name is required"))
                has_error = True

            if not dept_code or dept_code not in departments:
                errors.append(CSVDryRunError(row=row_num, field="department_code", reason=f"Unknown department '{dept_code}'"))
                has_error = True

            if not desig_title or desig_title not in designations:
                errors.append(CSVDryRunError(row=row_num, field="designation_title", reason=f"Unknown designation '{desig_title}'"))
                has_error = True

            try:
                datetime.strptime(join_date_str, "%Y-%m-%d")
            except Exception:
                errors.append(CSVDryRunError(row=row_num, field="joining_date", reason="Date must be valid ISO format (YYYY-MM-DD)"))
                has_error = True

            try:
                sal = float(salary_str)
                if sal <= 0:
                    errors.append(CSVDryRunError(row=row_num, field="basic_salary", reason="Salary must be greater than 0"))
                    has_error = True
            except Exception:
                errors.append(CSVDryRunError(row=row_num, field="basic_salary", reason="Salary must be a valid number"))
                has_error = True

            if not has_error:
                valid_rows_count += 1

            if len(preview) < 5:
                preview.append(row)

        total_rows = row_num - 1
        return CSVDryRunResponse(
            is_valid=(len(errors) == 0 and total_rows > 0),
            total_rows=total_rows,
            valid_rows_count=valid_rows_count,
            error_count=len(errors),
            errors=errors,
            preview=preview,
        )

    @staticmethod
    def commit_csv_import(
        db: Session, csv_content: str, actor: User, client_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        dry_run = EmployeeService.dry_run_csv_import(db, csv_content)
        if not dry_run.is_valid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "CSV_VALIDATION_FAILED", "message": "CSV failed validation check", "details": [e.model_dump() for e in dry_run.errors]}
            )

        reader = csv.DictReader(io.StringIO(csv_content))
        departments = {d.code.upper(): d.id for d in db.query(Department).all()}
        designations = {d.title.upper(): d.id for d in db.query(Designation).all()}

        created_employees = []
        for row in reader:
            dept_id = departments[row["department_code"].strip().upper()]
            desig_id = designations[row["designation_title"].strip().upper()]
            join_date = datetime.strptime(row["joining_date"].strip(), "%Y-%m-%d").date()
            basic_sal = float(row["basic_salary"].strip())

            create_payload = EmployeeCreate(
                employee_code=row["employee_code"].strip(),
                first_name=row["first_name"].strip(),
                last_name=row["last_name"].strip(),
                email=row["email"].strip().lower(),
                phone=row.get("phone", "").strip() or None,
                address=row.get("address", "").strip() or None,
                gender=row.get("gender", "OTHER").strip().upper() or "OTHER",
                department_id=dept_id,
                designation_id=desig_id,
                joining_date=join_date,
                status=row.get("status", "ACTIVE").strip().upper() or "ACTIVE",
                emergency_contact=row.get("emergency_contact", "").strip() or None,
                basic_salary=basic_sal,
            )
            reg_resp = EmployeeService.register_employee(db, create_payload, actor, client_ip)
            created_employees.append(reg_resp.employee.employee_code)

        AuditService.log(
            db, action="IMPORT_CSV", entity="EMPLOYEES",
            actor=actor, after_obj={"imported_count": len(created_employees), "codes": created_employees},
            client_ip=client_ip
        )
        return {"imported_count": len(created_employees), "message": f"Successfully imported {len(created_employees)} employees."}

    @staticmethod
    def export_employees_csv(db: Session, department_id: Optional[int] = None) -> str:
        query = db.query(Employee)
        if department_id:
            query = query.filter(Employee.department_id == department_id)
        employees = query.order_by(Employee.id.asc()).all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "employee_code", "first_name", "last_name", "email", "phone",
            "department_code", "department_name", "designation_title",
            "joining_date", "status", "basic_salary", "gross_salary"
        ])

        for emp in employees:
            basic = float(emp.salary_structure.basic_salary) if emp.salary_structure else 0.0
            gross = float(emp.salary_structure.gross_salary) if emp.salary_structure else 0.0
            dept_code = emp.department.code if emp.department else ""
            dept_name = emp.department.name if emp.department else ""
            desig_title = emp.designation.title if emp.designation else ""

            writer.writerow([
                emp.employee_code, emp.first_name, emp.last_name, emp.email, emp.phone or "",
                dept_code, dept_name, desig_title,
                str(emp.joining_date), emp.status, basic, gross
            ])

        return output.getvalue()
