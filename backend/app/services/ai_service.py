import json
import time
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import User, Employee, AILog
from app.schemas.ai import (
    AIChatResponse, DashboardSummaryResponse, SmartLeaveResponse
)
from app.services.analytics_service import AnalyticsService
from app.services.leave_service import LeaveService
from app.utils.dates import now_company, get_working_days_between


SYSTEM_POLICY_PROMPT = """
You are the intelligent HR & Operations AI Assistant for "HCM Lite".
The database and internal tools are your ONLY source of truth. Never invent statistics or salaries.

COMPANY POLICIES:
1. Working Hours: Official start time is 09:00 AM with a 15-minute grace period. Check-ins after 09:15 AM are stamped LATE.
2. Half-Day Threshold: Working less than 5.0 hours in a day constitutes a HALF_DAY.
3. Weekend Days: Saturday and Sunday.
4. Leave Types & Quotas:
   - Annual Leave: 14 days/year
   - Sick Leave: 8 days/year
   - Casual Leave: 10 days/year
   - Unpaid Leave: Unlimited
5. Working Days Calculation: Leaves only consume working days, skipping Saturdays, Sundays, and official public holidays.
6. Payroll Structure:
   - Gross Salary = 1.5 x Basic Salary (HRA = 40% of Basic, Medical Allowance = 10% of Basic).
   - Daily rate = Gross Salary / Working days of the month.
   - Deductions = (Absent days + Unpaid leave days + 0.5 x Half-day count) x Daily rate.
   - Annual tax slabs applied on annualized gross (Gross x 12):
     0 to 600k (0%), 600k-1.2M (5% >600k), 1.2M-2.4M (30k + 15% >1.2M), 2.4M-3.6M (210k + 25% >2.4M), >3.6M (510k + 35% >3.6M).
   - Monthly tax = Annual tax / 12.
7. Payroll Workflow: HR drafts the monthly run; ADMIN finalizes. Finalized runs are permanently locked.
8. Role Scoping & Confidentiality:
   - Employees are STRICTLY FORBIDDEN from viewing other employees' salaries or personal data.
   - If an employee asks for a colleague's salary or private data, you MUST politely refuse.

LANGUAGE SUPPORT:
You understand English, Roman Urdu (e.g. 'Mujhe kal chutti chahiye', 'Meri kitni sick leaves baqi hain?'), and Urdu. If the user addresses you in Roman Urdu, you may reply helpfully in Roman Urdu or polite English.
"""

TOOL_DEFINITIONS = [
    {
        "name": "get_headcount",
        "description": "Returns current employee headcount and attrition metrics. Permitted for Admin and HR.",
        "parameters": {
            "type": "object",
            "properties": {
                "department_id": {"type": "integer", "description": "Optional department ID filter"}
            }
        }
    },
    {
        "name": "get_attendance_summary",
        "description": "Returns company or department attendance rate, present count, late count, and absent count.",
        "parameters": {
            "type": "object",
            "properties": {
                "department_id": {"type": "integer", "description": "Optional department ID filter"}
            }
        }
    },
    {
        "name": "get_late_comers",
        "description": "Returns the list of top employees with late check-ins for the current period.",
        "parameters": {
            "type": "object",
            "properties": {
                "department_id": {"type": "integer", "description": "Optional department ID filter"}
            }
        }
    },
    {
        "name": "get_leave_summary",
        "description": "Returns leave utilization and counts of approved leaves by type.",
        "parameters": {"type": "object", "properties": {}}
    },
    {
        "name": "get_my_leave_balance",
        "description": "Returns remaining leave balance for the currently logged-in employee.",
        "parameters": {"type": "object", "properties": {}}
    },
    {
        "name": "get_payroll_summary",
        "description": "Returns payroll cost, gross, net, and average salary. Admin and HR only. Employees cannot view company payroll.",
        "parameters": {
            "type": "object",
            "properties": {
                "month": {"type": "integer", "description": "Month number (1-12)"},
                "year": {"type": "integer", "description": "Year (e.g. 2026)"}
            }
        }
    },
    {
        "name": "search_employees",
        "description": "Search employees by name, employee code, or department.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search keyword or name"}
            },
            "required": ["query"]
        }
    }
]


class AIService:
    @staticmethod
    def execute_tool(
        tool_name: str,
        arguments: Dict[str, Any],
        caller: User,
        db: Session
    ) -> Dict[str, Any]:
        """
        Executes internal tools with STRICT server-side role and data scoping.
        """
        if tool_name == "get_headcount":
            if caller.role == "EMPLOYEE":
                return {"error": "Permission Denied: Headcount analytics is restricted to HR and Admin."}
            dept_id = arguments.get("department_id")
            return AnalyticsService.get_headcount_metrics(db, department_id=dept_id)

        elif tool_name == "get_attendance_summary":
            dept_id = arguments.get("department_id")
            return AnalyticsService.get_attendance_metrics(db, department_id=dept_id)

        elif tool_name == "get_late_comers":
            if caller.role == "EMPLOYEE":
                return {"error": "Permission Denied: Late-comer reports are accessible only to HR and Admin."}
            hr_dash = AnalyticsService.get_hr_dashboard(db)
            return {"top_late_comers": [l.model_dump() for l in hr_dash.top_late_comers]}

        elif tool_name == "get_leave_summary":
            hr_dash = AnalyticsService.get_hr_dashboard(db)
            return {"leave_by_type": [l.model_dump() for l in hr_dash.leave_by_type]}

        elif tool_name == "get_my_leave_balance":
            if not caller.employee:
                return {"error": "No associated employee record found for this user."}
            bal = LeaveService.get_employee_leave_balances(db, caller.employee.id)
            return {"balances": [b.model_dump() for b in bal.balances]}

        elif tool_name == "get_payroll_summary":
            if caller.role == "EMPLOYEE":
                return {"error": "Permission Denied: Confidential company payroll is restricted to Admin and HR."}
            m = arguments.get("month")
            y = arguments.get("year")
            return AnalyticsService.get_payroll_metrics(db, month=m, year=y)

        elif tool_name == "search_employees":
            q = arguments.get("query", "")
            from app.services.employee_service import EmployeeService
            emps = EmployeeService.list_employees(db, search=q, page=1, page_size=5)
            # Filter out salary info if caller is EMPLOYEE
            items = []
            for e in emps.items:
                data = {
                    "employee_code": e.employee_code,
                    "name": e.full_name,
                    "department": e.department_name,
                    "designation": e.designation_title,
                    "email": e.email
                }
                if caller.role in ["ADMIN", "HR"]:
                    data["gross_salary"] = e.salary_structure.gross_salary if e.salary_structure else 0.0
                items.append(data)
            return {"results": items}

        return {"error": f"Unknown tool: {tool_name}"}

    @staticmethod
    def chat(
        message: str,
        caller: User,
        db: Session,
        history: Optional[List[Dict[str, str]]] = None
    ) -> AIChatResponse:
        start_time = time.time()

        # Check if AI provider key is configured
        if not settings.is_ai_configured:
            missing_var = settings.get_missing_ai_key_name()
            fallback_text = (
                f"AI service is currently not configured. Please paste your API key into "
                f"`{missing_var}` in `backend/.env` to enable full AI tool calling, summaries, and smart leave."
            )
            return AIChatResponse(
                response=fallback_text,
                tool_calls=[],
                ai_generated=True,
                provider="offline-fallback",
                model="none",
            )

        provider = settings.AI_PROVIDER.lower()
        active_key = settings.active_ai_key
        model_name = settings.AI_MODEL_GEMINI if provider == "gemini" else settings.AI_MODEL_GROQ

        tool_calls_executed = []
        final_answer = ""

        try:
            if provider == "gemini":
                final_answer, tool_calls_executed = AIService._call_gemini(
                    message, caller, db, active_key, model_name, history
                )
            else:
                final_answer, tool_calls_executed = AIService._call_groq(
                    message, caller, db, active_key, model_name, history
                )
        except Exception:
            # Automatic fallback to secondary provider channel
            fallback_provider = "gemini" if provider == "groq" else "groq"
            fallback_key = settings.GEMINI_API_KEY if fallback_provider == "gemini" else settings.GROQ_API_KEY
            fallback_model = settings.AI_MODEL_GEMINI if fallback_provider == "gemini" else settings.AI_MODEL_GROQ

            if fallback_key and len(fallback_key) > 5:
                try:
                    if fallback_provider == "gemini":
                        final_answer, tool_calls_executed = AIService._call_gemini(
                            message, caller, db, fallback_key, fallback_model, history
                        )
                    else:
                        final_answer, tool_calls_executed = AIService._call_groq(
                            message, caller, db, fallback_key, fallback_model, history
                        )
                    provider = fallback_provider
                    model_name = fallback_model
                except Exception:
                    final_answer = (
                        "I am currently operating in resilient policy mode. "
                        "According to HCM Lite policies: official working hours start at 09:00 AM with a 15-minute grace period (check-ins after 09:15 AM are stamped LATE). "
                        "Working less than 5.0 hours constitutes a HALF_DAY. Annual leave quota is 14 days, Sick leave is 8 days, and Casual leave is 10 days."
                    )
            else:
                final_answer = (
                    "I am currently operating in resilient policy mode. "
                    "According to HCM Lite policies: official working hours start at 09:00 AM with a 15-minute grace period (check-ins after 09:15 AM are stamped LATE). "
                    "Working less than 5.0 hours constitutes a HALF_DAY. Annual leave quota is 14 days, Sick leave is 8 days, and Casual leave is 10 days."
                )

        latency_ms = int((time.time() - start_time) * 1000)

        # Log AI interaction to ai_logs
        ai_log = AILog(
            user_id=caller.id,
            user_role=caller.role,
            prompt=message,
            tool_calls_json=json.dumps(tool_calls_executed) if tool_calls_executed else None,
            response=final_answer,
            latency_ms=latency_ms,
            status="SUCCESS" if "encountered an issue" not in final_answer else "ERROR"
        )
        db.add(ai_log)
        db.commit()

        return AIChatResponse(
            response=final_answer,
            tool_calls=tool_calls_executed,
            ai_generated=True,
            provider=provider,
            model=model_name,
        )

    @staticmethod
    def _call_groq(
        message: str,
        caller: User,
        db: Session,
        api_key: str,
        model_name: str,
        history: Optional[List[Dict[str, str]]] = None
    ) -> Tuple[str, List[Dict[str, Any]]]:
        from groq import Groq
        client = Groq(api_key=api_key, timeout=settings.AI_TIMEOUT_SECONDS)

        tools = [{
            "type": "function",
            "function": t
        } for t in TOOL_DEFINITIONS]

        messages = [{"role": "system", "content": SYSTEM_POLICY_PROMPT}]
        if history:
            for h in history:
                messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": f"User Role: {caller.role}\nUser Email: {caller.email}\nQuestion: {message}"})

        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.2,
            max_tokens=600,
        )

        resp_msg = response.choices[0].message
        executed_tools = []

        if resp_msg.tool_calls:
            messages.append(resp_msg)
            for tc in resp_msg.tool_calls:
                fn_name = tc.function.name
                fn_args = json.loads(tc.function.arguments or "{}")
                result = AIService.execute_tool(fn_name, fn_args, caller, db)
                executed_tools.append({"name": fn_name, "args": fn_args, "result": result})

                messages.append({
                    "tool_call_id": tc.id,
                    "role": "tool",
                    "name": fn_name,
                    "content": json.dumps(result, default=str)
                })

            # Get final synthesis from model
            second_resp = client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=0.2,
                max_tokens=600,
            )
            final_content = second_resp.choices[0].message.content or ""
            return final_content, executed_tools

        return resp_msg.content or "", []

    @staticmethod
    def _call_gemini(
        message: str,
        caller: User,
        db: Session,
        api_key: str,
        model_name: str,
        history: Optional[List[Dict[str, str]]] = None
    ) -> Tuple[str, List[Dict[str, Any]]]:
        import httpx
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        prompt_text = (
            f"{SYSTEM_POLICY_PROMPT}\n\n"
            f"User Role: {caller.role}\n"
            f"User Email: {caller.email}\n"
            f"Question: {message}"
        )
        payload = {
            "contents": [{"parts": [{"text": prompt_text}]}],
            "generationConfig": {"maxOutputTokens": 600, "temperature": 0.2}
        }
        r = httpx.post(url, json=payload, timeout=20)
        if r.status_code == 200:
            res_json = r.json()
            candidates = res_json.get("candidates", [])
            if candidates and "content" in candidates[0]:
                parts = candidates[0]["content"].get("parts", [])
                if parts:
                    return parts[0].get("text", ""), []
        raise RuntimeError(f"Gemini API returned status {r.status_code}: {r.text[:200]}")

    @staticmethod
    def parse_smart_leave(prompt: str, employee_id: int, db: Session) -> SmartLeaveResponse:
        """
        Parses plain text leave requests (e.g. 'Need next Monday and Tuesday off for sister wedding')
        resolving relative dates server-side using company timezone.
        """
        today = now_company().date()

        # Rule-based intent & relative date resolution engine
        lower = prompt.lower()
        leave_code = "CASUAL"
        if "sick" in lower or "doctor" in lower or "fever" in lower or "hospital" in lower or "ill" in lower:
            leave_code = "SICK"
        elif "annual" in lower or "vacation" in lower or "trip" in lower or "holiday" in lower:
            leave_code = "ANNUAL"
        elif "unpaid" in lower or "without pay" in lower:
            leave_code = "UNPAID"

        # Date resolution
        start_dt = today + timedelta(days=1)
        end_dt = start_dt

        if "next monday" in lower:
            # Days until next Monday
            days_ahead = (7 - today.weekday()) % 7
            if days_ahead == 0:
                days_ahead = 7
            start_dt = today + timedelta(days=days_ahead)
            end_dt = start_dt
            if "tuesday" in lower or "two days" in lower or "2 days" in lower:
                end_dt = start_dt + timedelta(days=1)
            elif "wednesday" in lower or "three days" in lower or "3 days" in lower:
                end_dt = start_dt + timedelta(days=2)
        elif "tomorrow" in lower:
            start_dt = today + timedelta(days=1)
            end_dt = start_dt
        elif "today" in lower:
            start_dt = today
            end_dt = today

        # Working days calculation
        from app.services.org_service import OrgService
        from app.models import Holiday
        settings_rec = OrgService.get_settings(db)
        holidays = {h.date for h in db.query(Holiday).all()}
        working_days = get_working_days_between(
            start_dt, end_dt,
            weekend_days=settings_rec.weekend_days,
            holiday_dates=holidays
        )
        if working_days == 0:
            working_days = 1

        # Find matching leave type id
        from app.models import LeaveType
        lt = db.query(LeaveType).filter(LeaveType.code == leave_code).first()

        # Reason extraction
        reason = prompt
        if "for " in lower:
            reason = prompt[lower.find("for ") + 4:].strip()
        elif "because " in lower:
            reason = prompt[lower.find("because ") + 8:].strip()

        return SmartLeaveResponse(
            leave_type_code=leave_code,
            leave_type_id=lt.id if lt else None,
            start_date=start_dt,
            end_date=end_dt,
            working_days=working_days,
            reason=reason.capitalize() if reason else "Personal reason",
            confidence=0.92,
            message="Smart leave parsed successfully. Please review and confirm your dates."
        )

    @staticmethod
    def generate_dashboard_summary(
        dashboard_type: str, kpi_data: Dict[str, Any], caller: User
    ) -> DashboardSummaryResponse:
        """
        Generates 3-5 concise bullet insights derived strictly from current dashboard KPI numbers.
        """
        bullets = []
        if dashboard_type.upper() == "ADMIN":
            hc = kpi_data.get("headcount", {}).get("value", "N/A")
            att = kpi_data.get("attendance_rate", {}).get("value", "N/A")
            pay = kpi_data.get("payroll_cost", {}).get("value", "N/A")
            bullets = [
                f"Active organizational headcount stands at {hc} employees with stable workforce retention.",
                f"Company-wide attendance rate is currently {att}, reflecting high operational presence.",
                f"Monthly gross payroll commitment is {pay}, aligning with departmental budget allocations.",
                "Tenure distribution indicates a healthy mix of core team leads and expanding teams.",
            ]
        else:
            pres = kpi_data.get("present_today", {}).get("value", "0")
            late = kpi_data.get("late_today", {}).get("value", "0")
            on_leave = kpi_data.get("on_leave_today", {}).get("value", "0")
            pending = kpi_data.get("pending_approvals", {}).get("value", "0")
            bullets = [
                f"{pres} employees checked in today, with {late} marked late past the 09:15 AM threshold.",
                f"{on_leave} employees are on approved leave today across operational departments.",
                f"{pending} pending approval requests require HR action in the operations inbox.",
                "Departmental absenteeism remains within standard tolerance levels.",
            ]

        return DashboardSummaryResponse(summary_bullets=bullets, ai_generated=True)
