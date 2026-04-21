from sqlalchemy import Column, BigInteger, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base
import enum


class EventType(str, enum.Enum):
    # Container
    container_scan          = "container_scan"
    container_status_change = "container_status_change"
    container_created       = "container_created"
    # Credits
    credit_gain             = "credit_gain"
    credit_depense          = "credit_depense"
    credit_ajustement       = "credit_ajustement"
    # Quality
    quality_check           = "quality_check"
    quality_check_result    = "quality_check_result"
    # Orders
    order_created           = "order_created"
    order_status_change     = "order_status_change"


class EntityType(str, enum.Enum):
    container   = "container"
    order       = "order"
    credit      = "credit"
    stock       = "stock"
    user        = "user"


class EventLog(Base):
    __tablename__ = "event_log"

    id         = Column(BigInteger, primary_key=True, autoincrement=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Qui
    id_user = Column(BigInteger, ForeignKey("user.id"), nullable=True)
    id_org  = Column(BigInteger, ForeignKey("organization.id"), nullable=True)

    # Sur quoi
    entity_type = Column(SAEnum(EntityType), nullable=False, index=True)
    entity_id   = Column(BigInteger, nullable=False, index=True)

    # Quoi
    event_type = Column(SAEnum(EventType), nullable=False, index=True)
    old_value  = Column(JSONB, nullable=True)
    new_value  = Column(JSONB, nullable=True)

    # Contexte
    id_place = Column(BigInteger, ForeignKey("place.id"), nullable=True)
    note     = Column(Text, nullable=True)
    meta     = Column(JSONB, nullable=True)

    # Relations
    user  = relationship("User")
    org   = relationship("Organization")
    place = relationship("Place")
