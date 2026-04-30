from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.container import ContainerStatus, TRANSITIONS_AUTORISEES
from app.models.reference import (
    PlaceTypeRef,
    OrderTypeRef,
    StockStatusRef,
    EventTypeRef,
)

router = APIRouter(prefix="/ref", tags=["references"])


class RefItemOut(BaseModel):
    id: int
    code: str
    label: str
    model_config = {"from_attributes": True}


class ContainerStatusInfo(BaseModel):
    status: str
    label: str
    allowed_transitions: list[str]


CONTAINER_STATUS_LABELS: dict[ContainerStatus, str] = {
    ContainerStatus.propre:      "Propre",
    ContainerStatus.en_consigne: "En consigne",
    ContainerStatus.sale:        "Sale",
    ContainerStatus.en_lavage:   "En lavage",
    ContainerStatus.en_transit:  "En transit",
    ContainerStatus.perdu:       "Perdu",
    ContainerStatus.a_detruire:  "À détruire",
    ContainerStatus.detruit:     "Détruit",
}


@router.get("/place-types", response_model=list[RefItemOut])
async def list_place_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PlaceTypeRef).order_by(PlaceTypeRef.id))
    return result.scalars().all()


@router.get("/order-types", response_model=list[RefItemOut])
async def list_order_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OrderTypeRef).order_by(OrderTypeRef.id))
    return result.scalars().all()


@router.get("/container-statuses", response_model=list[ContainerStatusInfo])
async def list_container_statuses():
    """Source unique pour les transitions de statut container.

    Construit depuis TRANSITIONS_AUTORISEES (models/container.py) — pas de
    duplication entre backend et frontend.
    """
    return [
        ContainerStatusInfo(
            status=status.value,
            label=CONTAINER_STATUS_LABELS[status],
            allowed_transitions=[t.value for t in TRANSITIONS_AUTORISEES.get(status, [])],
        )
        for status in ContainerStatus
    ]


@router.get("/stock-statuses", response_model=list[RefItemOut])
async def list_stock_statuses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StockStatusRef).order_by(StockStatusRef.id))
    return result.scalars().all()


@router.get("/event-types", response_model=list[RefItemOut])
async def list_event_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EventTypeRef).order_by(EventTypeRef.id))
    return result.scalars().all()
