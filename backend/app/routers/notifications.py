from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Notification
from app.schemas.package import NotificationOut
from app.services.auth import get_current_user

router = APIRouter(
    prefix="/api/notifications", tags=["notifications"], dependencies=[Depends(get_current_user)]
)


@router.get("", response_model=list[NotificationOut])
def list_notifications(limit: int = Query(default=50, ge=1, le=200), db: Session = Depends(get_db)):
    """The local outbox, newest first: the emails that would have been sent."""
    return db.scalars(select(Notification).order_by(Notification.id.desc()).limit(limit)).all()
