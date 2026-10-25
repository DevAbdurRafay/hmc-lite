from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models import Announcement, Notification, User
from app.schemas.comms import (
    AnnouncementCreate, AnnouncementResponse, NotificationResponse
)
from app.services.audit_service import AuditService

router = APIRouter(prefix="/comms", tags=["Communications & Notifications"])


@router.get("/announcements", response_model=List[AnnouncementResponse])
def list_announcements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all company announcements. Visible to all roles."""
    announcements = db.query(Announcement).order_by(Announcement.id.desc()).all()
    return [
        AnnouncementResponse(
            id=a.id,
            title=a.title,
            content=a.content,
            priority=a.priority,
            author_id=a.author_id,
            author_email=a.author.email if a.author else None,
            created_at=a.created_at,
        ) for a in announcements
    ]


@router.post("/announcements", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
def create_announcement(
    data: AnnouncementCreate,
    request: Request,
    current_user: User = Depends(require_roles(["ADMIN", "HR"])),
    db: Session = Depends(get_db)
):
    """Admin/HR: Post a company announcement."""
    ann = Announcement(
        title=data.title.strip(),
        content=data.content.strip(),
        priority=data.priority.upper(),
        author_id=current_user.id,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)

    client_ip = request.client.host if request.client else None
    AuditService.log(
        db, action="CREATE", entity="ANNOUNCEMENT", entity_id=str(ann.id),
        actor=current_user, after_obj={"title": ann.title, "priority": ann.priority},
        client_ip=client_ip
    )

    return AnnouncementResponse(
        id=ann.id,
        title=ann.title,
        content=ann.content,
        priority=ann.priority,
        author_id=ann.author_id,
        author_email=current_user.email,
        created_at=ann.created_at,
    )


@router.get("/notifications", response_model=List[NotificationResponse])
def list_my_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List notifications for current user with unread status."""
    notifs = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.id.desc()).limit(30).all()

    return [
        NotificationResponse(
            id=n.id,
            title=n.title,
            message=n.message,
            link=n.link,
            is_read=n.is_read,
            created_at=n.created_at,
        ) for n in notifs
    ]


@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a notification as read."""
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Notification not found"})

    notif.is_read = True
    db.commit()
    db.refresh(notif)

    return NotificationResponse(
        id=notif.id,
        title=notif.title,
        message=notif.message,
        link=notif.link,
        is_read=notif.is_read,
        created_at=notif.created_at,
    )
