from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.dependencies import get_current_user, require_admin, require_admin_or_gestionnaire
from app.models.user import User, UserRole
from app.models.credit import Credit, CreditConfig
from app.models.event_log import EventLog, EventType, EntityType
from app.schemas.credit import (
    CreditConfigCreate, CreditConfigUpdate, CreditConfigOut,
    CreditOut, CreditAdjust,
)

router = APIRouter(prefix="/credits", tags=["credits"])


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_or_create_credit(db: AsyncSession, user_id: int) -> Credit:
    result = await db.execute(select(Credit).where(Credit.id_user == user_id))
    credit = result.scalar_one_or_none()
    if credit is None:
        credit = Credit(id_user=user_id, balance=0)
        db.add(credit)
        await db.flush()
        result = await db.execute(select(Credit).where(Credit.id == credit.id))
        credit = result.scalar_one()
    return credit


# ── POST /credits/config ──────────────────────────────────────────────────────

@router.post("/config", response_model=CreditConfigOut, status_code=status.HTTP_201_CREATED)
async def create_credit_config(
    payload: CreditConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_gestionnaire),
):
    # Gestionnaire ne peut configurer que sa propre orga
    if current_user.role == UserRole.gestionnaire_organisation:
        if current_user.id_organization != payload.id_organization:
            raise HTTPException(status_code=403, detail="Accès refusé à cette organisation")

    # Vérifier unicité
    result = await db.execute(
        select(CreditConfig).where(
            CreditConfig.id_organization == payload.id_organization,
            CreditConfig.id_cont_type == payload.id_cont_type,
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=400,
            detail="Configuration déjà existante, utilisez PATCH pour modifier",
        )

    config = CreditConfig(
        id_organization=payload.id_organization,
        id_cont_type=payload.id_cont_type,
        credit_amount=payload.credit_amount,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


# ── GET /credits/config ───────────────────────────────────────────────────────

@router.get("/config", response_model=list[CreditConfigOut])
async def list_credit_configs(
    id_organization: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_gestionnaire),
):
    stmt = select(CreditConfig)

    if current_user.role == UserRole.gestionnaire_organisation:
        stmt = stmt.where(CreditConfig.id_organization == current_user.id_organization)
    elif id_organization is not None:
        stmt = stmt.where(CreditConfig.id_organization == id_organization)

    result = await db.execute(stmt)
    return result.scalars().all()


# ── PATCH /credits/config/{id} ────────────────────────────────────────────────

@router.patch("/config/{config_id}", response_model=CreditConfigOut)
async def update_credit_config(
    config_id: int,
    payload: CreditConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_gestionnaire),
):
    result = await db.execute(select(CreditConfig).where(CreditConfig.id == config_id))
    config = result.scalar_one_or_none()
    if config is None:
        raise HTTPException(status_code=404, detail="Configuration introuvable")

    # Gestionnaire ne peut modifier que sa propre orga
    if current_user.role == UserRole.gestionnaire_organisation:
        if current_user.id_organization != config.id_organization:
            raise HTTPException(status_code=403, detail="Accès refusé à cette configuration")

    config.credit_amount = payload.credit_amount
    await db.commit()
    await db.refresh(config)
    return config


# ── GET /credits/me ───────────────────────────────────────────────────────────

@router.get("/me", response_model=CreditOut)
async def get_my_credits(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    credit = await _get_or_create_credit(db, current_user.id)
    await db.commit()
    return credit


# ── GET /credits/users/{user_id} ──────────────────────────────────────────────

@router.get("/users/{user_id}", response_model=CreditOut)
async def get_user_credits(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_gestionnaire),
):
    from app.models.user import User as UserModel
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    credit = await _get_or_create_credit(db, user_id)
    await db.commit()
    return credit


# ── GET /credits/users/{user_id}/transactions → redirect ─────────────────────

@router.get("/users/{user_id}/transactions")
async def get_user_transactions(
    user_id: int,
    current_user: User = Depends(require_admin_or_gestionnaire),
):
    return RedirectResponse(
        url=f"/events?entity_type=credit&id_user={user_id}",
        status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    )


# ── POST /credits/users/{user_id}/adjust ──────────────────────────────────────

@router.post("/users/{user_id}/adjust", response_model=CreditOut)
async def adjust_credits(
    user_id: int,
    payload: CreditAdjust,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    from app.models.user import User as UserModel
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    credit = await _get_or_create_credit(db, user_id)
    credit.balance += payload.amount

    event = EventLog(
        id_user=user_id,
        entity_type=EntityType.credit,
        entity_id=credit.id,
        event_type=EventType.credit_ajustement,
        new_value={"amount": float(payload.amount), "balance_after": float(credit.balance)},
        note=payload.note,
    )
    db.add(event)
    await db.commit()

    result = await db.execute(select(Credit).where(Credit.id == credit.id))
    return result.scalar_one()
