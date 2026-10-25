from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=2)
    content: str = Field(..., min_length=5)
    priority: str = "NORMAL"  # NORMAL, URGENT


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    content: str
    priority: str
    author_id: Optional[int] = None
    author_email: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
