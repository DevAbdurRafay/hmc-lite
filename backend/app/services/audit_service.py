import json
from datetime import datetime, timezone
from typing import Any, Optional
from sqlalchemy.orm import Session
from app.models import AuditLog, User


class AuditService:
    @staticmethod
    def log(
        db: Session,
        action: str,
        entity: str,
        entity_id: Optional[str] = None,
        actor: Optional[User] = None,
        before_obj: Optional[Any] = None,
        after_obj: Optional[Any] = None,
        client_ip: Optional[str] = None,
    ) -> AuditLog:
        before_json = None
        after_json = None

        if before_obj is not None:
            if isinstance(before_obj, str):
                before_json = before_obj
            elif isinstance(before_obj, dict):
                before_json = json.dumps(before_obj, default=str)
            else:
                before_json = json.dumps(getattr(before_obj, "__dict__", {}), default=str)

        if after_obj is not None:
            if isinstance(after_obj, str):
                after_json = after_obj
            elif isinstance(after_obj, dict):
                after_json = json.dumps(after_obj, default=str)
            else:
                after_json = json.dumps(getattr(after_obj, "__dict__", {}), default=str)

        log_entry = AuditLog(
            actor_id=actor.id if actor else None,
            actor_email=actor.email if actor else "system",
            actor_role=actor.role if actor else "SYSTEM",
            action=action.upper(),
            entity=entity.upper(),
            entity_id=str(entity_id) if entity_id is not None else None,
            before_json=before_json,
            after_json=after_json,
            client_ip=client_ip,
            created_at=datetime.now(timezone.utc),
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry
