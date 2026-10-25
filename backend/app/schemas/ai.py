from datetime import date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class AIChatMessage(BaseModel):
    role: str  # user | assistant | system
    content: str


class AIChatRequest(BaseModel):
    message: str
    history: Optional[List[AIChatMessage]] = []


class AIChatResponse(BaseModel):
    response: str
    tool_calls: Optional[List[Dict[str, Any]]] = None
    ai_generated: bool = True
    provider: str
    model: str


class DashboardSummaryRequest(BaseModel):
    dashboard_type: str = "HR"  # HR | ADMIN
    kpi_data: Dict[str, Any]
    filters: Optional[Dict[str, Any]] = None


class DashboardSummaryResponse(BaseModel):
    summary_bullets: List[str]
    ai_generated: bool = True


class SmartLeaveParseRequest(BaseModel):
    prompt: str


class SmartLeaveResponse(BaseModel):
    leave_type_code: str  # CASUAL, SICK, ANNUAL, UNPAID
    leave_type_id: Optional[int] = None
    start_date: date
    end_date: date
    working_days: int
    reason: str
    confidence: float
    message: str
