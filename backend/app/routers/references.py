from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.reference import (
    PlaceTypeRef,
    OrderTypeRef,
    ContainerStatusRef,
    StockStatusRef,
    EventTypeRef,
)

router = APIRouter(prefix="/ref", tags=["references"])


class RefItemOut(BaseModel):
    id: int
    code: str
    label: str
    model_config = {"from_attributes": True}


class ContainerStatusRefOut(RefItemOut):
    color: Optional[str]
    order: Optional[int]


@router.get("/place-types", response_model=list[RefItemOut])
async def list_place_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PlaceTypeRef).order_by(PlaceTypeRef.id))
    return result.scalars().all()


@router.get("/order-types", response_model=list[RefItemOut])
async def list_order_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OrderTypeRef).order_by(OrderTypeRef.id))
    return result.scalars().all()


@router.get("/container-statuses", response_model=list[ContainerStatusRefOut])
async def list_container_statuses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ContainerStatusRef).order_by(ContainerStatusRef.order.asc())
    )
    return result.scalars().all()


@router.get("/stock-statuses", response_model=list[RefItemOut])
async def list_stock_statuses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StockStatusRef).order_by(StockStatusRef.id))
    return result.scalars().all()


@router.get("/event-types", response_model=list[RefItemOut])
async def list_event_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EventTypeRef).order_by(EventTypeRef.id))
    return result.scalars().all()
