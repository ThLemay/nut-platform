import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.order import (
    Order, OrderLine, Transport, TransportSlot,
    OrderType, OrderStatus, TRANSITIONS_ORDER,
)
from app.models.organization import Organization
from app.schemas.order import (
    OrderCreate, OrderUpdate, OrderOut,
    OrderAssign, TransportSlotsCreate,
)

router = APIRouter(prefix="/orders", tags=["orders"])

# ── Helper ──────────────────────────────────────────────────────────────────

async def _get_order_full(db: AsyncSession, order_id: int) -> Order | None:
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.lines),
            selectinload(Order.transport).options(
                selectinload(Transport.slots),
            ),
        )
        .where(Order.id == order_id)
    )
    return result.scalar_one_or_none()


def _check_order_access(order: Order, current_user: User):
    """403 si l'utilisateur n'est ni client ni prestataire de la commande."""
    if current_user.role == UserRole.admin_nut:
        return
    org = current_user.id_organization
    if org != order.id_client and org != order.id_provider:
        raise HTTPException(status_code=403, detail="Accès refusé")


# ── POST /orders ─────────────────────────────────────────────────────────────

@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.consommateur:
        raise HTTPException(status_code=403, detail="Accès refusé aux consommateurs")

    order = Order(
        order_type=payload.order_type,
        status=OrderStatus.brouillon,
        id_client=payload.id_client,
        desired_date=payload.desired_date,
        note=payload.note,
        qr_code=str(uuid.uuid4()),
    )
    db.add(order)
    await db.flush()

    for line in payload.lines:
        db.add(OrderLine(
            id_order=order.id,
            id_cont_type=line.id_cont_type,
            id_cont_packaging=line.id_cont_packaging,
            quantity=line.quantity,
            unit_price=line.unit_price,
            description=line.description,
        ))

    await db.commit()
    return await _get_order_full(db, order.id)


# ── GET /orders ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[OrderOut])
async def list_orders(
    order_type: OrderType | None = Query(None),
    status: OrderStatus | None = Query(None),
    id_client: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Order)
        .options(
            selectinload(Order.lines),
            selectinload(Order.transport).options(
                selectinload(Transport.slots),
            ),
        )
    )

    if current_user.role != UserRole.admin_nut:
        org = current_user.id_organization
        stmt = stmt.where(
            (Order.id_client == org) | (Order.id_provider == org)
        )

    if order_type is not None:
        stmt = stmt.where(Order.order_type == order_type)
    if status is not None:
        stmt = stmt.where(Order.status == status)
    if id_client is not None:
        stmt = stmt.where(Order.id_client == id_client)

    result = await db.execute(stmt)
    return result.scalars().all()


# ── GET /orders/{id} ─────────────────────────────────────────────────────────

@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = await _get_order_full(db, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    _check_order_access(order, current_user)
    return order


# ── PATCH /orders/{id}/status ─────────────────────────────────────────────────

@router.patch("/{order_id}/status", response_model=OrderOut)
async def change_status(
    order_id: int,
    new_status: OrderStatus = Query(..., description="Nouveau statut"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.admin_nut:
        raise HTTPException(status_code=403, detail="Accès réservé admin_nut")

    order = await _get_order_full(db, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    allowed = TRANSITIONS_ORDER.get(order.status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transition interdite : {order.status} → {new_status}. Transitions autorisées : {[s.value for s in allowed]}",
        )

    order.status = new_status
    await db.commit()
    return await _get_order_full(db, order_id)


# ── POST /orders/{id}/broadcast ───────────────────────────────────────────────

@router.post("/{order_id}/broadcast", response_model=OrderOut)
async def broadcast_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = await _get_order_full(db, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    # admin_nut ou gestionnaire de l'organisation cliente
    if current_user.role != UserRole.admin_nut:
        if not (
            current_user.role == UserRole.gestionnaire_organisation
            and current_user.id_organization == order.id_client
        ):
            raise HTTPException(status_code=403, detail="Accès refusé")

    if order.status != OrderStatus.brouillon:
        raise HTTPException(status_code=400, detail="Commande déjà envoyée")

    order.status = OrderStatus.envoyee
    await db.commit()
    return await _get_order_full(db, order_id)


# ── POST /orders/{id}/accept ──────────────────────────────────────────────────

PROVIDER_ROLES = {UserRole.operateur}

@router.post("/{order_id}/accept", response_model=OrderOut)
async def accept_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in PROVIDER_ROLES:
        raise HTTPException(status_code=403, detail="Accès réservé aux prestataires")

    if current_user.id_organization is None:
        raise HTTPException(status_code=400, detail="Vous n'êtes pas rattaché à une organisation")

    order = await _get_order_full(db, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    if order.status != OrderStatus.envoyee:
        raise HTTPException(status_code=400, detail="La commande n'est pas disponible à l'acceptation")

    order.id_provider = current_user.id_organization
    order.status = OrderStatus.acceptee
    await db.commit()
    return await _get_order_full(db, order_id)


# ── POST /orders/{id}/assign ──────────────────────────────────────────────────

@router.post("/{order_id}/assign", response_model=OrderOut)
async def assign_order(
    order_id: int,
    payload: OrderAssign,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.admin_nut:
        raise HTTPException(status_code=403, detail="Accès réservé admin_nut")

    order = await _get_order_full(db, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    result = await db.execute(select(Organization).where(Organization.id == payload.id_provider))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Organisation prestataire introuvable")

    order.id_provider = payload.id_provider
    order.status = OrderStatus.acceptee
    await db.commit()
    return await _get_order_full(db, order_id)


# ── POST /orders/{id}/slots ───────────────────────────────────────────────────

@router.post("/{order_id}/slots", response_model=OrderOut)
async def propose_slots(
    order_id: int,
    payload: TransportSlotsCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = await _get_order_full(db, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    if current_user.role != UserRole.admin_nut:
        if current_user.id_organization != order.id_provider:
            raise HTTPException(status_code=403, detail="Accès refusé")

    if order.status not in (OrderStatus.acceptee, OrderStatus.en_cours):
        raise HTTPException(status_code=400, detail="La commande doit être acceptée ou en cours pour proposer des créneaux")

    # Supprimer l'ancien transport s'il existe (et ses slots)
    if order.transport is not None:
        for slot in order.transport.slots:
            await db.delete(slot)
        await db.delete(order.transport)
        await db.flush()

    transport = Transport(
        id_order=order_id,
        responsible=payload.responsible,
        id_pickup_place=payload.id_pickup_place,
        id_delivery_place=payload.id_delivery_place,
        id_transporter=payload.id_transporter,
    )
    db.add(transport)
    await db.flush()

    for slot_data in payload.slots:
        db.add(TransportSlot(
            id_transport=transport.id,
            slot_date=slot_data.slot_date,
        ))

    await db.commit()
    return await _get_order_full(db, order_id)


# ── POST /orders/{id}/slots/{slot_id}/accept ──────────────────────────────────

@router.post("/{order_id}/slots/{slot_id}/accept", response_model=OrderOut)
async def accept_slot(
    order_id: int,
    slot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = await _get_order_full(db, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    if current_user.role != UserRole.admin_nut:
        if current_user.id_organization != order.id_client:
            raise HTTPException(status_code=403, detail="Accès réservé au client de la commande")

    if order.transport is None:
        raise HTTPException(status_code=400, detail="Aucun transport associé à cette commande")

    slot = next((s for s in order.transport.slots if s.id == slot_id), None)
    if slot is None:
        raise HTTPException(status_code=404, detail="Créneau introuvable pour cette commande")

    slot.is_accepted = True
    order.transport.accepted_slot_id = slot_id
    await db.commit()
    return await _get_order_full(db, order_id)
