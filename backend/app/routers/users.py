from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.dependencies import require_admin
from app.core.security import hash_password
from app.models.user import User, UserStatus
from app.schemas.user import UserOut, UserCreate, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


# ── GET /users ──────────────────────────────────────────────────────

@router.get("", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(User).order_by(User.id))
    return result.scalars().all()


# ── GET /users/{user_id} ────────────────────────────────────────────

@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return user


# ── POST /users ─────────────────────────────────────────────────────

@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")

    user = User(
        firstname=payload.firstname,
        surname=payload.surname,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        phone_number=payload.phone_number,
        role=payload.role,
        status=payload.status,
        id_organization=payload.id_organization,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# ── PATCH /users/{user_id} ──────────────────────────────────────────

@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    data = payload.model_dump(exclude_none=True)

    revoke_tokens = False

    if "password" in data:
        user.hashed_password = hash_password(data.pop("password"))
        revoke_tokens = True

    if "email" in data and data["email"] != user.email:
        dup = await db.execute(select(User).where(User.email == data["email"]))
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")

    # Passage à un status non-actif → on révoque aussi
    if "status" in data and data["status"] != UserStatus.active:
        revoke_tokens = True

    for field, value in data.items():
        setattr(user, field, value)

    if revoke_tokens:
        user.token_version += 1

    await db.commit()
    await db.refresh(user)
    return user


# ── DELETE /users/{user_id} ─────────────────────────────────────────

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Impossible de supprimer son propre compte")
    await db.delete(user)
    await db.commit()
