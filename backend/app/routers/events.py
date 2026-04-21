from typing import Optional, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.event_log import EventLog, EventType, EntityType

router = APIRouter(prefix="/events", tags=["events"])


class EventLogOut(BaseModel):
    id: int
    created_at: datetime
    entity_type: EntityType
    entity_id: int
    event_type: EventType
    old_value: Optional[Any]
    new_value: Optional[Any]
    note: Optional[str]
    meta: Optional[Any]
    id_user: Optional[int]
    id_org: Optional[int]
    id_place: Optional[int]

    model_config = {"from_attributes": True}


def _require_admin_or_gestionnaire(current_user: User):
    if current_user.role not in (UserRole.admin_nut, UserRole.gestionnaire_organisation):
        raise HTTPException(status_code=403, detail="Accès réservé admin_nut ou gestionnaire_organisation")


@router.get("", response_model=list[EventLogOut])
async def list_events(
    entity_type: Optional[EntityType] = Query(None),
    entity_id: Optional[int] = Query(None),
    event_type: Optional[EventType] = Query(None),
    id_user: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_gestionnaire(current_user)

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
