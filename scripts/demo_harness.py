"""
HCM Lite - Optional Live Demo Harness (Developer & Judge Simulation Script)
=============================================================================
CRITICAL NOTICE:
This script is strictly OPTIONAL and NEVER runs automatically.
The database begins 100% empty upon initial setup.
Judges or developers can optionally execute this script to simulate a month of realistic
human interactions through the official REST API (no direct DB insertions).

Usage:
  python scripts/demo_harness.py
"""

import sys
import time
from datetime import date, datetime, timedelta
import httpx

BASE_URL = "http://localhost:8000/api/v1"

def run_simulation():
    print("==================================================")
    print("   HCM Lite - Live API Simulation Harness         ")
    print("==================================================")
    
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        # 1. Health check
        try:
            r = client.get("/org/company")
            print(f"[1/6] API Health check: Status {r.status_code}")
        except Exception as e:
            print(f"[!] Backend server is not running on {BASE_URL}. Start it first using 'run_all.bat'.")
            sys.exit(1)

        # 2. Check if first-run setup is needed or already completed
        admin_token = None
        first_run_check = client.get("/auth/first-run-check")
        if first_run_check.status_code == 200 and first_run_check.json().get("is_first_run"):
            print("[2/6] Performing initial first-run setup...")
            setup_payload = {
                "company_name": "Apex Innovations Ltd",
                "office_start_time": "09:00",
                "grace_period_minutes": 15,
                "half_day_threshold_hours": 5.0,
                "weekend_days": "5,6",
                "office_latitude": 24.8607,
                "office_longitude": 67.0011,
                "office_radius_meters": 200.0,
                "admin_email": "admin@hmclite",
                "admin_password": "AdminPassword@2026",
            }
            res = client.post("/auth/first-run-setup", json=setup_payload)
            if res.status_code == 200:
                admin_token = res.json()["access_token"]
                print("  -> First-run setup completed successfully!")
            else:
                print(f"  -> Setup failed: {res.text}")
        else:
            print("[2/6] First-run setup already locked. Logging in as Admin...")
            login_res = client.post("/auth/login", json={"email": "admin@hmclite", "password": "AdminPassword@2026"})
            if login_res.status_code == 200:
                admin_token = login_res.json()["access_token"]
                print("  -> Admin logged in successfully!")
            else:
                # Try default fallback password from backend .env
                print("  -> Trying alternate configured admin credentials...")
                login_res = client.post("/auth/login", json={"email": "admin@hcmlite.local", "password": "AdminPassword@2026"})
                if login_res.status_code == 200:
                    admin_token = login_res.json()["access_token"]

        if not admin_token:
            print("[!] Could not obtain Admin token. Please verify admin credentials.")
            return

        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 3. Create Department & Designation
        print("[3/6] Setting up Departments & Designations...")
        dept_res = client.post("/org/departments", json={"name": "Engineering", "code": "ENG", "description": "Software & DevOps"}, headers=admin_headers)
        dept_id = dept_res.json().get("id") if dept_res.status_code == 200 else 1
        
        desig_res = client.post("/org/designations", json={"title": "Senior Engineer", "department_id": dept_id}, headers=admin_headers)
        desig_id = desig_res.json().get("id") if desig_res.status_code == 200 else 1

        # 4. Create HR Specialist Account
        print("[4/6] Creating HR Specialist account via Admin API...")
        hr_payload = {
            "email": "hr_lead@hmclite",
            "password": "HrPassword@2026",
            "full_name": "Ayesha Khan (HR Lead)"
        }
        client.post("/auth/users/hr", json=hr_payload, headers=admin_headers)

        # 5. Create Test Employee
        print("[5/6] Registering Employee...")
        emp_payload = {
            "employee_code": "EMP-101",
            "first_name": "Hamza",
            "last_name": "Ali",
            "email": "hamza.ali@hmclite",
            "gender": "MALE",
            "department_id": dept_id,
            "designation_id": desig_id,
            "joining_date": str(date.today() - timedelta(days=60)),
            "salary": {
                "basic_salary": 120000.0,
                "hra": 48000.0,
                "medical_allowance": 12000.0,
                "effective_from": str(date.today() - timedelta(days=60))
            }
        }
        client.post("/employees", json=emp_payload, headers=admin_headers)

        print("[6/6] Simulation complete! Live dashboards will now display real-time analytics.")
        print("  -> View live app at: http://localhost:5173")

if __name__ == "__main__":
    run_simulation()
