from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    actor_id: Optional[int] = None
    actor_email: Optional[str] = None
    actor_role: Optional[str] = None
    action: str
    entity: str
    entity_id: Optional[str] = None
    before_json: Optional[str] = None
    after_json: Optional[str] = None
    client_ip: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
