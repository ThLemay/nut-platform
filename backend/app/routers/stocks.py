from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.dependencies import require_not_consommateur
from app.models.container import Container, ContainerStatus, TRANSITIONS_AUTORISEES
from app.models.event_log import EntityType, EventLog, EventType
from app.models.stock import Stock, StockContainer, StockStatus
from app.models.user import User, UserRole
from app.schemas.stock import (
    StockCreate, StockUpdate, StockContainerOut, StockOut,
    AddContainerPayload, BulkStatusPayload, BulkStatusResult,
)

router = APIRouter(prefix="/stocks", tags=["stocks"])


# ── Permission ───────────────────────────────────────────────────────────────

def _require_stock_access(stock: Stock, current_user: User) -> None:
    """Admin OK ; sinon le stock doit appartenir à l'organisation de l'utilisateur."""
    if current_user.role == UserRole.admin_nut:
        return
    if stock.id_owner_organization is None or stock.id_owner_organization != current_user.id_organization:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé à ce stock",
        )


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_stock_or_404(db: AsyncSession, stock_id: int) -> Stock:
    result = await db.execute(select(Stock).where(Stock.id == stock_id))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock introuvable")
    return stock


async def _load_active_entries(db: AsyncSession, stock_id: int) -> list[StockContainer]:
    result = await db.execute(
        select(StockContainer)
        .where(StockContainer.id_stock == stock_id, StockContainer.removed_at.is_(None))
        .options(selectinload(StockContainer.container))
        .order_by(StockContainer.added_at.desc())
    )
    return list(result.scalars().all())


def _build_stock_out(stock: Stock, entries: list[StockContainer]) -> StockOut:
    containers = [
        StockContainerOut(
            id=e.container.id,
            uid=e.container.uid,
            id_cont_type=e.container.id_cont_type,
            status=e.container.status,
            added_at=e.added_at,
        )
        for e in entries
    ]
    return StockOut(
        id=stock.id,
        name=stock.name,
        status=stock.status,
        note=stock.note,
        id_place=stock.id_place,
        id_order=stock.id_order,
        id_owner_organization=stock.id_owner_organization,
        created_at=stock.created_at,
        container_count=len(containers),
        containers=containers,
    )


# ── GET /stocks ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[StockOut])
async def list_stocks(
    status_filter:   Optional[StockStatus] = Query(None, alias="status"),
    id_organization: Optional[int]         = Query(None),
    db:              AsyncSession           = Depends(get_db),
    current_user:    User                   = Depends(require_not_consommateur),
):
    stmt = select(Stock)
    if status_filter:
        stmt = stmt.where(Stock.status == status_filter)
    if id_organization:
        stmt = stmt.where(Stock.id_owner_organization == id_organization)
    elif current_user.role != UserRole.admin_nut:
        stmt = stmt.where(Stock.id_owner_organization == current_user.id_organization)

    result = await db.execute(stmt.order_by(Stock.id.desc()))
    stocks = result.scalars().all()

    # Count actifs via subquery pour éviter N+1
    stock_ids = [s.id for s in stocks]
    if stock_ids:
        count_result = await db.execute(
            select(StockContainer.id_stock, func.count().label("n"))
            .where(
                StockContainer.id_stock.in_(stock_ids),
                StockContainer.removed_at.is_(None),
            )
            .group_by(StockContainer.id_stock)
        )
        counts = {row.id_stock: row.n for row in count_result}
    else:
        counts = {}

    return [
        StockOut(
            id=s.id,
            name=s.name,
            status=s.status,
            note=s.note,
            id_place=s.id_place,
            id_order=s.id_order,
            id_owner_organization=s.id_owner_organization,
            created_at=s.created_at,
            container_count=counts.get(s.id, 0),
        )
        for s in stocks
    ]


# ── GET /stocks/{stock_id} ───────────────────────────────────────────────────

@router.get("/{stock_id}", response_model=StockOut)
async def get_stock(
    stock_id:     int,
    db:           AsyncSession = Depends(get_db),
    current_user: User         = Depends(require_not_consommateur),
):
    stock   = await _get_stock_or_404(db, stock_id)
    _require_stock_access(stock, current_user)
    entries = await _load_active_entries(db, stock_id)
    return _build_stock_out(stock, entries)


# ── POST /stocks ─────────────────────────────────────────────────────────────

@router.post("", response_model=StockOut, status_code=status.HTTP_201_CREATED)
async def create_stock(
    payload:      StockCreate,
    db:           AsyncSession = Depends(get_db),
    current_user: User         = Depends(require_not_consommateur),
):
    stock = Stock(
        name=payload.name,
        note=payload.note,
        id_place=payload.id_place,
        id_owner_organization=current_user.id_organization,
    )
    db.add(stock)
    await db.commit()
    await db.refresh(stock)
    return _build_stock_out(stock, [])


# ── PATCH /stocks/{stock_id} ─────────────────────────────────────────────────

@router.patch("/{stock_id}", response_model=StockOut)
async def update_stock(
    stock_id:     int,
    payload:      StockUpdate,
    db:           AsyncSession = Depends(get_db),
    current_user: User         = Depends(require_not_consommateur),
):
    stock = await _get_stock_or_404(db, stock_id)
    _require_stock_access(stock, current_user)

    if payload.name   is not None: stock.name   = payload.name
    if payload.status is not None: stock.status = payload.status
    if payload.note   is not None: stock.note   = payload.note

    await db.commit()
    await db.refresh(stock)
    entries = await _load_active_entries(db, stock_id)
    return _build_stock_out(stock, entries)


# ── DELETE /stocks/{stock_id} ────────────────────────────────────────────────

@router.delete("/{stock_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stock(
    stock_id:     int,
    db:           AsyncSession = Depends(get_db),
    current_user: User         = Depends(require_not_consommateur),
):
    stock   = await _get_stock_or_404(db, stock_id)
    _require_stock_access(stock, current_user)
    entries = await _load_active_entries(db, stock_id)
    if entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de supprimer : {len(entries)} contenant(s) actif(s) dans ce stock",
        )
    await db.delete(stock)
    await db.commit()


# ── POST /stocks/{stock_id}/containers ───────────────────────────────────────

@router.post("/{stock_id}/containers", response_model=StockOut, status_code=status.HTTP_201_CREATED)
async def add_container(
    stock_id:     int,
    payload:      AddContainerPayload,
    db:           AsyncSession = Depends(get_db),
    current_user: User         = Depends(require_not_consommateur),
):
    stock = await _get_stock_or_404(db, stock_id)
    _require_stock_access(stock, current_user)

    cont_result = await db.execute(select(Container).where(Container.uid == payload.uid))
    container   = cont_result.scalar_one_or_none()
    if not container:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contenant introuvable")
    if not container.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ce contenant n'est plus actif")

    already = await db.execute(
        select(StockContainer).where(
            StockContainer.id_container == container.id,
            StockContainer.removed_at.is_(None),
        )
    )
    if already.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ce contenant est déjà dans un stock")

    db.add(StockContainer(
        id_stock=stock.id,
        id_container=container.id,
        added_at=datetime.now(timezone.utc),
    ))
    container.id_current_stock = stock.id
    await db.commit()

    entries = await _load_active_entries(db, stock_id)
    return _build_stock_out(stock, entries)


# ── DELETE /stocks/{stock_id}/containers/{uid} ───────────────────────────────

@router.delete("/{stock_id}/containers/{uid}", response_model=StockOut)
async def remove_container(
    stock_id:     int,
    uid:          str,
    db:           AsyncSession = Depends(get_db),
    current_user: User         = Depends(require_not_consommateur),
):
    stock = await _get_stock_or_404(db, stock_id)
    _require_stock_access(stock, current_user)

    cont_result = await db.execute(select(Container).where(Container.uid == uid))
    container   = cont_result.scalar_one_or_none()
    if not container:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contenant introuvable")

    entry_result = await db.execute(
        select(StockContainer).where(
            StockContainer.id_stock == stock_id,
            StockContainer.id_container == container.id,
            StockContainer.removed_at.is_(None),
        )
    )
    entry = entry_result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ce contenant n'est pas dans ce stock")

    entry.removed_at           = datetime.now(timezone.utc)
    container.id_current_stock = None
    await db.commit()

    entries = await _load_active_entries(db, stock_id)
    return _build_stock_out(stock, entries)


# ── PATCH /stocks/{stock_id}/containers/status ───────────────────────────────
# NOTE: ce endpoint doit être déclaré AVANT /{stock_id}/containers/{uid}
# pour que FastAPI ne confonde pas "status" avec un uid variable.

@router.patch("/{stock_id}/containers/status", response_model=BulkStatusResult)
async def bulk_status_change(
    stock_id:     int,
    payload:      BulkStatusPayload,
    db:           AsyncSession = Depends(get_db),
    current_user: User         = Depends(require_not_consommateur),
):
    stock = await _get_stock_or_404(db, stock_id)
    _require_stock_access(stock, current_user)
    entries = await _load_active_entries(db, stock_id)

    updated = 0
    skipped = 0

    for entry in entries:
        container = entry.container
        allowed   = TRANSITIONS_AUTORISEES.get(container.status, [])

        if payload.status not in allowed:
            skipped += 1
            continue

        old_status        = container.status
        container.status  = payload.status

        if payload.status in (ContainerStatus.detruit, ContainerStatus.perdu):
            container.is_active = False

        db.add(EventLog(
            id_user=current_user.id,
            id_org=current_user.id_organization,
            entity_type=EntityType.container,
            entity_id=container.id,
            event_type=EventType.container_status_change,
            old_value={"status": old_status.value},
            new_value={"status": payload.status.value},
            note=payload.note,
        ))
        updated += 1

    await db.commit()
    return BulkStatusResult(updated=updated, skipped=skipped)
