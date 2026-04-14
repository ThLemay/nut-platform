from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.container import Container, ContainerType, ContPackagingType
from app.schemas.container_type import (
    ContainerTypeCreate,
    ContainerTypeOut,
    ContainerTypeUpdate,
    PackagingCreate,
    PackagingOut,
    PackagingUpdate,
)

router = APIRouter(tags=["container-types"])


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_ct(type_id: int, db: AsyncSession) -> ContainerType:
    result = await db.execute(
        select(ContainerType)
        .where(ContainerType.id == type_id)
        .options(selectinload(ContainerType.packaging_types))
    )
    ct = result.scalar_one_or_none()
    if not ct:
        raise HTTPException(status_code=404, detail="Type de contenant introuvable")
    return ct


# ── ContainerType endpoints ────────────────────────────────────────────────────

@router.get("", response_model=list[ContainerTypeOut])
async def list_container_types(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ContainerType)
        .order_by(ContainerType.name)
        .options(selectinload(ContainerType.packaging_types))
    )
    return result.scalars().all()


@router.get("/{type_id}", response_model=ContainerTypeOut)
async def get_container_type(
    type_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _get_ct(type_id, db)


@router.post("", response_model=ContainerTypeOut, status_code=status.HTTP_201_CREATED)
async def create_container_type(
    payload: ContainerTypeCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin_nut)),
):
    ct = ContainerType(**payload.model_dump())
    db.add(ct)
    await db.commit()
    await db.refresh(ct, ["packaging_types"])
    return ct


@router.patch("/{type_id}", response_model=ContainerTypeOut)
async def update_container_type(
    type_id: int,
    payload: ContainerTypeUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin_nut)),
):
    ct = await _get_ct(type_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ct, field, value)
    await db.commit()
    await db.refresh(ct, ["packaging_types"])
    return ct


@router.delete("/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_container_type(
    type_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin_nut)),
):
    result = await db.execute(
        select(ContainerType).where(ContainerType.id == type_id)
    )
    ct = result.scalar_one_or_none()
    if not ct:
        raise HTTPException(status_code=404, detail="Type de contenant introuvable")

    containers = await db.execute(
        select(Container).where(Container.id_cont_type == type_id).limit(1)
    )
    if containers.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer : des contenants existent pour ce type",
        )

    await db.delete(ct)
    await db.commit()


# ── Packaging endpoints ────────────────────────────────────────────────────────

@router.post(
    "/{type_id}/packagings",
    response_model=PackagingOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_packaging(
    type_id: int,
    payload: PackagingCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin_nut)),
):
    await _get_ct(type_id, db)  # 404 guard
    pkg = ContPackagingType(id_cont_type=type_id, **payload.model_dump())
    db.add(pkg)
    await db.commit()
    await db.refresh(pkg)
    return pkg


@router.patch(
    "/{type_id}/packagings/{packaging_id}",
    response_model=PackagingOut,
)
async def update_packaging(
    type_id: int,
    packaging_id: int,
    payload: PackagingUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin_nut)),
):
    result = await db.execute(
        select(ContPackagingType).where(
            ContPackagingType.id == packaging_id,
            ContPackagingType.id_cont_type == type_id,
        )
    )
    pkg = result.scalar_one_or_none()
    if not pkg:
        raise HTTPException(status_code=404, detail="Conditionnement introuvable")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(pkg, field, value)
    await db.commit()
    await db.refresh(pkg)
    return pkg


@router.delete(
    "/{type_id}/packagings/{packaging_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_packaging(
    type_id: int,
    packaging_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin_nut)),
):
    result = await db.execute(
        select(ContPackagingType).where(
            ContPackagingType.id == packaging_id,
            ContPackagingType.id_cont_type == type_id,
        )
    )
    pkg = result.scalar_one_or_none()
    if not pkg:
        raise HTTPException(status_code=404, detail="Conditionnement introuvable")

    await db.delete(pkg)
    await db.commit()
