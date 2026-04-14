from sqlalchemy import Column, BigInteger, Numeric, DateTime, ForeignKey, Text, Enum as SAEnum, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base
import enum

class CreditTransactionType(str, enum.Enum):
    gain        = "gain"        # consommateur rend un contenant
    depense     = "depense"     # consommateur utilise ses crédits
    ajustement  = "ajustement"  # correction manuelle admin

class Credit(Base):
    """Solde de crédits d'un consommateur (système de fidélité)."""
    __tablename__ = "credit"

    id              = Column(BigInteger, primary_key=True, autoincrement=True)
    id_user         = Column(BigInteger, ForeignKey("user.id"),         nullable=False, unique=True)
    id_organization = Column(BigInteger, ForeignKey("organization.id"), nullable=True)  # si crédits liés à une orga
    balance         = Column(Numeric(10, 2), default=0)
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relations
    user         = relationship("User",         back_populates="credit")
    organization = relationship("Organization", back_populates="credits")
    transactions = relationship("CreditTransaction", back_populates="credit", order_by="CreditTransaction.created_at.desc()")


class CreditTransaction(Base):
    """Historique de chaque mouvement de crédits."""
    __tablename__ = "credit_transaction"

    id           = Column(BigInteger, primary_key=True, autoincrement=True)
    id_credit    = Column(BigInteger, ForeignKey("credit.id"),    nullable=False)
    id_user      = Column(BigInteger, ForeignKey("user.id"),      nullable=False)
    id_container = Column(BigInteger, ForeignKey("container.id"), nullable=True)  # contenant rendu
    type         = Column(SAEnum(CreditTransactionType), nullable=False)
    amount       = Column(Numeric(10, 2), nullable=False)
    note         = Column(Text)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    # Relations
    credit    = relationship("Credit",    back_populates="transactions")
    user      = relationship("User",      back_populates="credit_transactions")
    container = relationship("Container")


class CreditConfig(Base):
    """Configuration des crédits par organisation et type de contenant."""
    __tablename__ = "credit_config"

    id              = Column(BigInteger, primary_key=True, autoincrement=True)
    id_organization = Column(BigInteger, ForeignKey("organization.id"), nullable=False)
    id_cont_type    = Column(BigInteger, ForeignKey("container_type.id"), nullable=False)
    credit_amount   = Column(Numeric(10, 2), nullable=False, default=1)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    # Contrainte unicité : une orga ne peut avoir qu'une config par type
    __table_args__ = (
        UniqueConstraint('id_organization', 'id_cont_type', name='uq_credit_config_org_type'),
    )

    # Relations
    organization   = relationship("Organization")
    container_type = relationship("ContainerType")
