from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.organization import Organization, Address
from app.schemas.organization import (
    OrganizationCreate, OrganizationUpdate, OrganizationOut,
    MemberAdd,
)

router = APIRouter(prefix="/organizations", tags=["organizations"])


def _require_admin(current_user: User):
    if current_user.role != UserRole.admin_nut:
        raise HTTPException(status_code=403, detail="Accès réservé admin_nut")


def _require_admin_or_own_org(current_user: User, org_id: int):
    if current_user.role == UserRole.admin_nut:
        return
    if current_user.role == UserRole.gestionnaire_organisation and current_user.id_organization == org_id:
        return
    raise HTTPException(status_code=403, detail="Accès refusé")


# ── GET /organizations ──────────────────────────────────────────────

@router.get("", response_model=list[OrganizationOut])
async def list_organizations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    result = await db.execute(select(Organization).options(selectinload(Organization.address)))
    return result.scalars().all()


# ── GET /organizations/{id} ─────────────────────────────────────────

@router.get("/{org_id}", response_model=OrganizationOut)
async def get_organization(
    org_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_own_org(current_user, org_id)
    result = await db.execute(
        select(Organization).options(selectinload(Organization.address)).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation introuvable")
    return org


# ── POST /organizations ─────────────────────────────────────────────

@router.post("", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    id_address = None
    if payload.address:
        addr = Address(
            address=payload.address.address,
            city=payload.address.city,
            zipcode=payload.address.zipcode,
            country=payload.address.country,
        )
        db.add(addr)
        await db.flush()
        id_address = addr.id

    org = Organization(
        name=payload.name,
        siren=payload.siren,
        siret=payload.siret,
        description=payload.description,
        id_parent=payload.id_parent,
        id_address=id_address,
        is_food_provider=payload.is_food_provider,
        is_cont_washer=payload.is_cont_washer,
        is_cont_transporter=payload.is_cont_transporter,
        is_cont_stockeur=payload.is_cont_stockeur,
        is_cont_recycleur=payload.is_cont_recycleur,
        is_cont_destructeur=payload.is_cont_destructeur,
        is_cont_provider=payload.is_cont_provider,
    )
    db.add(org)
    await db.commit()
    result = await db.execute(
        select(Organization).options(selectinload(Organization.address)).where(Organization.id == org.id)
    )
    org = result.scalar_one()
    return org


# ── PATCH /organizations/{id} ───────────────────────────────────────

@router.patch("/{org_id}", response_model=OrganizationOut)
async def update_organization(
    org_id: int,
    payload: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_own_org(current_user, org_id)
    result = await db.execute(
        select(Organization).options(selectinload(Organization.address)).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation introuvable")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(org, field, value)

    await db.commit()
    result = await db.execute(
        select(Organization).options(selectinload(Organization.address)).where(Organization.id == org_id)
    )
    org = result.scalar_one()
    return org


# ── DELETE /organizations/{id} ──────────────────────────────────────

@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    org_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation introuvable")
    await db.delete(org)
    await db.commit()


# ── POST /organizations/{id}/members ────────────────────────────────

@router.post("/{org_id}/members")
async def add_member(
    org_id: int,
    payload: MemberAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_own_org(current_user, org_id)

    result = await db.execute(select(User).where(User.id == payload.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user.id_organization is not None:
        raise HTTPException(status_code=400, detail="Utilisateur déjà membre d'une organisation")

    user.id_organization = org_id
    await db.commit()
    return {"message": "Utilisateur ajouté", "user_id": payload.user_id, "organization_id": org_id}


# ── DELETE /organizations/{id}/members/{user_id} ────────────────────

@router.delete("/{org_id}/members/{user_id}")
async def remove_member(
    org_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin_or_own_org(current_user, org_id)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user.id_organization != org_id:
        raise HTTPException(status_code=400, detail="Utilisateur non membre de cette organisation")

    user.id_organization = None
    await db.commit()
    return {"message": "Utilisateur retiré", "user_id": user_id}
