import calendar
from datetime import date, timedelta
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import (
    PayrollRun, Payslip, Employee, SalaryStructure, Attendance,
    LeaveRequest, Holiday, Notification, User, CompanySettings
)
from app.schemas.payroll import PayrollRunCreate, PayrollRunResponse, PayslipResponse
from app.services.audit_service import AuditService
from app.services.org_service import OrgService
from app.utils.dates import get_working_days_between, now_utc, now_company


class PayrollService:
    @staticmethod
    def calculate_annual_tax(annual_gross: float) -> float:
        """
        Tax slab calculation applied on annualized gross (gross x 12):
        - 0 to 600k = 0
        - 600k to 1.2M = 5% of amount > 600k
        - 1.2M to 2.4M = 30k + 15% of amount > 1.2M
        - 2.4M to 3.6M = 210k + 25% of amount > 2.4M
        - > 3.6M = 510k + 35% of amount > 3.6M
        """
        if annual_gross <= 600000:
            return 0.0
        elif annual_gross <= 1200000:
            return 0.05 * (annual_gross - 600000)
        elif annual_gross <= 2400000:
            return 30000.0 + 0.15 * (annual_gross - 1200000)
        elif annual_gross <= 3600000:
            return 210000.0 + 0.25 * (annual_gross - 2400000)
        else:
            return 510000.0 + 0.35 * (annual_gross - 3600000)

    @staticmethod
    def create_or_refresh_draft(
        db: Session, month: int, year: int, actor: User, client_ip: Optional[str] = None
    ) -> PayrollRunResponse:
        # Check if already finalized
        existing_run = db.query(PayrollRun).filter(
            PayrollRun.month == month,
            PayrollRun.year == year
        ).first()

        if existing_run and existing_run.status == "FINALIZED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "PAYROLL_LOCKED", "message": f"Payroll for {month:02d}/{year} is finalized and locked. Edits are rejected."}
            )

        settings_rec = OrgService.get_settings(db)
        holidays = {h.date for h in db.query(Holiday).all()}

        # Calculate working days of the month
        _, last_day = calendar.monthrange(year, month)
        start_month = date(year, month, 1)
        end_month = date(year, month, last_day)

        month_working_days = get_working_days_between(
            start_month, end_month,
            weekend_days=settings_rec.weekend_days,
            holiday_dates=holidays
        )
        if month_working_days <= 0:
            month_working_days = 22  # Standard working days fallback

        if not existing_run:
            payroll_run = PayrollRun(month=month, year=year, status="DRAFT")
            db.add(payroll_run)
            db.flush()
        else:
            payroll_run = existing_run
            # Clear old draft payslips
            db.query(Payslip).filter(Payslip.payroll_run_id == payroll_run.id).delete()
            db.flush()

        # Find eligible employees
        employees = db.query(Employee).filter(
            Employee.status.in_(["ACTIVE", "PROBATION"]),
            Employee.joining_date <= end_month,
        ).all()

        total_gross_sum = 0.0
        total_net_sum = 0.0
        total_tax_sum = 0.0
        total_deductions_sum = 0.0
        created_payslips = []

        for emp in employees:
            if not emp.salary_structure:
                continue

            basic = float(emp.salary_structure.basic_salary)
            hra = float(emp.salary_structure.hra)
            med = float(emp.salary_structure.medical_allowance)
            gross = float(emp.salary_structure.gross_salary)

            # Proration if joined mid-month
            emp_working_days = month_working_days
            if emp.joining_date > start_month:
                emp_working_days = get_working_days_between(
                    emp.joining_date, end_month,
                    weekend_days=settings_rec.weekend_days,
                    holiday_dates=holidays
                )
                if month_working_days > 0:
                    gross = gross * (emp_working_days / month_working_days)
                    basic = gross / 1.5
                    hra = basic * 0.40
                    med = basic * 0.10

            per_day_rate = gross / emp_working_days if emp_working_days > 0 else 0.0

            # Count attendance statuses
            attendance_records = db.query(Attendance).filter(
                Attendance.employee_id == emp.id,
                Attendance.date >= start_month,
                Attendance.date <= end_month
            ).all()

            att_map = {a.date: a for a in attendance_records}
            present_days = 0.0
            absent_days = 0
            half_days = 0
            late_days = 0

            # Iterate working dates
            curr = max(start_month, emp.joining_date)
            weekends = {int(x.strip()) for x in settings_rec.weekend_days.split(",") if x.strip()}
            while curr <= end_month:
                if curr.weekday() not in weekends and curr not in holidays:
                    rec = att_map.get(curr)
                    if rec:
                        if rec.status == "PRESENT":
                            present_days += 1.0
                        elif rec.status == "LATE":
                            present_days += 1.0
                            late_days += 1
                        elif rec.status == "HALF_DAY":
                            half_days += 1
                            present_days += 0.5
                        elif rec.status == "ABSENT":
                            absent_days += 1
                        elif rec.status == "ON_LEAVE":
                            pass  # covered in leave check
                    else:
                        # Check approved leave
                        approved_leave = db.query(LeaveRequest).filter(
                            LeaveRequest.employee_id == emp.id,
                            LeaveRequest.status == "APPROVED",
                            LeaveRequest.start_date <= curr,
                            LeaveRequest.end_date >= curr
                        ).first()
                        if not approved_leave:
                            absent_days += 1
                curr += timedelta(days=1)

            # Unpaid leave days
            unpaid_leaves = db.query(LeaveRequest).join(LeaveRequest.leave_type).filter(
                LeaveRequest.employee_id == emp.id,
                LeaveRequest.status == "APPROVED",
                LeaveRequest.leave_type.has(is_unpaid=True),
                LeaveRequest.start_date <= end_month,
                LeaveRequest.end_date >= start_month
            ).all()
            unpaid_leave_days = sum(l.working_days for l in unpaid_leaves)

            # Deductions: absent days + unpaid leave days + 0.5 x half days
            deduction_factor = absent_days + unpaid_leave_days + (0.5 * half_days)

            # Bonus late-penalty rule (if enabled: 3 lates = 0.5 day deduction)
            if settings_rec.late_penalty_enabled and late_days >= 3:
                penalty_days = (late_days // 3) * 0.5
                deduction_factor += penalty_days

            deductions = round(deduction_factor * per_day_rate, 2)
            deductions = min(deductions, gross)

            # Annualized gross & monthly tax
            annualized_gross = gross * 12.0
            annual_tax = PayrollService.calculate_annual_tax(annualized_gross)
            monthly_tax = round(annual_tax / 12.0, 2)

            net_salary = max(0.0, round(gross - deductions - monthly_tax, 2))

            payslip = Payslip(
                payroll_run_id=payroll_run.id,
                employee_id=emp.id,
                month=month,
                year=year,
                basic_salary=round(basic, 2),
                hra=round(hra, 2),
                medical_allowance=round(med, 2),
                gross_salary=round(gross, 2),
                working_days=emp_working_days,
                days_worked=present_days,
                absent_days=absent_days,
                unpaid_leave_days=unpaid_leave_days,
                half_days=half_days,
                total_deductions=deductions,
                taxable_income=annualized_gross,
                tax_deducted=monthly_tax,
                net_salary=net_salary,
            )
            db.add(payslip)
            created_payslips.append(payslip)

            total_gross_sum += gross
            total_net_sum += net_salary
            total_tax_sum += monthly_tax
            total_deductions_sum += deductions

        payroll_run.total_gross = round(total_gross_sum, 2)
        payroll_run.total_net = round(total_net_sum, 2)
        payroll_run.total_tax = round(total_tax_sum, 2)
        payroll_run.total_deductions = round(total_deductions_sum, 2)

        db.commit()
        db.refresh(payroll_run)

        AuditService.log(
            db, action="DRAFT_PAYROLL", entity="PAYROLL", entity_id=str(payroll_run.id),
            actor=actor, after_obj={"month": month, "year": year, "total_net": total_net_sum},
            client_ip=client_ip
        )
        return PayrollService._build_payroll_run_response(payroll_run)

    @staticmethod
    def finalize_payroll(
        db: Session, payroll_run_id: int, admin_actor: User, client_ip: Optional[str] = None
    ) -> PayrollRunResponse:
        payroll_run = db.query(PayrollRun).filter(PayrollRun.id == payroll_run_id).first()
        if not payroll_run:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Payroll run not found"})

        if payroll_run.status == "FINALIZED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": "ALREADY_FINALIZED", "message": "This payroll run is already finalized and locked."})

        payroll_run.status = "FINALIZED"
        payroll_run.finalized_by_id = admin_actor.id
        payroll_run.finalized_at = now_utc()

        # Send in-app notification to all employees whose payslip was prepared
        payslips = db.query(Payslip).filter(Payslip.payroll_run_id == payroll_run.id).all()
        for p in payslips:
            emp = p.employee
            if emp and emp.user_id:
                notif = Notification(
                    user_id=emp.user_id,
                    title=f"Payslip Ready: {payroll_run.month:02d}/{payroll_run.year}",
                    message=f"Your payslip for {payroll_run.month:02d}/{payroll_run.year} is now available for download. Net Pay: PKR {p.net_salary:,.2f}",
                    link=f"/payroll/payslips/{p.id}",
                )
                db.add(notif)

        db.commit()
        db.refresh(payroll_run)

        AuditService.log(
            db, action="FINALIZE_PAYROLL", entity="PAYROLL", entity_id=str(payroll_run.id),
            actor=admin_actor, after_obj={"month": payroll_run.month, "year": payroll_run.year, "status": "FINALIZED"},
            client_ip=client_ip
        )
        return PayrollService._build_payroll_run_response(payroll_run)

    @staticmethod
    def get_payroll_run(db: Session, run_id: int) -> PayrollRunResponse:
        payroll_run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
        if not payroll_run:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Payroll run not found"})
        return PayrollService._build_payroll_run_response(payroll_run)

    @staticmethod
    def list_payroll_runs(db: Session) -> List[PayrollRunResponse]:
        runs = db.query(PayrollRun).order_by(PayrollRun.year.desc(), PayrollRun.month.desc()).all()
        return [PayrollService._build_payroll_run_response(r) for r in runs]

    @staticmethod
    def get_payslip(db: Session, payslip_id: int) -> PayslipResponse:
        slip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
        if not slip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Payslip not found"})
        return PayrollService._build_payslip_response(slip)

    @staticmethod
    def list_employee_payslips(db: Session, employee_id: int) -> List[PayslipResponse]:
        slips = db.query(Payslip).filter(
            Payslip.employee_id == employee_id
        ).order_by(Payslip.year.desc(), Payslip.month.desc()).all()
        return [PayrollService._build_payslip_response(s) for s in slips]

    @staticmethod
    def _build_payslip_response(slip: Payslip) -> PayslipResponse:
        emp = slip.employee
        return PayslipResponse(
            id=slip.id,
            payroll_run_id=slip.payroll_run_id,
            employee_id=slip.employee_id,
            employee_code=emp.employee_code if emp else None,
            employee_name=emp.full_name if emp else None,
            department_name=emp.department.name if emp and emp.department else None,
            designation_title=emp.designation.title if emp and emp.designation else None,
            month=slip.month,
            year=slip.year,
            basic_salary=float(slip.basic_salary),
            hra=float(slip.hra),
            medical_allowance=float(slip.medical_allowance),
            gross_salary=float(slip.gross_salary),
            working_days=slip.working_days,
            days_worked=float(slip.days_worked),
            absent_days=slip.absent_days,
            unpaid_leave_days=slip.unpaid_leave_days,
            half_days=slip.half_days,
            total_deductions=float(slip.total_deductions),
            taxable_income=float(slip.taxable_income),
            tax_deducted=float(slip.tax_deducted),
            net_salary=float(slip.net_salary),
            pdf_path=slip.pdf_path,
            created_at=slip.created_at,
        )

    @staticmethod
    def _build_payroll_run_response(run: PayrollRun) -> PayrollRunResponse:
        payslip_items = [PayrollService._build_payslip_response(p) for p in run.payslips] if run.payslips else []
        return PayrollRunResponse(
            id=run.id,
            month=run.month,
            year=run.year,
            status=run.status,
            total_gross=float(run.total_gross),
            total_net=float(run.total_net),
            total_tax=float(run.total_tax),
            total_deductions=float(run.total_deductions),
            finalized_by_id=run.finalized_by_id,
            finalized_at=run.finalized_at,
            created_at=run.created_at,
            payslips=payslip_items,
        )
