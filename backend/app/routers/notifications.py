import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.db.database import get_db, AsyncSessionLocal
from app.dependencies import get_current_user
from app.core.security import decode_token
from app.models.user import User, UserStatus
from app.models.notification import Notification
from app.schemas.notification import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


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


# ── GET /notifications/stream (SSE) ──────────────────────────────────────────
# `EventSource` (browser) ne supporte pas les headers custom : le JWT est passé
# en query param. On valide manuellement (signature + tv + status actif), puis
# on push les notifs non-lues toutes les 20s. Une session DB est ouverte par
# itération pour ne pas garder une transaction ouverte pendant tout le stream.

SSE_POLL_INTERVAL_SECONDS = 20


async def _resolve_user_from_token(token: str) -> User:
    auth_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
    )
    try:
        payload = decode_token(token)
        sub = payload.get("sub")
        if sub is None:
            raise auth_exc
        user_id = int(sub)
        token_tv = payload.get("tv")
    except (ValueError, TypeError):
        raise auth_exc

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
    if user is None or token_tv is None or token_tv != user.token_version:
        raise auth_exc
    if user.status != UserStatus.active:
        raise auth_exc
    return user


async def _fetch_unread(user_id: int) -> list[dict]:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Notification)
            .where(Notification.id_user == user_id)
            .where(Notification.is_read == False)
            .order_by(Notification.created_at.desc())
        )
        rows = result.scalars().all()
        return [NotificationOut.model_validate(n).model_dump(mode="json") for n in rows]


@router.get("/stream")
async def stream_notifications(
    request: Request,
    token: str = Query(..., description="JWT (EventSource n'autorise pas l'en-tête Authorization)"),
):
    user = await _resolve_user_from_token(token)

    async def event_generator():
        try:
            # Push initial pour que le client soit synchrone dès la connexion.
            payload = await _fetch_unread(user.id)
            yield f"data: {json.dumps(payload)}\n\n"

            while True:
                if await request.is_disconnected():
                    break
                await asyncio.sleep(SSE_POLL_INTERVAL_SECONDS)
                payload = await _fetch_unread(user.id)
                yield f"data: {json.dumps(payload)}\n\n"
        except asyncio.CancelledError:
            # Déconnexion client : on laisse le générateur se fermer proprement.
            return

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


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
