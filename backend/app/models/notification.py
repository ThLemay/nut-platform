from sqlalchemy import Column, BigInteger, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class Notification(Base):
    __tablename__ = "notification"

    id               = Column(BigInteger, primary_key=True, autoincrement=True)
    id_user          = Column(BigInteger, ForeignKey("user.id"), nullable=False, index=True)
    type             = Column(String(50), nullable=False)
    message          = Column(String(500), nullable=False)
    is_read          = Column(Boolean, default=False, nullable=False)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    id_related_order = Column(BigInteger, ForeignKey("order.id"), nullable=True)

    user  = relationship("User")
    order = relationship("Order")
