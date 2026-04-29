from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from app.db.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User, UserRole
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentification"])

# ── Schémas ────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    firstname: str
    surname: str
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    firstname: str
    surname: str
    email: str
    role: UserRole

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    firstname:    Optional[str]      = None
    surname:      Optional[str]      = None
    phone_number: Optional[str]      = None
    email:        Optional[EmailStr] = None
    password:     Optional[str]      = None

class Token(BaseModel):
    access_token: str
    token_type: str

# ── Endpoints ──────────────────────────────────────────────────────

@router.post("/register", response_model=UserResponse, status_code=201)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """Créer un nouvel utilisateur."""
    # Vérifier que l'email n'existe pas déjà
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cet email est déjà utilisé"
        )
    user = User(
        firstname=user_in.firstname,
        surname=user_in.surname,
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        role=UserRole.consommateur,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Connexion — retourne un token JWT."""
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({
        "sub": str(user.id),
        "tv": user.token_version,
    })
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    """Retourne l'utilisateur actuellement connecté."""
    return current_user

@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Met à jour le profil de l'utilisateur connecté."""
    if payload.email is not None and payload.email != current_user.email:
        conflict = await db.execute(select(User).where(User.email == payload.email))
        if conflict.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cet email est déjà utilisé",
            )

    for field in ("firstname", "surname", "phone_number", "email"):
        value = getattr(payload, field)
        if value is not None:
            setattr(current_user, field, value)

    if payload.password is not None:
        current_user.hashed_password = hash_password(payload.password)
        # Changement de password → invalide tous les tokens existants
        current_user.token_version += 1

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/logout", status_code=204)
async def logout(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Révoque tous les tokens existants de l'utilisateur."""
    current_user.token_version += 1
    await db.commit()