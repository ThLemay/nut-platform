import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.container import Container, ContainerStatus
from app.models.order import Order, OrderStatus
from app.models.organization import Organization
from app.models.user import User, UserRole

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Roles whose org acts as a prestataire (no container stats, provider-side orders only).
# Listed as strings so the check works even before these values are added to UserRole.
_PRESTATAIRE_ROLE_VALUES = frozenset({
    "laveur", "transporteur", "stockeur", "recycleur", "destructeur",
})


class DashboardStats(BaseModel):
    # Contenants
    contenants_total: int
    contenants_propres: int
    contenants_en_consigne: int
    contenants_sales: int
    contenants_en_lavage: int
    contenants_en_transit: int
    contenants_perdus: int
    contenants_a_detruire: int

    # Commandes
    commandes_brouillon: int
    commandes_en_cours: int
    commandes_livrees_ce_mois: int

    # Organisations & utilisateurs
    organisations_total: int
    utilisateurs_total: int
    membres_organisation: int = 0   # gestionnaire : membres de l'org


# ── helpers ────────────────────────────────────────────────────────────────

async def _count(db: AsyncSession, stmt) -> int:
    result = await db.execute(stmt)
    return result.scalar() or 0


def _month_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _require_org(user: User) -> int:
    if user.id_organization is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : aucune organisation associée à ce compte",
        )
    return user.id_organization


_STATUTS_EN_COURS = [
    OrderStatus.envoyee,
    OrderStatus.acceptee,
    OrderStatus.en_cours,
    OrderStatus.controle_qualite,
    OrderStatus.prete,
    OrderStatus.en_transit,
]


# ── per-role stat builders ──────────────────────────────────────────────────

async def _stats_admin(db: AsyncSession) -> DashboardStats:
    month_start = _month_start()
    ACTIVE = Container.is_active == True  # noqa: E712

    def ct_count(st: ContainerStatus):
        return select(func.count()).select_from(Container).where(ACTIVE, Container.status == st)

    (
        contenants_total,
        contenants_propres,
        contenants_en_consigne,
        contenants_sales,
        contenants_en_lavage,
        contenants_en_transit,
        contenants_perdus,
        contenants_a_detruire,
        commandes_brouillon,
        commandes_en_cours,
        commandes_livrees_ce_mois,
        organisations_total,
        utilisateurs_total,
    ) = await asyncio.gather(
        _count(db, select(func.count()).select_from(Container).where(ACTIVE)),
        _count(db, ct_count(ContainerStatus.propre)),
        _count(db, ct_count(ContainerStatus.en_consigne)),
        _count(db, ct_count(ContainerStatus.sale)),
        _count(db, ct_count(ContainerStatus.en_lavage)),
        _count(db, ct_count(ContainerStatus.en_transit)),
        _count(db, ct_count(ContainerStatus.perdu)),
        _count(db, ct_count(ContainerStatus.a_detruire)),
        _count(db, select(func.count()).select_from(Order).where(
            Order.status == OrderStatus.brouillon,
        )),
        _count(db, select(func.count()).select_from(Order).where(
            Order.status.in_(_STATUTS_EN_COURS),
        )),
        _count(db, select(func.count()).select_from(Order).where(
            Order.status == OrderStatus.livree,
            Order.order_date >= month_start,
        )),
        _count(db, select(func.count()).select_from(Organization)),
        _count(db, select(func.count()).select_from(User)),
    )

    return DashboardStats(
        contenants_total=contenants_total,
        contenants_propres=contenants_propres,
        contenants_en_consigne=contenants_en_consigne,
        contenants_sales=contenants_sales,
        contenants_en_lavage=contenants_en_lavage,
        contenants_en_transit=contenants_en_transit,
        contenants_perdus=contenants_perdus,
        contenants_a_detruire=contenants_a_detruire,
        commandes_brouillon=commandes_brouillon,
        commandes_en_cours=commandes_en_cours,
        commandes_livrees_ce_mois=commandes_livrees_ce_mois,
        organisations_total=organisations_total,
        utilisateurs_total=utilisateurs_total,
    )


async def _stats_gestionnaire(db: AsyncSession, org_id: int) -> DashboardStats:
    month_start = _month_start()

    ACTIVE_ORG = (Container.is_active == True, Container.id_owner_organization == org_id)  # noqa: E712
    CLIENT_OR_PROVIDER = or_(Order.id_client == org_id, Order.id_provider == org_id)

    def ct_count(st: ContainerStatus):
        return select(func.count()).select_from(Container).where(*ACTIVE_ORG, Container.status == st)

    (
        contenants_total,
        contenants_propres,
        contenants_en_consigne,
        contenants_sales,
        contenants_en_lavage,
        contenants_en_transit,
        contenants_perdus,
        contenants_a_detruire,
        commandes_brouillon,
        commandes_en_cours,
        commandes_livrees_ce_mois,
        membres_organisation,
    ) = await asyncio.gather(
        _count(db, select(func.count()).select_from(Container).where(*ACTIVE_ORG)),
        _count(db, ct_count(ContainerStatus.propre)),
        _count(db, ct_count(ContainerStatus.en_consigne)),
        _count(db, ct_count(ContainerStatus.sale)),
        _count(db, ct_count(ContainerStatus.en_lavage)),
        _count(db, ct_count(ContainerStatus.en_transit)),
        _count(db, ct_count(ContainerStatus.perdu)),
        _count(db, ct_count(ContainerStatus.a_detruire)),
        _count(db, select(func.count()).select_from(Order).where(
            CLIENT_OR_PROVIDER,
            Order.status == OrderStatus.brouillon,
        )),
        _count(db, select(func.count()).select_from(Order).where(
            CLIENT_OR_PROVIDER,
            Order.status.in_(_STATUTS_EN_COURS),
        )),
        _count(db, select(func.count()).select_from(Order).where(
            CLIENT_OR_PROVIDER,
            Order.status == OrderStatus.livree,
            Order.order_date >= month_start,
        )),
        _count(db, select(func.count()).select_from(User).where(
            User.id_organization == org_id,
        )),
    )

    return DashboardStats(
        contenants_total=contenants_total,
        contenants_propres=contenants_propres,
        contenants_en_consigne=contenants_en_consigne,
        contenants_sales=contenants_sales,
        contenants_en_lavage=contenants_en_lavage,
        contenants_en_transit=contenants_en_transit,
        contenants_perdus=contenants_perdus,
        contenants_a_detruire=contenants_a_detruire,
        commandes_brouillon=commandes_brouillon,
        commandes_en_cours=commandes_en_cours,
        commandes_livrees_ce_mois=commandes_livrees_ce_mois,
        organisations_total=0,
        utilisateurs_total=0,
        membres_organisation=membres_organisation,
    )


async def _stats_prestataire(db: AsyncSession, org_id: int) -> DashboardStats:
    month_start = _month_start()
    PROVIDER = Order.id_provider == org_id

    (
        commandes_brouillon,
        commandes_en_cours,
        commandes_livrees_ce_mois,
    ) = await asyncio.gather(
        _count(db, select(func.count()).select_from(Order).where(
            PROVIDER,
            Order.status == OrderStatus.brouillon,
        )),
        _count(db, select(func.count()).select_from(Order).where(
            PROVIDER,
            Order.status.in_(_STATUTS_EN_COURS),
        )),
        _count(db, select(func.count()).select_from(Order).where(
            PROVIDER,
            Order.status == OrderStatus.livree,
            Order.order_date >= month_start,
        )),
    )

    return DashboardStats(
        contenants_total=0,
        contenants_propres=0,
        contenants_en_consigne=0,
        contenants_sales=0,
        contenants_en_lavage=0,
        contenants_en_transit=0,
        contenants_perdus=0,
        contenants_a_detruire=0,
        commandes_brouillon=commandes_brouillon,
        commandes_en_cours=commandes_en_cours,
        commandes_livrees_ce_mois=commandes_livrees_ce_mois,
        organisations_total=0,
        utilisateurs_total=0,
    )


# ── endpoint ────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = current_user.role
    role_value = role.value if hasattr(role, "value") else str(role)

    if role == UserRole.admin_nut:
        return await _stats_admin(db)

    if role == UserRole.gestionnaire_organisation:
        org_id = _require_org(current_user)
        return await _stats_gestionnaire(db, org_id)

    if role_value in _PRESTATAIRE_ROLE_VALUES:
        org_id = _require_org(current_user)
        return await _stats_prestataire(db, org_id)

    # operateur, consommateur, and any other roles
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Accès refusé",
    )
