from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.notification import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id:               int
    type:             str
    message:          str
    is_read:          bool
    created_at:       datetime
    id_related_order: int | None = None

    model_config = {"from_attributes": True}


# ── Helper importable by other routers ──────────────────────────────────────

async def create_notification(
    db: AsyncSession,
    id_user: int,
    type: str,
    message: str,
    id_related_order: int | None = None,
) -> None:
    notif = Notification(
        id_user=id_user,
        type=type,
        message=message,
        id_related_order=id_related_order,
    )
    db.add(notif)


# ── GET /notifications ───────────────────────────────────────────────────────

@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.id_user == current_user.id)
        .where(Notification.is_read == False)
        .order_by(Notification.created_at.desc())
    )
    return result.scalars().all()


# ── PATCH /notifications/read-all ────────────────────────────────────────────

@router.patch("/read-all", status_code=204)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.id_user == current_user.id)
        .where(Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()


# ── PATCH /notifications/{id}/read ───────────────────────────────────────────

@router.patch("/{notif_id}/read", response_model=NotificationOut)
async def mark_read(
    notif_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notif_id,
            Notification.id_user == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if notif is None:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    notif.is_read = True
    await db.commit()
    await db.refresh(notif)
    return notif
