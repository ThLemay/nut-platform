from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.dependencies import require_admin_or_gestionnaire
from app.models.user import User, UserRole
from app.models.event_log import EventLog, EventType, EntityType
from app.schemas.event import EventLogOut

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[EventLogOut])
async def list_events(
    entity_type: Optional[EntityType] = Query(None),
    entity_id: Optional[int] = Query(None),
    event_type: Optional[EventType] = Query(None),
    id_user: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_gestionnaire),
):
    stmt = select(EventLog).order_by(EventLog.created_at.desc()).limit(limit)

    # Filtre automatique sur l'orga pour les gestionnaires
    if current_user.role == UserRole.gestionnaire_organisation:
        stmt = stmt.where(EventLog.id_org == current_user.id_organization)

    if entity_type is not None:
        stmt = stmt.where(EventLog.entity_type == entity_type)
    if entity_id is not None:
        stmt = stmt.where(EventLog.entity_id == entity_id)
    if event_type is not None:
        stmt = stmt.where(EventLog.event_type == event_type)
    if id_user is not None:
        stmt = stmt.where(EventLog.id_user == id_user)

    result = await db.execute(stmt)
    return result.scalars().all()
