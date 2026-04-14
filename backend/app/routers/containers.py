import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy import func as safunc

from app.db.database import get_db
from app.dependencies import require_role, get_current_user
from app.models.user import UserRole, User
from app.models.container import Container, ContainerStatus, ContainerType, ContainerStatusHistory, TRANSITIONS_AUTORISEES
from app.models.organization import Organization
from app.models.stock import Stock, StockStatus, StockContainer
from app.models.credit import Credit, CreditTransaction, CreditConfig, CreditTransactionType
from app.schemas.container import (
    ContainerCreate, ContainerBatchCreate, ContainerOut, ContainerBatchOut,
    ContainerStatusUpdate, ContainerStatusOut,
    ContainerHistoryEntry, ContainerHistoryOut,
)

router = APIRouter(prefix="/containers", tags=["containers"])


def require_not_consommateur():
    async def check(current_user: User = Depends(get_current_user)):
        if current_user.role == UserRole.consommateur:
            raise HTTPException(status_code=403, detail="Accès refusé")
        return current_user
    return check


async def _get_nut_org_id(db: AsyncSession) -> int | None:
    """Retourne l'id de l'organisation 'NUT', ou None si absente."""
    result = await db.execute(select(Organization).where(Organization.name == "NUT"))
    org = result.scalar_one_or_none()
    return org.id if org else None


@router.post("", response_model=ContainerOut, status_code=status.HTTP_201_CREATED)
async def create_container(
    payload: ContainerCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_role(UserRole.admin_nut)),
):
    nut_org_id = await _get_nut_org_id(db)

    container = Container(
        uid=payload.uid or str(uuid.uuid4()),
        id_cont_type=payload.id_cont_type,
        status=ContainerStatus.propre,
        id_owner_organization=nut_org_id,
        ownership_type=payload.ownership_type,
        purchase_price=payload.purchase_price,
        first_use_date=payload.first_use_date,
        batch_number=payload.batch_number,
    )
    db.add(container)
    await db.commit()
    await db.refresh(container)
    return container


@router.post("/batch", response_model=ContainerBatchOut, status_code=status.HTTP_201_CREATED)
async def create_containers_batch(
    payload: ContainerBatchCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_role(UserRole.admin_nut)),
):
    nut_org_id = await _get_nut_org_id(db)

    containers = [
        Container(
            uid=str(uuid.uuid4()),
            id_cont_type=payload.id_cont_type,
            status=ContainerStatus.propre,
            id_owner_organization=nut_org_id,
            ownership_type=payload.ownership_type,
            purchase_price=payload.purchase_price,
            batch_number=payload.batch_number,
        )
        for _ in range(payload.quantity)
    ]

    db.add_all(containers)
    await db.flush()

    # Récupérer le nom du type de contenant
    result = await db.execute(select(ContainerType).where(ContainerType.id == payload.id_cont_type))
    cont_type = result.scalar_one_or_none()
    type_name = cont_type.name if cont_type else f"Type {payload.id_cont_type}"

    # Calculer le numéro d'itération du jour
    prefix = f"Batch {date.today()} — {type_name} x{payload.quantity}"
    count_result = await db.execute(
        select(safunc.count()).select_from(Stock).where(Stock.name.like(f"{prefix}%"))
    )
    count = count_result.scalar() or 0
    stock_name = f"{prefix} #{str(count + 1).zfill(3)}"

    # Créer le stock
    stock = Stock(
        name=stock_name,
        status=StockStatus.en_cours,
        id_owner_organization=nut_org_id,
    )
    db.add(stock)
    await db.flush()

    # Associer chaque contenant au stock
    for container in containers:
        container.id_current_stock = stock.id
        db.add(StockContainer(id_stock=stock.id, id_container=container.id))

    await db.commit()
    for c in containers:
        await db.refresh(c)

    return ContainerBatchOut(count=len(containers), containers=containers, id_stock=stock.id, stock_name=stock.name)


@router.patch("/{uid}/status", response_model=ContainerStatusOut)
async def update_container_status(
    uid: str,
    payload: ContainerStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_not_consommateur()),
):
    result = await db.execute(select(Container).where(Container.uid == uid))
    container = result.scalar_one_or_none()
    if not container:
        raise HTTPException(status_code=404, detail="Contenant introuvable")

    if not container.is_active:
        raise HTTPException(status_code=400, detail="Contenant inactif")

    if payload.status not in TRANSITIONS_AUTORISEES[container.status]:
        raise HTTPException(
            status_code=400,
            detail=f"Transition {container.status} → {payload.status} non autorisée",
        )

    container.status = payload.status
    if payload.id_place is not None:
        container.id_current_place = payload.id_place
    if payload.status in (ContainerStatus.detruit, ContainerStatus.perdu):
        container.is_active = False

    history = ContainerStatusHistory(
        id_container=container.id,
        status=payload.status,
        id_place=payload.id_place,
        id_updated_by=current_user.id,
        scan_method=payload.scan_method,
        note=payload.note,
    )
    db.add(history)

    # Attribution de crédits lors du retour d'un contenant (scan par gestionnaire)
    if payload.status == ContainerStatus.sale and payload.id_beneficiaire is not None:
        benef_result = await db.execute(select(User).where(User.id == payload.id_beneficiaire))
        beneficiaire = benef_result.scalar_one_or_none()
        if not beneficiaire:
            raise HTTPException(status_code=404, detail="Utilisateur bénéficiaire introuvable")

        # 1. Config spécifique à l'orga du gestionnaire qui scanne
        config = None
        if current_user.id_organization is not None:
            config_result = await db.execute(
                select(CreditConfig).where(
                    CreditConfig.id_organization == current_user.id_organization,
                    CreditConfig.id_cont_type == container.id_cont_type,
                )
            )
            config = config_result.scalar_one_or_none()

        # 2. Fallback sur config globale NUT
        if config is None:
            nut_config_result = await db.execute(
                select(CreditConfig)
                .join(Organization, CreditConfig.id_organization == Organization.id)
                .where(
                    Organization.name == "NUT",
                    CreditConfig.id_cont_type == container.id_cont_type,
                )
            )
            config = nut_config_result.scalar_one_or_none()
        if config is not None:
            credit_result = await db.execute(
                select(Credit).where(Credit.id_user == beneficiaire.id)
            )
            credit = credit_result.scalar_one_or_none()
            if credit is None:
                credit = Credit(id_user=beneficiaire.id, balance=0)
                db.add(credit)
                await db.flush()
            db.add(CreditTransaction(
                id_credit=credit.id,
                id_user=beneficiaire.id,
                id_container=container.id,
                type=CreditTransactionType.gain,
                amount=config.credit_amount,
                note="Retour contenant automatique",
            ))
            credit.balance += config.credit_amount

    await db.commit()
    await db.refresh(container)
    return container


@router.get("/{uid}/history", response_model=ContainerHistoryOut)
async def get_container_history(
    uid: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_not_consommateur()),
):
    result = await db.execute(select(Container).where(Container.uid == uid))
    container = result.scalar_one_or_none()
    if not container:
        raise HTTPException(status_code=404, detail="Contenant introuvable")

    result = await db.execute(
        select(ContainerStatusHistory)
        .where(ContainerStatusHistory.id_container == container.id)
        .order_by(ContainerStatusHistory.changed_at.asc())
    )
    entries = result.scalars().all()

    return ContainerHistoryOut(
        uid=container.uid,
        total_entries=len(entries),
        history=entries,
    )
