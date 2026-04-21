from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.place import Place, PlaceTypeEnum
from app.models.organization import Address
from app.schemas.place import PlaceCreate, PlaceUpdate, PlaceOut

router = APIRouter(prefix="/places", tags=["places"])


def _require_not_consommateur(current_user: User):
    if current_user.role == UserRole.consommateur:
        raise HTTPException(status_code=403, detail="Accès refusé")


def _require_admin_or_gestionnaire(current_user: User):
    if current_user.role not in (UserRole.admin_nut, UserRole.gestionnaire_organisation):
        raise HTTPException(status_code=403, detail="Accès réservé admin_nut ou gestionnaire_organisation")


def _require_admin(current_user: User):
    if current_user.role != UserRole.admin_nut:
        raise HTTPException(status_code=403, detail="Accès réservé admin_nut")


def _build_place_select():
    return select(Place).options(
        selectinload(Place.address),
        selectinload(Place.organization),
    )


def _to_out(place: Place) -> PlaceOut:
    out = PlaceOut.model_validate(place)
    if place.organization:
        out.organization_name = place.organization.name
    return out


# ── GET /places ─────────────────────────────────────────────────────

@router.get("", response_model=list[PlaceOut])
async def list_places(
    place_type: Optional[PlaceTypeEnum] = Query(None),
    id_organization: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_not_consommateur(current_user)

    stmt = _build_place_select()
    if place_type is not None:
        stmt = stmt.where(Place.place_type == place_type)
    if id_organization is not None:
        stmt = stmt.where(Place.id_organization == id_organization)

    result = await db.execute(stmt)
    places = result.scalars().all()
    return [_to_out(p) for p in places]


# ── GET /places/{id} ────────────────────────────────────────────────

@router.get("/{place_id}", response_model=PlaceOut)
async def get_place(
    place_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_not_consommateur(current_user)

    result = await db.execute(_build_place_select().where(Place.id == place_id))
    place = result.scalar_one_or_none()
    if not place:
        raise HTTPException(status_code=404, detail="Lieu introuvable")
    return _to_out(place)


# ── POST /places ─────────────────────────────────────────────────────

@router.post("", response_model=PlaceOut, status_code=status.HTTP_201_CREATED)
async def create_place(
    payload: PlaceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_gestionnaire(current_user)

    id_address = None
    if payload.address:
        addr = Address(
            address=payload.address.get("address"),
            city=payload.address.get("city"),
            zipcode=payload.address.get("zipcode"),
            country=payload.address.get("country"),
        )
        db.add(addr)
        await db.flush()
        id_address = addr.id

    place = Place(
        name=payload.name,
        place_type=payload.place_type,
        id_organization=payload.id_organization,
        id_parent=payload.id_parent,
        latitude=payload.latitude,
        longitude=payload.longitude,
        volume_capacity=payload.volume_capacity,
        id_address=id_address,
    )
    db.add(place)
    await db.commit()

    result = await db.execute(_build_place_select().where(Place.id == place.id))
    place = result.scalar_one()
    return _to_out(place)


# ── PATCH /places/{id} ───────────────────────────────────────────────

@router.patch("/{place_id}", response_model=PlaceOut)
async def update_place(
    place_id: int,
    payload: PlaceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(_build_place_select().where(Place.id == place_id))
    place = result.scalar_one_or_none()
    if not place:
        raise HTTPException(status_code=404, detail="Lieu introuvable")

    if current_user.role == UserRole.admin_nut:
        pass
    elif current_user.role == UserRole.gestionnaire_organisation and place.id_organization == current_user.id_organization:
        pass
    else:
        raise HTTPException(status_code=403, detail="Accès refusé")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(place, field, value)

    await db.commit()

    result = await db.execute(_build_place_select().where(Place.id == place_id))
    place = result.scalar_one()
    return _to_out(place)


# ── DELETE /places/{id} ──────────────────────────────────────────────

@router.delete("/{place_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_place(
    place_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    result = await db.execute(select(Place).where(Place.id == place_id))
    place = result.scalar_one_or_none()
    if not place:
        raise HTTPException(status_code=404, detail="Lieu introuvable")
    await db.delete(place)
    await db.commit()
