from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, limiter
from app.models import User
from app.schemas.ai import (
    AIChatRequest, AIChatResponse, DashboardSummaryRequest,
    DashboardSummaryResponse, SmartLeaveParseRequest, SmartLeaveResponse
)
from app.services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


@router.post("/chat", response_model=AIChatResponse)
@limiter.limit(f"{settings.AI_RATE_LIMIT_PER_HOUR}/hour")
def ai_chat(
    data: AIChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    AI Assistant chat endpoint.
    Performs tool calling against verified database services with strict caller role-scoping.
    """
    history_dicts = [{"role": m.role, "content": m.content} for m in data.history] if data.history else []
    return AIService.chat(
        message=data.message,
        caller=current_user,
        db=db,
        history=history_dicts
    )


@router.post("/summary", response_model=DashboardSummaryResponse)
def generate_dashboard_summary(
    data: DashboardSummaryRequest,
    current_user: User = Depends(require_roles(["ADMIN", "HR"])),
    db: Session = Depends(get_db)
):
    """Admin/HR: Generate 3-5 concise bullet insights derived strictly from current dashboard KPI numbers."""
    return AIService.generate_dashboard_summary(
        dashboard_type=data.dashboard_type,
        kpi_data=data.kpi_data,
        caller=current_user
    )


@router.post("/smart-leave", response_model=SmartLeaveResponse)
def parse_smart_leave(
    data: SmartLeaveParseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Employee/HR: Parses plain natural language sentence (e.g. 'Need next Monday and Tuesday off for sister wedding')
    into pre-filled leave form dates and working day calculations.
    """
    emp_id = current_user.employee.id if current_user.employee else 0
    return AIService.parse_smart_leave(data.prompt, emp_id, db)
