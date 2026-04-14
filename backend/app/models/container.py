from sqlalchemy import Column, BigInteger, String, Boolean, DateTime, ForeignKey, Numeric, Text, Enum as SAEnum, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base
import enum
import uuid

class ContainerStatus(str, enum.Enum):
    propre      = "propre"
    en_consigne = "en_consigne"
    sale        = "sale"
    en_lavage   = "en_lavage"
    en_transit  = "en_transit"
    perdu       = "perdu"
    a_detruire  = "a_detruire"
    detruit     = "detruit"

class OwnershipType(str, enum.Enum):
    achat    = "achat"
    location = "location"

class QualityCheckResult(str, enum.Enum):
    apte          = "apte"
    a_surveiller  = "a_surveiller"
    inapte        = "inapte"


TRANSITIONS_AUTORISEES: dict[ContainerStatus, list[ContainerStatus]] = {
    ContainerStatus.propre:      [ContainerStatus.en_consigne, ContainerStatus.en_transit],
    ContainerStatus.en_consigne: [ContainerStatus.sale],
    ContainerStatus.sale:        [ContainerStatus.en_lavage, ContainerStatus.en_transit, ContainerStatus.a_detruire],
    ContainerStatus.en_lavage:   [ContainerStatus.propre, ContainerStatus.a_detruire],
    ContainerStatus.en_transit:  [ContainerStatus.propre, ContainerStatus.sale, ContainerStatus.en_consigne],
    ContainerStatus.perdu:      [ContainerStatus.propre, ContainerStatus.a_detruire],
    ContainerStatus.a_detruire: [ContainerStatus.detruit],
    ContainerStatus.detruit:    [],
}


class ContainerType(Base):
    """Définit les caractéristiques physiques d'un modèle de contenant."""
    __tablename__ = "container_type"

    id               = Column(BigInteger, primary_key=True, autoincrement=True)
    name             = Column(String(100), nullable=False)
    description      = Column(Text)
    literage         = Column(Numeric(6, 2))       # volume en litres
    weight           = Column(Numeric(6, 3))        # poids à vide en kg
    width            = Column(Numeric(8, 2))        # mm
    length           = Column(Numeric(8, 2))        # mm
    height           = Column(Numeric(8, 2))        # mm
    stacking_height  = Column(Numeric(8, 2))        # mm empilé
    material         = Column(String(50))
    sealable         = Column(Boolean, default=False)
    max_wash_cycles  = Column(Integer)              # durée de vie en nb lavages
    color                   = Column(String(50), nullable=True)
    temp_min                = Column(Integer, nullable=True)        # °C
    temp_max                = Column(Integer, nullable=True)        # °C
    wash_recommendations    = Column(Text, nullable=True)
    quality_check_interval  = Column(Integer, default=20)           # nb lavages entre contrôles
    id_supplier             = Column(BigInteger, ForeignKey("organization.id"), nullable=True)

    # Relations
    containers       = relationship("Container",          back_populates="container_type")
    packaging_types  = relationship("ContPackagingType",  back_populates="container_type")
    supplier         = relationship("Organization",       foreign_keys=[id_supplier])


class ContPackagingType(Base):
    """Conditionnement logistique d'un type de contenant (pour commandes et transport)."""
    __tablename__ = "cont_packaging_type"

    id               = Column(BigInteger, primary_key=True, autoincrement=True)
    id_cont_type     = Column(BigInteger, ForeignKey("container_type.id"), nullable=False)
    name             = Column(String(100))
    pieces_per_bag   = Column(BigInteger)
    bag_per_box      = Column(BigInteger)
    box_per_pallet   = Column(BigInteger)
    width_box        = Column(Numeric(8, 2))
    length_box       = Column(Numeric(8, 2))
    height_box       = Column(Numeric(8, 2))
    weight_box       = Column(Numeric(8, 3))

    # Relations
    container_type = relationship("ContainerType", back_populates="packaging_types")


class Container(Base):
    """Un contenant physique unitaire — cœur de la traçabilité."""
    __tablename__ = "container"

    id               = Column(BigInteger, primary_key=True, autoincrement=True)
    uid              = Column(String(100), nullable=False, unique=True, index=True)
    # uid généré automatiquement (UUID) mais modifiable par le gestionnaire
    id_cont_type     = Column(BigInteger, ForeignKey("container_type.id"), nullable=False)
    status           = Column(SAEnum(ContainerStatus), nullable=False, default=ContainerStatus.propre)
    id_current_place = Column(BigInteger, ForeignKey("place.id"), nullable=True)
    id_current_stock = Column(BigInteger, ForeignKey("stock.id"), nullable=True)
    creation_date    = Column(DateTime(timezone=True), server_default=func.now())
    total_wash_count = Column(Integer, default=0)     # nb de lavages effectués
    total_km         = Column(Numeric(10, 2), default=0)  # km parcourus (calculé)
    is_active        = Column(Boolean, default=True)  # False si détruit/perdu définitivement
    id_owner_organization = Column(BigInteger, ForeignKey("organization.id"), nullable=True)
    ownership_type        = Column(SAEnum(OwnershipType), nullable=True)
    purchase_price        = Column(Numeric(10, 2), nullable=True)
    first_use_date        = Column(DateTime(timezone=True), nullable=True)
    batch_number          = Column(String(100), nullable=True)
    last_quality_check    = Column(DateTime(timezone=True), nullable=True)
    quality_check_count   = Column(Integer, default=0)

    # Relations
    container_type      = relationship("ContainerType", back_populates="containers")
    current_place       = relationship("Place",         back_populates="containers")
    current_stock       = relationship("Stock",         back_populates="containers", foreign_keys=[id_current_stock])
    status_history      = relationship("ContainerStatusHistory", back_populates="container", order_by="ContainerStatusHistory.changed_at")
    stock_entries       = relationship("StockContainer", back_populates="container")
    owner_organization  = relationship("Organization",  foreign_keys=[id_owner_organization])


class ContainerStatusHistory(Base):
    """Chaque changement de statut d'un contenant — source de toute la data analytique."""
    __tablename__ = "container_status_history"

    id                  = Column(BigInteger, primary_key=True, autoincrement=True)
    id_container        = Column(BigInteger, ForeignKey("container.id"), nullable=False)
    status              = Column(SAEnum(ContainerStatus), nullable=False)
    id_place            = Column(BigInteger, ForeignKey("place.id"), nullable=True)
    id_updated_by       = Column(BigInteger, ForeignKey("user.id"),  nullable=True)
    changed_at          = Column(DateTime(timezone=True), server_default=func.now())
    scan_method         = Column(String(20))   # "qr_code" | "rfid" | "manual"
    note                = Column(Text)
    id_responsible_org  = Column(BigInteger, ForeignKey("organization.id"), nullable=True)

    # Relations
    container       = relationship("Container", back_populates="status_history")
    place           = relationship("Place")
    updated_by      = relationship("User", back_populates="container_status_history")
    responsible_org = relationship("Organization", foreign_keys=[id_responsible_org])


class QualityCheck(Base):
    """Contrôle qualité effectué sur un contenant."""
    __tablename__ = "quality_check"

    id           = Column(BigInteger, primary_key=True, autoincrement=True)
    id_container = Column(BigInteger, ForeignKey("container.id"), nullable=False)
    id_operator  = Column(BigInteger, ForeignKey("user.id"), nullable=True)
    checked_at   = Column(DateTime(timezone=True), server_default=func.now())
    result       = Column(SAEnum(QualityCheckResult), nullable=False)
    note         = Column(Text, nullable=True)

    # Relations
    container = relationship("Container")
    operator  = relationship("User")
