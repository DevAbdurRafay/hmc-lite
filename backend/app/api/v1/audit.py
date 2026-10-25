from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.models import User, AuditLog
from app.schemas.audit import AuditLogResponse
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/audit", tags=["Audit Log"])


@router.get("/logs", response_model=PaginatedResponse[AuditLogResponse])
def list_audit_logs(
    action: Optional[str] = None,
    entity: Optional[str] = None,
    page: int = 1,
    page_size: int = 30,
    admin_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    """
    Admin only: View immutable, append-only audit trail.
    Records actor, action, entity, before_json, after_json, timestamp, and IP.
    """
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action.upper())
    if entity:
        query = query.filter(AuditLog.entity == entity.upper())

    total = query.count()
    items = query.order_by(AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 1
    return PaginatedResponse(
        items=[
            AuditLogResponse(
                id=a.id,
                actor_id=a.actor_id,
                actor_email=a.actor_email,
                actor_role=a.actor_role,
                action=a.action,
                entity=a.entity,
                entity_id=a.entity_id,
                before_json=a.before_json,
                after_json=a.after_json,
                client_ip=a.client_ip,
                created_at=a.created_at,
            ) for a in items
        ],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )
