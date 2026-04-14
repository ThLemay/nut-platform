from sqlalchemy import Column, BigInteger, DateTime, ForeignKey, String, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base
import enum

class StockStatus(str, enum.Enum):
    en_cours    = "en_cours"
    ferme       = "ferme"
    en_transit  = "en_transit"
    archive     = "archive"

class Stock(Base):
    """Regroupement de contenants unitaires (ex: palette pour transport)."""
    __tablename__ = "stock"

    id           = Column(BigInteger, primary_key=True, autoincrement=True)
    name         = Column(String(100))
    status       = Column(SAEnum(StockStatus), nullable=False, default=StockStatus.en_cours)
    id_place     = Column(BigInteger, ForeignKey("place.id"), nullable=True)
    id_order     = Column(BigInteger, ForeignKey("order.id"), nullable=True)  # commande associée si transport
    id_owner_organization = Column(BigInteger, ForeignKey("organization.id"), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    note         = Column(Text)

    # Relations
    place               = relationship("Place",         back_populates="stocks")
    order               = relationship("Order",         back_populates="stocks")
    owner_organization  = relationship("Organization",  foreign_keys=[id_owner_organization])
    containers          = relationship("Container",     back_populates="current_stock", foreign_keys="Container.id_current_stock")
    entries             = relationship("StockContainer", back_populates="stock")


class StockContainer(Base):
    """Table de liaison stock ↔ container avec historique d'entrée/sortie."""
    __tablename__ = "stock_container"

    id           = Column(BigInteger, primary_key=True, autoincrement=True)
    id_stock     = Column(BigInteger, ForeignKey("stock.id"),     nullable=False)
    id_container = Column(BigInteger, ForeignKey("container.id"), nullable=False)
    added_at     = Column(DateTime(timezone=True), server_default=func.now())
    removed_at   = Column(DateTime(timezone=True), nullable=True)  # null = toujours dans le stock

    # Relations
    stock     = relationship("Stock",     back_populates="entries")
    container = relationship("Container", back_populates="stock_entries")
