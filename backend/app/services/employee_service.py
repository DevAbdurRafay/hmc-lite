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

        # 5. Optional Biometric Face Enrollment upon registration
        if hasattr(data, 'face_image_data') and data.face_image_data:
            from app.models import FaceEnrollment
            from app.services.attendance_service import _extract_biometric_vector
            import json
            vec = _extract_biometric_vector(data.face_image_data)
            if vec is not None:
                enrollment = FaceEnrollment(
                    employee_id=employee.id,
                    descriptor_vector=json.dumps(vec.tolist())
                )
                db.add(enrollment)

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

        # Synchronize employee active/deactivated state with user account authentication
        if "status" in update_dict and emp.user:
            new_status = (emp.status or "").upper()
            if new_status in ("TERMINATED", "INACTIVE", "DEACTIVATED", "RESIGNED"):
                emp.user.is_active = False
                emp.user.token_version = (getattr(emp.user, "token_version", 1) or 1) + 1
            elif new_status in ("ACTIVE", "PROBATION"):
                emp.user.is_active = True

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
    def _parse_flexible_date(date_str: str) -> Optional[date]:
        if not date_str:
            return None
        date_str = str(date_str).strip()
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d", "%d.%m.%Y", "%Y%m%d"):
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        return None

    @staticmethod
    def _get_flexible_val(row: Dict[str, Any], *aliases: str) -> str:
        norm_map = {k.lower().strip().replace(" ", "").replace("_", "").replace("-", ""): v for k, v in row.items() if k is not None}
        for alias in aliases:
            a_norm = alias.lower().strip().replace(" ", "").replace("_", "").replace("-", "")
            if a_norm in norm_map and norm_map[a_norm] is not None:
                val = str(norm_map[a_norm]).strip()
                if val:
                    return val
        return ""

    @staticmethod
    def dry_run_csv_import(db: Session, csv_content: str) -> CSVDryRunResponse:
        clean_content = csv_content.lstrip("\ufeff")
        reader = csv.DictReader(io.StringIO(clean_content))
        errors: List[CSVDryRunError] = []
        preview: List[Dict[str, Any]] = []

        row_num = 1
        valid_rows_count = 0
        unique_emp_codes = set()

        for row in reader:
            row_num += 1

            code = EmployeeService._get_flexible_val(row, "employee_code", "emp_code", "employee_id", "emp_id", "empid", "code", "id")
            fname = EmployeeService._get_flexible_val(row, "first_name", "fname", "firstname")
            lname = EmployeeService._get_flexible_val(row, "last_name", "lname", "lastname")
            full_name = EmployeeService._get_flexible_val(row, "name", "full_name", "employee_name", "emp_name")

            if not fname and full_name:
                parts = full_name.split(" ", 1)
                fname = parts[0]
                lname = parts[1] if len(parts) > 1 else "Employee"
            elif not fname:
                fname = f"Staff_{row_num}"

            if not lname:
                lname = "Member"

            if not code:
                code = f"EMP-{row_num:04d}"

            email = EmployeeService._get_flexible_val(row, "email", "work_email", "email_address", "mail").lower()
            if not email:
                clean_c = re.sub(r"[^a-zA-Z0-9]", "", code.lower())
                email = f"{clean_c}@hcmlite.app"

            dept_code = EmployeeService._get_flexible_val(row, "department_code", "dept_code", "department", "dept", "department_name").upper() or "GENERAL"
            desig_title = EmployeeService._get_flexible_val(row, "designation_title", "designation", "job_title", "title", "role", "position").upper() or "STAFF"
            join_date_str = EmployeeService._get_flexible_val(row, "joining_date", "join_date", "date_of_joining", "doj", "start_date", "date", "attendance_date")
            salary_str = EmployeeService._get_flexible_val(row, "basic_salary", "basic", "salary", "base_salary", "gross_salary", "pay", "ctc")

            parsed_date = EmployeeService._parse_flexible_date(join_date_str) if join_date_str else date.today()

            clean_sal = re.sub(r"[^\d.]", "", salary_str) if salary_str else "50000"
            try:
                sal = float(clean_sal) if clean_sal else 50000.0
            except Exception:
                sal = 50000.0

            valid_rows_count += 1
            unique_emp_codes.add(code.upper())

            if len(preview) < 5 and code.upper() not in [p.get("employee_code") for p in preview]:
                preview.append({
                    "employee_code": code,
                    "first_name": fname,
                    "last_name": lname,
                    "email": email,
                    "department_code": dept_code,
                    "designation_title": desig_title,
                    "joining_date": str(parsed_date or date.today()),
                    "basic_salary": f"{sal:,.0f}",
                })

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
        clean_content = csv_content.lstrip("\ufeff")
        reader = csv.DictReader(io.StringIO(clean_content))

        # 1. Pre-load cache
        depts_by_name = {d.name.upper(): d.id for d in db.query(Department).all()}
        depts_by_code = {d.code.upper(): d.id for d in db.query(Department).all()}
        desigs_by_title = {d.title.upper(): d.id for d in db.query(Designation).all()}

        # Existing employees and users
        existing_employees_by_code = {e.employee_code.upper(): e for e in db.query(Employee).all()}
        existing_users_by_email = {u.email.lower(): u.id for u in db.query(User).all()}

        # 2. Pre-compute default password hash once (prevents 90 minutes of repeated bcrypt hashing!)
        shared_pwd_hash = get_password_hash("Employee@2026!")

        new_employees_count = 0
        synced_employees_count = 0
        attendance_records_created = 0

        # Unique employees registry to deduplicate rows
        unique_emp_specs: Dict[str, Dict[str, Any]] = {}
        attendance_batch = []

        row_num = 1
        for row in reader:
            row_num += 1

            code = (EmployeeService._get_flexible_val(row, "employee_code", "emp_code", "employee_id", "emp_id", "empid", "code", "id") or f"EMP-{row_num:04d}").upper()
            raw_name = EmployeeService._get_flexible_val(row, "name", "full_name", "employee_name", "emp_name")
            fname = EmployeeService._get_flexible_val(row, "first_name", "fname", "firstname")
            lname = EmployeeService._get_flexible_val(row, "last_name", "lname", "lastname")

            if not fname and raw_name:
                parts = raw_name.split(" ", 1)
                fname = parts[0]
                lname = parts[1] if len(parts) > 1 else "Employee"
            elif not fname:
                fname = f"Staff_{row_num}"

            if not lname:
                lname = "Member"

            email = EmployeeService._get_flexible_val(row, "email", "work_email", "email_address", "mail").lower()
            if not email:
                clean_c = re.sub(r"[^a-zA-Z0-9]", "", code.lower())
                email = f"{clean_c}@hcmlite.app"

            dept_val = (EmployeeService._get_flexible_val(row, "department_code", "dept_code", "department", "dept", "department_name") or "GENERAL").upper()
            desig_val = (EmployeeService._get_flexible_val(row, "designation_title", "designation", "job_title", "title", "role", "position") or "STAFF").upper()
            join_date_str = EmployeeService._get_flexible_val(row, "joining_date", "join_date", "date_of_joining", "doj", "start_date", "date", "attendance_date")
            salary_str = EmployeeService._get_flexible_val(row, "basic_salary", "basic", "salary", "base_salary", "gross_salary", "pay", "ctc")

            clean_sal = re.sub(r"[^\d.]", "", salary_str) if salary_str else "50000"
            try:
                basic_sal = float(clean_sal) if clean_sal else 50000.0
            except Exception:
                basic_sal = 50000.0

            parsed_date = EmployeeService._parse_flexible_date(join_date_str) or date.today()

            # Store unique employee profile
            if code not in unique_emp_specs:
                unique_emp_specs[code] = {
                    "code": code,
                    "first_name": fname,
                    "last_name": lname,
                    "email": email,
                    "department": dept_val,
                    "designation": desig_val,
                    "basic_salary": basic_sal,
                    "joining_date": parsed_date,
                    "phone": EmployeeService._get_flexible_val(row, "phone", "phone_number", "mobile") or None,
                    "address": EmployeeService._get_flexible_val(row, "address") or None,
                    "gender": (EmployeeService._get_flexible_val(row, "gender", "sex").upper() or "OTHER") if EmployeeService._get_flexible_val(row, "gender", "sex").upper() in ("MALE", "FEMALE") else "OTHER",
                    "status": (EmployeeService._get_flexible_val(row, "status").upper() or "ACTIVE") if EmployeeService._get_flexible_val(row, "status").upper() in ("ACTIVE", "PROBATION", "RESIGNED", "TERMINATED") else "ACTIVE",
                }

            # If attendance date and status are present in this row
            date_col = EmployeeService._get_flexible_val(row, "attendance_date", "date", "punch_date")
            status_col = (EmployeeService._get_flexible_val(row, "attendance_status", "status", "present_status") or "").upper()
            if date_col:
                att_date = EmployeeService._parse_flexible_date(date_col)
                if att_date:
                    if status_col not in ("PRESENT", "LATE", "HALF_DAY", "ABSENT", "ON_LEAVE", "MISSING_CHECKOUT"):
                        status_col = "PRESENT"
                    attendance_batch.append((code, att_date, status_col))

        # 3. Create any missing departments
        for emp in unique_emp_specs.values():
            d_name = emp["department"]
            if d_name not in depts_by_name and d_name not in depts_by_code:
                new_d = Department(
                    name=d_name.title(),
                    code=d_name[:10].upper(),
                    description=f"Auto-created department from CSV import ({d_name})"
                )
                db.add(new_d)
                db.flush()
                depts_by_name[d_name] = new_d.id
                depts_by_code[new_d.code.upper()] = new_d.id

        # 4. Create any missing designations
        for emp in unique_emp_specs.values():
            des_name = emp["designation"]
            if des_name not in desigs_by_title:
                dept_id = depts_by_name.get(emp["department"]) or depts_by_code.get(emp["department"])
                new_des = Designation(
                    title=des_name.title(),
                    department_id=dept_id,
                    description=f"Auto-created designation from CSV import ({des_name})"
                )
                db.add(new_des)
                db.flush()
                desigs_by_title[des_name] = new_des.id

        # 5. Insert new unique employees or sync existing
        emp_id_by_code: Dict[str, int] = {}

        for code, spec in unique_emp_specs.items():
            dept_id = depts_by_name.get(spec["department"]) or depts_by_code.get(spec["department"])
            desig_id = desigs_by_title.get(spec["designation"])

            if code in existing_employees_by_code:
                emp_obj = existing_employees_by_code[code]
                emp_id_by_code[code] = emp_obj.id
                synced_employees_count += 1
            else:
                user_email = spec["email"]
                if user_email in existing_users_by_email:
                    clean_c = re.sub(r"[^a-zA-Z0-9]", "", code.lower())
                    user_email = f"{clean_c}_{user_email}"

                new_user = User(
                    email=user_email,
                    hashed_password=shared_pwd_hash,
                    role="EMPLOYEE",
                    is_active=True,
                    must_change_password=True,
                )
                db.add(new_user)
                db.flush()
                existing_users_by_email[user_email] = new_user.id

                new_emp = Employee(
                    user_id=new_user.id,
                    employee_code=code,
                    first_name=spec["first_name"],
                    last_name=spec["last_name"],
                    email=user_email,
                    phone=spec["phone"],
                    address=spec["address"],
                    gender=spec["gender"],
                    department_id=dept_id,
                    designation_id=desig_id,
                    joining_date=spec["joining_date"],
                    status=spec["status"],
                )
                db.add(new_emp)
                db.flush()
                existing_employees_by_code[code] = new_emp
                emp_id_by_code[code] = new_emp.id
                new_employees_count += 1

                basic = spec["basic_salary"]
                sal_struct = SalaryStructure(
                    employee_id=new_emp.id,
                    basic_salary=basic,
                    hra=basic * 0.40,
                    medical_allowance=basic * 0.10,
                    other_allowances=0.0,
                    gross_salary=basic * 1.50,
                    effective_date=spec["joining_date"],
                )
                db.add(sal_struct)

        # 6. Bulk insert attendance records if present in the file
        if attendance_batch:
            emp_ids = list(emp_id_by_code.values())
            existing_att = set(
                db.query(Attendance.employee_id, Attendance.date)
                .filter(Attendance.employee_id.in_(emp_ids))
                .all()
            )

            new_att_objects = []
            for code, a_date, a_status in attendance_batch:
                e_id = emp_id_by_code.get(code)
                if e_id and (e_id, a_date) not in existing_att:
                    existing_att.add((e_id, a_date))
                    new_att_objects.append(
                        Attendance(
                            employee_id=e_id,
                            date=a_date,
                            status=a_status,
                            source="CSV",
                            working_hours=8.0 if a_status in ("PRESENT", "LATE") else (4.0 if a_status == "HALF_DAY" else 0.0),
                        )
                    )
            if new_att_objects:
                db.bulk_save_objects(new_att_objects)
                attendance_records_created = len(new_att_objects)

        db.commit()

        AuditService.log(
            db, action="IMPORT_CSV", entity="EMPLOYEES",
            actor=actor,
            after_obj={
                "new_employees": new_employees_count,
                "synced_employees": synced_employees_count,
                "attendance_records": attendance_records_created,
                "total_rows_processed": row_num - 1
            },
            client_ip=client_ip
        )

        return {
            "imported_count": new_employees_count + synced_employees_count,
            "new_count": new_employees_count,
            "synced_count": synced_employees_count,
            "attendance_count": attendance_records_created,
            "total_rows": row_num - 1,
            "message": f"Successfully ingested {new_employees_count} new employees and {attendance_records_created} attendance logs from {row_num - 1} records without error."
        }

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
