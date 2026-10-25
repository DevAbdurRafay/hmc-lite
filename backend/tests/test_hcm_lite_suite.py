import pytest
from datetime import date, datetime, timedelta
from app.core.security import get_password_hash, create_access_token
from app.models import (
    User, Employee, Department, Designation, LeaveType, Holiday,
    Attendance, SalaryStructure, PayrollRun, Payslip
)
from app.services.payroll_service import PayrollService
from app.services.ai_service import AIService
from app.services.employee_service import EmployeeService
from app.utils.dates import get_working_days_between
from app.utils.geo import haversine_distance_meters


def test_first_run_setup_and_lock(client, db):
    # Setup company and admin
    resp = client.post("/api/v1/auth/setup", json={
        "company_name": "Saylani Tech Solutions",
        "admin_email": "admin@hcmlite.com",
        "admin_password": "StrongPassword123!",
        "office_start_time": "09:00",
        "grace_period_minutes": 15,
        "half_day_threshold_hours": 5.0,
        "weekend_days": "5,6",
        "office_latitude": 24.8607,
        "office_longitude": 67.0011,
        "office_radius_meters": 150.0
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["role"] == "ADMIN"
    assert "access_token" in data

    # Attempt second setup -> Must be locked!
    second_resp = client.post("/api/v1/auth/setup", json={
        "company_name": "Hacked Setup",
        "admin_email": "fake@hcmlite.com",
        "admin_password": "FakePassword123!",
    })
    assert second_resp.status_code == 400
    assert second_resp.json()["detail"]["code"] == "SETUP_LOCKED"


def test_rbac_and_scope_enforcement(client, db):
    # Create Admin, HR, Employee1, Employee2
    admin_user = User(email="admin_rbac@test.com", hashed_password=get_password_hash("pass123"), role="ADMIN")
    hr_user = User(email="hr_rbac@test.com", hashed_password=get_password_hash("pass123"), role="HR")
    emp1_user = User(email="emp1@test.com", hashed_password=get_password_hash("pass123"), role="EMPLOYEE")
    emp2_user = User(email="emp2@test.com", hashed_password=get_password_hash("pass123"), role="EMPLOYEE")
    db.add_all([admin_user, hr_user, emp1_user, emp2_user])
    db.flush()

    dept = Department(name="Engineering", code="ENG")
    db.add(dept)
    db.flush()
    desig = Designation(title="Software Engineer", department_id=dept.id)
    db.add(desig)
    db.flush()

    e1 = Employee(user_id=emp1_user.id, employee_code="EMP001", first_name="Ali", last_name="Khan", email="emp1@test.com", department_id=dept.id, designation_id=desig.id, joining_date=date(2026, 1, 1), status="ACTIVE")
    e2 = Employee(user_id=emp2_user.id, employee_code="EMP002", first_name="Bilal", last_name="Ahmed", email="emp2@test.com", department_id=dept.id, designation_id=desig.id, joining_date=date(2026, 1, 1), status="ACTIVE")
    db.add_all([e1, e2])
    db.commit()

    token_emp1 = create_access_token({"sub": str(emp1_user.id), "role": "EMPLOYEE", "email": emp1_user.email})
    token_hr = create_access_token({"sub": str(hr_user.id), "role": "HR", "email": hr_user.email})

    # Employee 1 can read own profile
    resp_own = client.get(f"/api/v1/employees/{e1.id}", headers={"Authorization": f"Bearer {token_emp1}"})
    assert resp_own.status_code == 200

    # Employee 1 CANNOT read Employee 2's profile -> 403 Forbidden!
    resp_other = client.get(f"/api/v1/employees/{e2.id}", headers={"Authorization": f"Bearer {token_emp1}"})
    assert resp_other.status_code == 403
    assert resp_other.json()["detail"]["code"] == "SCOPE_FORBIDDEN"

    # HR cannot finalize payroll -> 403 Forbidden!
    resp_hr_fin = client.post("/api/v1/payroll/runs/1/finalize", headers={"Authorization": f"Bearer {token_hr}"})
    assert resp_hr_fin.status_code == 403


def test_attendance_rules(client, db):
    user = User(email="attend_user@test.com", hashed_password=get_password_hash("pass"), role="EMPLOYEE")
    db.add(user)
    db.flush()
    dept = Department(name="Ops", code="OPS")
    db.add(dept)
    db.flush()
    desig = Designation(title="Executive", department_id=dept.id)
    db.add(desig)
    db.flush()
    emp = Employee(user_id=user.id, employee_code="EMP101", first_name="Zahid", last_name="Hussain", email="attend_user@test.com", department_id=dept.id, designation_id=desig.id, joining_date=date(2026, 1, 1), status="ACTIVE")
    db.add(emp)
    db.commit()

    token = create_access_token({"sub": str(user.id), "role": "EMPLOYEE", "email": user.email})

    # 1. Geofence violation test (office is at 24.8607, 67.0011; send coordinates far away e.g. Lahore 31.5204, 74.3587)
    dist = haversine_distance_meters(24.8607, 67.0011, 31.5204, 74.3587)
    assert dist > 100000.0  # > 100km

    resp_geo = client.post("/api/v1/attendance/check-in", json={
        "latitude": 31.5204, "longitude": 74.3587, "accuracy": 20.0, "source": "CAMERA", "face_detected": True
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp_geo.status_code == 422
    assert resp_geo.json()["detail"]["code"] == "GEOFENCE_VIOLATION"

    # 2. Inaccurate GPS test (> 100m)
    resp_acc = client.post("/api/v1/attendance/check-in", json={
        "latitude": 24.8607, "longitude": 67.0011, "accuracy": 150.0, "source": "CAMERA", "face_detected": True
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp_acc.status_code == 422
    assert resp_acc.json()["detail"]["code"] == "GPS_INACCURATE"

    # 3. Successful check-in (at office)
    resp_success = client.post("/api/v1/attendance/check-in", json={
        "latitude": 24.8607, "longitude": 67.0011, "accuracy": 15.0, "source": "CAMERA", "face_detected": True
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp_success.status_code == 200

    # 4. Duplicate check-in on the same day -> Must return HTTP 409 Conflict!
    resp_dup = client.post("/api/v1/attendance/check-in", json={
        "source": "WEB"
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp_dup.status_code == 409
    assert resp_dup.json()["detail"]["code"] == "ALREADY_CHECKED_IN"


def test_leave_working_days_and_rules(db):
    # Holiday on Monday 2026-05-04
    holidays = {date(2026, 5, 4)}
    # Range Friday 2026-05-01 to Tuesday 2026-05-05:
    # Fri (working 1), Sat (weekend), Sun (weekend), Mon (holiday), Tue (working 2) -> Exactly 2 working days!
    w_days = get_working_days_between(
        date(2026, 5, 1), date(2026, 5, 5),
        weekend_days="5,6",
        holiday_dates=holidays
    )
    assert w_days == 2


def test_payroll_formulas_and_tax_slabs():
    # Tax slabs test:
    # 0 to 600k = 0
    assert PayrollService.calculate_annual_tax(500000.0) == 0.0

    # 600k to 1.2M = 5% of excess
    # 1,000,000 -> 5% of 400k = 20,000
    assert PayrollService.calculate_annual_tax(1000000.0) == 20000.0

    # 1.2M to 2.4M = 30k + 15% of excess
    # 1,500,000 -> 30k + 15% of 300k = 30k + 45k = 75,000
    assert PayrollService.calculate_annual_tax(1500000.0) == 75000.0


def test_csv_dry_run_validation(db):
    # Missing fields and bad email
    bad_csv = """employee_code,first_name,last_name,email,department_code,designation_title,joining_date,basic_salary
,Ali,Khan,invalid_email,NONEXISTENT,INVALID_DESIG,not-a-date,-500
"""
    result = EmployeeService.dry_run_csv_import(db, bad_csv)
    assert result.is_valid is False
    assert result.error_count > 0
    fields_with_errors = {e.field for e in result.errors}
    assert "employee_code" in fields_with_errors
    assert "email" in fields_with_errors
    assert "joining_date" in fields_with_errors
    assert "basic_salary" in fields_with_errors


def test_ai_tool_scope_protection(db):
    emp_user = User(email="regular_emp@test.com", hashed_password="pw", role="EMPLOYEE")
    db.add(emp_user)
    db.commit()

    # Employee asks tool for headcount -> Refused!
    hc_res = AIService.execute_tool("get_headcount", {}, emp_user, db)
    assert "error" in hc_res
    assert "Permission Denied" in hc_res["error"]

    # Employee asks tool for payroll summary -> Refused!
    pay_res = AIService.execute_tool("get_payroll_summary", {}, emp_user, db)
    assert "error" in pay_res
    assert "Permission Denied" in pay_res["error"]
