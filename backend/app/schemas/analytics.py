from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class MetricKPI(BaseModel):
    label: str
    value: Any
    unit: Optional[str] = None
    change_pct: Optional[float] = None
    change_direction: Optional[str] = "neutral"  # up, down, neutral
    tooltip: str


class ChartDataPoint(BaseModel):
    label: str
    value: float
    secondary_value: Optional[float] = None
    extra: Optional[Dict[str, Any]] = None


class LateComerItem(BaseModel):
    employee_id: int
    employee_name: str
    department_name: str
    late_count: int
    total_present_days: int
    late_percentage: float


class AttritionRiskItem(BaseModel):
    employee_id: int
    employee_name: str
    department_name: str
    risk_score: int  # 0-100
    risk_level: str  # LOW, MEDIUM, HIGH, CRITICAL
    factors: List[str]


class AbsenceAnomalyItem(BaseModel):
    employee_id: int
    employee_name: str
    department_name: str
    absent_count: int
    z_score: float
    reason_note: str


class ForecastItem(BaseModel):
    metric: str
    current_value: float
    forecasted_next_month: float
    trend: str
    note: str


class AdminDashboardResponse(BaseModel):
    kpis: Dict[str, MetricKPI]
    headcount_by_department: List[ChartDataPoint]
    payroll_cost_by_department: List[ChartDataPoint]
    monthly_payroll_trend: List[ChartDataPoint]
    gender_distribution: List[ChartDataPoint]
    tenure_distribution: List[ChartDataPoint]
    attrition_risk_hotspots: List[AttritionRiskItem]
    recent_audits: List[Dict[str, Any]]
    forecasts: List[ForecastItem]


class HRDashboardResponse(BaseModel):
    kpis: Dict[str, MetricKPI]
    attendance_trend: List[ChartDataPoint]
    absenteeism_by_department: List[ChartDataPoint]
    leave_by_type: List[ChartDataPoint]
    top_late_comers: List[LateComerItem]
    absence_anomalies: List[AbsenceAnomalyItem]
    pending_approvals: Dict[str, int]
    gender_distribution: List[ChartDataPoint] = []


class EmployeeDashboardResponse(BaseModel):
    today_status: Optional[str] = None
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    hours_this_week: float
    hours_target: float = 40.0
    late_count_this_month: int
    leave_balances: List[Dict[str, Any]]
    last_payslip: Optional[Dict[str, Any]] = None
    announcements: List[Dict[str, Any]]
