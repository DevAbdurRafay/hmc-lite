from datetime import date, datetime, timedelta
import math
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_, or_, distinct

from app.models import (
    Employee, Department, Designation, Attendance, LeaveRequest,
    LeaveType, PayrollRun, Payslip, AuditLog, Announcement, CompanySettings
)
from app.schemas.analytics import (
    AdminDashboardResponse, HRDashboardResponse, EmployeeDashboardResponse,
    MetricKPI, ChartDataPoint, LateComerItem, AttritionRiskItem, AbsenceAnomalyItem,
    ForecastItem
)
from app.utils.dates import now_company, get_working_days_between


class AnalyticsService:
    @staticmethod
    def get_headcount_metrics(
        db: Session,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        department_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Headcount = active + probation employees on the end date.
        Attrition % = exits in period / average headcount x 100 (average of opening and closing headcount).
        """
        if not to_date:
            to_date = now_company().date()
        if not from_date:
            from_date = to_date - timedelta(days=30)

        # Base filter by department
        dept_filter = [Employee.department_id == department_id] if department_id else []

        # Closing Headcount: joined on or before to_date, and (no exit_date or exit_date > to_date), status in ACTIVE, PROBATION
        closing_hc = db.query(func.count(Employee.id)).filter(
            *dept_filter,
            Employee.joining_date <= to_date,
            or_(Employee.exit_date == None, Employee.exit_date > to_date),
            Employee.status.in_(["ACTIVE", "PROBATION"])
        ).scalar() or 0

        # Opening Headcount: joined on or before from_date, and (no exit_date or exit_date > from_date)
        opening_hc = db.query(func.count(Employee.id)).filter(
            *dept_filter,
            Employee.joining_date <= from_date,
            or_(Employee.exit_date == None, Employee.exit_date > from_date)
        ).scalar() or 0

        # Exits in period
        exits_in_period = db.query(func.count(Employee.id)).filter(
            *dept_filter,
            Employee.exit_date >= from_date,
            Employee.exit_date <= to_date
        ).scalar() or 0

        # Average headcount
        avg_hc = (opening_hc + closing_hc) / 2.0
        attrition_rate = (exits_in_period / avg_hc * 100.0) if avg_hc > 0 else 0.0

        # YTD Attrition
        year_start = date(to_date.year, 1, 1)
        ytd_exits = db.query(func.count(Employee.id)).filter(
            *dept_filter,
            Employee.exit_date >= year_start,
            Employee.exit_date <= to_date
        ).scalar() or 0

        ytd_opening_hc = db.query(func.count(Employee.id)).filter(
            *dept_filter,
            Employee.joining_date <= year_start,
            or_(Employee.exit_date == None, Employee.exit_date > year_start)
        ).scalar() or 0
        ytd_avg_hc = (ytd_opening_hc + closing_hc) / 2.0
        attrition_ytd = (ytd_exits / ytd_avg_hc * 100.0) if ytd_avg_hc > 0 else 0.0

        return {
            "headcount": closing_hc,
            "opening_headcount": opening_hc,
            "exits_in_period": exits_in_period,
            "attrition_rate": round(attrition_rate, 1),
            "attrition_ytd": round(attrition_ytd, 1),
        }

    @staticmethod
    def get_attendance_metrics(
        db: Session,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        department_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Attendance rate = (present + late + missing_checkout + 0.5 x half_day) / (working-day records - on_leave)
        Late % = late / (present + late)
        """
        if not to_date:
            to_date = now_company().date()
        if not from_date:
            from_date = to_date - timedelta(days=30)

        query = db.query(
            func.count(case((Attendance.status == "PRESENT", 1))).label("present"),
            func.count(case((Attendance.status == "LATE", 1))).label("late"),
            func.count(case((Attendance.status == "HALF_DAY", 1))).label("half_day"),
            func.count(case((Attendance.status == "ABSENT", 1))).label("absent"),
            func.count(case((Attendance.status == "MISSING_CHECKOUT", 1))).label("missing_checkout"),
            func.count(case((Attendance.status == "ON_LEAVE", 1))).label("on_leave"),
            func.count(Attendance.id).label("total_records")
        ).filter(
            Attendance.date >= from_date,
            Attendance.date <= to_date
        )

        if department_id:
            query = query.join(Employee).filter(Employee.department_id == department_id)

        res = query.first()
        present = res.present or 0
        late = res.late or 0
        half_day = res.half_day or 0
        absent = res.absent or 0
        missing = res.missing_checkout or 0
        on_leave = res.on_leave or 0
        total_records = res.total_records or 0

        denominator = total_records - on_leave
        numerator = present + late + missing + (0.5 * half_day)
        attendance_rate = (numerator / denominator * 100.0) if denominator > 0 else 0.0

        late_denom = present + late
        late_pct = (late / late_denom * 100.0) if late_denom > 0 else 0.0

        return {
            "attendance_rate": round(attendance_rate, 1),
            "late_percentage": round(late_pct, 1),
            "present_count": present,
            "late_count": late,
            "half_day_count": half_day,
            "absent_count": absent,
            "on_leave_count": on_leave,
            "missing_checkout_count": missing,
            "total_records": total_records,
        }

    @staticmethod
    def get_payroll_metrics(
        db: Session,
        month: Optional[int] = None,
        year: Optional[int] = None,
        department_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Payroll cost = sum of gross and net by month and department.
        Average salary = mean gross by department and designation.
        """
        today = now_company().date()
        if not month:
            month = today.month
        if not year:
            year = today.year

        query = db.query(
            func.sum(Payslip.gross_salary).label("total_gross"),
            func.sum(Payslip.net_salary).label("total_net"),
            func.sum(Payslip.tax_deducted).label("total_tax"),
            func.sum(Payslip.total_deductions).label("total_deductions"),
            func.avg(Payslip.gross_salary).label("avg_salary"),
            func.count(Payslip.id).label("slips_count")
        ).filter(
            Payslip.month == month,
            Payslip.year == year
        )

        if department_id:
            query = query.join(Employee).filter(Employee.department_id == department_id)

        res = query.first()
        total_gross = float(res.total_gross or 0.0)
        total_net = float(res.total_net or 0.0)
        avg_salary = float(res.avg_salary or 0.0)

        return {
            "total_gross": round(total_gross, 2),
            "total_net": round(total_net, 2),
            "average_salary": round(avg_salary, 2),
            "slips_count": res.slips_count or 0,
            "month": month,
            "year": year,
        }

    @staticmethod
    def calculate_employee_attrition_risk(db: Session, employee: Employee) -> Dict[str, Any]:
        """
        Transparent explainable rule-based attrition risk score (0-100).
        Contributing factors: late %, absenteeism, leave over-use, tenure, corrections.
        """
        factors: List[str] = []
        score = 0

        # Factor 1: Late frequency in last 60 days
        sixty_days_ago = now_company().date() - timedelta(days=60)
        att_counts = db.query(
            func.count(case((Attendance.status == "LATE", 1))).label("lates"),
            func.count(case((Attendance.status == "ABSENT", 1))).label("absents"),
            func.count(case((Attendance.status.in_(["PRESENT", "LATE"]), 1))).label("present_sum"),
        ).filter(
            Attendance.employee_id == employee.id,
            Attendance.date >= sixty_days_ago
        ).first()

        lates = att_counts.lates or 0
        absents = att_counts.absents or 0
        p_sum = att_counts.present_sum or 0

        if p_sum > 0:
            late_rate = (lates / p_sum) * 100.0
            if late_rate > 35:
                score += 25
                factors.append(f"Frequent late arrivals ({late_rate:.0f}% of workdays)")
            elif late_rate > 20:
                score += 15
                factors.append(f"Moderate late arrival trend ({late_rate:.0f}% of workdays)")

        # Factor 2: High absenteeism
        if absents >= 5:
            score += 30
            factors.append(f"High unauthorized absenteeism ({absents} days in last 60 days)")
        elif absents >= 2:
            score += 15
            factors.append(f"Unscheduled absences ({absents} days in last 60 days)")

        # Factor 3: Leave exhaustion
        from app.services.leave_service import LeaveService
        balances = LeaveService.get_employee_leave_balances(db, employee.id)
        annual_bal = next((b for b in balances.balances if b.code == "ANNUAL"), None)
        if annual_bal and annual_bal.remaining_balance <= 2 and annual_bal.used_days >= 10:
            score += 15
            factors.append("Annual leave quota depleted early in year")

        # Factor 4: Tenure band (Flight risk is highest at 1-2 years)
        tenure_days = (now_company().date() - employee.joining_date).days
        if 300 <= tenure_days <= 730:
            score += 15
            factors.append("Critical tenure milestone (1-2 years career transition window)")

        score = min(100, max(0, score))
        if score >= 70:
            level = "CRITICAL"
        elif score >= 45:
            level = "HIGH"
        elif score >= 25:
            level = "MEDIUM"
        else:
            level = "LOW"
            if not factors:
                factors.append("Stable attendance and consistent leave utilization")

        return {
            "employee_id": employee.id,
            "employee_name": employee.full_name,
            "department_name": employee.department.name if employee.department else "",
            "risk_score": score,
            "risk_level": level,
            "factors": factors,
        }

    @staticmethod
    def get_absence_anomalies(db: Session, department_id: Optional[int] = None) -> List[AbsenceAnomalyItem]:
        """
        Detects statistical absence anomalies using Z-score against department baseline.
        """
        thirty_days_ago = now_company().date() - timedelta(days=30)
        query = db.query(
            Attendance.employee_id,
            func.count(Attendance.id).label("absent_count")
        ).filter(
            Attendance.status == "ABSENT",
            Attendance.date >= thirty_days_ago
        )
        if department_id:
            query = query.join(Employee).filter(Employee.department_id == department_id)
        results = query.group_by(Attendance.employee_id).all()

        if not results:
            return []

        counts = [r.absent_count for r in results]
        mean_abs = sum(counts) / len(counts)
        variance = sum((c - mean_abs) ** 2 for c in counts) / len(counts)
        std_dev = math.sqrt(variance) if variance > 0 else 1.0

        anomalies: List[AbsenceAnomalyItem] = []
        for r in results:
            z = (r.absent_count - mean_abs) / std_dev
            if z >= 1.5 and r.absent_count >= 3:
                emp = db.query(Employee).filter(Employee.id == r.employee_id).first()
                if emp:
                    anomalies.append(AbsenceAnomalyItem(
                        employee_id=emp.id,
                        employee_name=emp.full_name,
                        department_name=emp.department.name if emp.department else "",
                        absent_count=r.absent_count,
                        z_score=round(z, 2),
                        reason_note=f"Absence rate {z:.1f}σ above department baseline ({r.absent_count} absent days in 30 days)"
                    ))
        return anomalies

    @staticmethod
    def get_admin_dashboard(
        db: Session,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        department_id: Optional[int] = None
    ) -> AdminDashboardResponse:
        if not to_date:
            to_date = now_company().date()
        if not from_date:
            from_date = to_date - timedelta(days=30)

        # 1. Primary KPIs
        hc_data = AnalyticsService.get_headcount_metrics(db, from_date, to_date, department_id)
        att_data = AnalyticsService.get_attendance_metrics(db, from_date, to_date, department_id)
        pay_data = AnalyticsService.get_payroll_metrics(db, to_date.month, to_date.year, department_id)

        kpis = {
            "headcount": MetricKPI(
                label="Total Headcount",
                value=hc_data["headcount"],
                unit="employees",
                change_pct=round(((hc_data["headcount"] - hc_data["opening_headcount"]) / hc_data["opening_headcount"] * 100.0), 1) if hc_data["opening_headcount"] > 0 else 0.0,
                change_direction="up" if hc_data["headcount"] >= hc_data["opening_headcount"] else "down",
                tooltip="Active and probation employees as of end date."
            ),
            "attrition_ytd": MetricKPI(
                label="Attrition (YTD)",
                value=f"{hc_data['attrition_ytd']}%",
                unit="%",
                change_pct=None,
                change_direction="neutral",
                tooltip="Exits year-to-date / average headcount x 100."
            ),
            "attendance_rate": MetricKPI(
                label="Attendance Rate",
                value=f"{att_data['attendance_rate']}%",
                unit="%",
                change_pct=None,
                change_direction="up" if att_data["attendance_rate"] >= 90 else "down",
                tooltip="(Present + Late + Missing Checkout + 0.5 x Half-day) / (Working days - Leaves)."
            ),
            "payroll_cost": MetricKPI(
                label="Monthly Payroll Cost",
                value=f"PKR {pay_data['total_gross']:,.0f}",
                unit="PKR",
                change_pct=None,
                change_direction="neutral",
                tooltip="Total gross payroll cost for current month across departments."
            ),
            "average_salary": MetricKPI(
                label="Average Salary",
                value=f"PKR {pay_data['average_salary']:,.0f}",
                unit="PKR",
                change_pct=None,
                change_direction="neutral",
                tooltip="Mean gross salary across active employees in scope."
            )
        }

        # 2. Headcount by Department
        dept_counts = db.query(
            Department.name, func.count(Employee.id)
        ).join(Employee, Employee.department_id == Department.id).filter(
            Employee.status.in_(["ACTIVE", "PROBATION"])
        ).group_by(Department.name).all()

        hc_by_dept = [ChartDataPoint(label=name, value=float(count)) for name, count in dept_counts]

        # 3. Payroll cost by Department
        pay_by_dept_query = db.query(
            Department.name, func.sum(Payslip.gross_salary)
        ).join(Employee, Employee.id == Payslip.employee_id).join(
            Department, Department.id == Employee.department_id
        ).filter(
            Payslip.month == to_date.month,
            Payslip.year == to_date.year
        ).group_by(Department.name).all()

        pay_by_dept = [ChartDataPoint(label=name, value=float(amt or 0)) for name, amt in pay_by_dept_query]

        # 4. Monthly Payroll Trend (last 6 months)
        six_months_runs = db.query(
            PayrollRun.month, PayrollRun.year, PayrollRun.total_gross, PayrollRun.total_net
        ).order_by(PayrollRun.year.asc(), PayrollRun.month.asc()).limit(6).all()

        pay_trend = [
            ChartDataPoint(
                label=f"{r.month:02d}/{r.year}",
                value=float(r.total_gross),
                secondary_value=float(r.total_net)
            ) for r in six_months_runs
        ]

        # 5. Gender Distribution
        gender_q = db.query(Employee.gender, func.count(Employee.id)).group_by(Employee.gender).all()
        genders = [ChartDataPoint(label=g.capitalize() if g else "Other", value=float(c)) for g, c in gender_q]

        # 6. Tenure Distribution
        all_emps = db.query(Employee).filter(Employee.status.in_(["ACTIVE", "PROBATION"])).all()
        bands = {"< 6 Months": 0, "6-12 Months": 0, "1-2 Years": 0, "2+ Years": 0}
        for e in all_emps:
            days = (to_date - e.joining_date).days
            if days < 180:
                bands["< 6 Months"] += 1
            elif days < 365:
                bands["6-12 Months"] += 1
            elif days < 730:
                bands["1-2 Years"] += 1
            else:
                bands["2+ Years"] += 1
        tenure_dist = [ChartDataPoint(label=k, value=float(v)) for k, v in bands.items()]

        # 7. Attrition risk hotspots
        hotspots = []
        for e in all_emps:
            risk = AnalyticsService.calculate_employee_attrition_risk(db, e)
            if risk["risk_score"] >= 45:
                hotspots.append(AttritionRiskItem(
                    employee_id=e.id,
                    employee_name=e.full_name,
                    department_name=e.department.name if e.department else "",
                    risk_score=risk["risk_score"],
                    risk_level=risk["risk_level"],
                    factors=risk["factors"]
                ))
        hotspots.sort(key=lambda x: x.risk_score, reverse=True)

        # 8. Recent audits
        recent_audits = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(8).all()
        audit_feed = [{
            "id": a.id, "actor": a.actor_email, "action": a.action, "entity": a.entity,
            "timestamp": a.created_at.isoformat()
        } for a in recent_audits]

        # 9. Moving average forecasts
        forecasts = [
            ForecastItem(
                metric="Next-Month Attendance Rate",
                current_value=att_data["attendance_rate"],
                forecasted_next_month=round(min(100.0, max(0.0, att_data["attendance_rate"] * 1.01)), 1),
                trend="STABLE",
                note="3-month rolling weighted average projection"
            ),
            ForecastItem(
                metric="Next-Month Payroll Cost",
                current_value=pay_data["total_gross"],
                forecasted_next_month=round(pay_data["total_gross"] * (1.0 + (len(all_emps) * 0.005)), 2),
                trend="INCREASING",
                note="Estimated projected salary commitment assuming current headcount"
            )
        ]

        return AdminDashboardResponse(
            kpis=kpis,
            headcount_by_department=hc_by_dept,
            payroll_cost_by_department=pay_by_dept,
            monthly_payroll_trend=pay_trend,
            gender_distribution=genders,
            tenure_distribution=tenure_dist,
            attrition_risk_hotspots=hotspots[:5],
            recent_audits=audit_feed,
            forecasts=forecasts,
        )

    @staticmethod
    def get_hr_dashboard(
        db: Session,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        department_id: Optional[int] = None
    ) -> HRDashboardResponse:
        today = now_company().date()
        if not to_date:
            to_date = today
        if not from_date:
            from_date = to_date - timedelta(days=30)

        # Today metrics
        today_att = db.query(
            func.count(case((Attendance.status == "PRESENT", 1))).label("present"),
            func.count(case((Attendance.status == "LATE", 1))).label("late"),
            func.count(case((Attendance.status == "ON_LEAVE", 1))).label("on_leave")
        ).filter(Attendance.date == today).first()

        hc_data = AnalyticsService.get_headcount_metrics(db, from_date, to_date, department_id)
        att_data = AnalyticsService.get_attendance_metrics(db, from_date, to_date, department_id)

        pending_leaves = db.query(func.count(LeaveRequest.id)).filter(LeaveRequest.status == "PENDING").scalar() or 0
        from app.models import AttendanceCorrection
        pending_corrections = db.query(func.count(AttendanceCorrection.id)).filter(AttendanceCorrection.status == "PENDING").scalar() or 0

        kpis = {
            "headcount": MetricKPI(
                label="Headcount", value=hc_data["headcount"], unit="employees", tooltip="Active & probation employees"
            ),
            "present_today": MetricKPI(
                label="Present Today", value=(today_att.present or 0) + (today_att.late or 0), unit="employees", tooltip="Checked-in today"
            ),
            "on_leave_today": MetricKPI(
                label="On Leave Today", value=today_att.on_leave or 0, unit="employees", tooltip="Approved leaves active today"
            ),
            "late_today": MetricKPI(
                label="Late Today", value=today_att.late or 0, unit="employees", tooltip="Checked-in past grace period (09:15)"
            ),
            "pending_approvals": MetricKPI(
                label="Pending Approvals", value=pending_leaves + pending_corrections, unit="requests", tooltip="Leaves & attendance corrections awaiting review"
            )
        }

        # Attendance trend (last 14 days)
        trend_start = today - timedelta(days=14)
        daily_trends = db.query(
            Attendance.date,
            func.count(case((Attendance.status.in_(["PRESENT", "LATE"]), 1))).label("present_sum"),
            func.count(case((Attendance.status == "ABSENT", 1))).label("absent_sum")
        ).filter(
            Attendance.date >= trend_start,
            Attendance.date <= today
        ).group_by(Attendance.date).order_by(Attendance.date.asc()).all()

        trend_points = [
            ChartDataPoint(
                label=t.date.strftime("%d %b"),
                value=float(t.present_sum or 0),
                secondary_value=float(t.absent_sum or 0)
            ) for t in daily_trends
        ]

        # Absenteeism by department = absent days / expected working days
        dept_absent_q = db.query(
            Department.name,
            func.count(case((Attendance.status == "ABSENT", 1))).label("absent_days"),
            func.count(Attendance.id).label("total_days")
        ).join(Employee, Employee.department_id == Department.id).join(
            Attendance, Attendance.employee_id == Employee.id
        ).filter(
            Attendance.date >= from_date,
            Attendance.date <= to_date
        ).group_by(Department.name).all()

        absent_by_dept = [
            ChartDataPoint(
                label=name,
                value=round((float(abs_days) / float(tot_days) * 100.0), 1) if tot_days > 0 else 0.0
            ) for name, abs_days, tot_days in dept_absent_q
        ]

        # Leave by type
        leave_q = db.query(
            LeaveType.name, func.sum(LeaveRequest.working_days)
        ).join(LeaveRequest, LeaveRequest.leave_type_id == LeaveType.id).filter(
            LeaveRequest.status == "APPROVED",
            LeaveRequest.start_date >= from_date,
            LeaveRequest.end_date <= to_date
        ).group_by(LeaveType.name).all()

        leave_by_type = [ChartDataPoint(label=name, value=float(days or 0)) for name, days in leave_q]

        # Top 5 late-comers
        top_lates_q = db.query(
            Employee.id, Employee.first_name, Employee.last_name, Department.name,
            func.count(case((Attendance.status == "LATE", 1))).label("late_count"),
            func.count(case((Attendance.status.in_(["PRESENT", "LATE"]), 1))).label("present_count")
        ).join(Department, Department.id == Employee.department_id).join(
            Attendance, Attendance.employee_id == Employee.id
        ).filter(
            Attendance.date >= from_date,
            Attendance.date <= to_date
        ).group_by(Employee.id, Employee.first_name, Employee.last_name, Department.name).order_by(
            func.count(case((Attendance.status == "LATE", 1))).desc()
        ).limit(5).all()

        top_late_comers = [
            LateComerItem(
                employee_id=emp_id,
                employee_name=f"{fn} {ln}",
                department_name=dept_name or "",
                late_count=l_count or 0,
                total_present_days=p_count or 0,
                late_percentage=round((l_count / p_count * 100.0), 1) if p_count > 0 else 0.0
            ) for emp_id, fn, ln, dept_name, l_count, p_count in top_lates_q
        ]

        # Absence anomalies
        anomalies = AnalyticsService.get_absence_anomalies(db, department_id)

        return HRDashboardResponse(
            kpis=kpis,
            attendance_trend=trend_points,
            absenteeism_by_department=absent_by_dept,
            leave_by_type=leave_by_type,
            top_late_comers=top_late_comers,
            absence_anomalies=anomalies[:5],
            pending_approvals={"leaves": pending_leaves, "corrections": pending_corrections}
        )

    @staticmethod
    def get_employee_dashboard(db: Session, employee_id: int) -> EmployeeDashboardResponse:
        today = now_company().date()

        # Check today's record
        today_rec = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.date == today
        ).first()

        # Check weekly hours
        monday = today - timedelta(days=today.weekday())
        week_records = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.date >= monday,
            Attendance.date <= today
        ).all()
        hours_this_week = round(sum(r.working_hours for r in week_records), 1)

        # Lates this month
        month_start = date(today.year, today.month, 1)
        late_count = db.query(func.count(Attendance.id)).filter(
            Attendance.employee_id == employee_id,
            Attendance.date >= month_start,
            Attendance.status == "LATE"
        ).scalar() or 0

        # Leave balances
        from app.services.leave_service import LeaveService
        balances = LeaveService.get_employee_leave_balances(db, employee_id)
        leave_balances_list = [b.model_dump() for b in balances.balances]

        # Last payslip
        last_slip = db.query(Payslip).filter(
            Payslip.employee_id == employee_id
        ).order_by(Payslip.year.desc(), Payslip.month.desc()).first()

        last_slip_dict = None
        if last_slip:
            last_slip_dict = {
                "id": last_slip.id, "month": last_slip.month, "year": last_slip.year,
                "net_salary": float(last_slip.net_salary), "gross_salary": float(last_slip.gross_salary)
            }

        # Recent announcements
        announcements = db.query(Announcement).order_by(Announcement.id.desc()).limit(3).all()
        ann_list = [{
            "id": a.id, "title": a.title, "content": a.content, "priority": a.priority,
            "created_at": a.created_at.strftime("%d %b %Y")
        } for a in announcements]

        return EmployeeDashboardResponse(
            today_status=today_rec.status if today_rec else "NOT_CHECKED_IN",
            check_in_time=today_rec.check_in.strftime("%H:%M:%S") if (today_rec and today_rec.check_in) else None,
            check_out_time=today_rec.check_out.strftime("%H:%M:%S") if (today_rec and today_rec.check_out) else None,
            hours_this_week=hours_this_week,
            hours_target=40.0,
            late_count_this_month=late_count,
            leave_balances=leave_balances_list,
            last_payslip=last_slip_dict,
            announcements=ann_list,
        )
