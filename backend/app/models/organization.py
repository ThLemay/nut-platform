from sqlalchemy import Column, BigInteger, String, Boolean, DateTime, Integer, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class Address(Base):
    __tablename__ = "address"

    id        = Column(BigInteger, primary_key=True, autoincrement=True)
    address   = Column(String(100))
    city      = Column(String(50))
    zipcode   = Column(String(10))
    country   = Column(String(50))
    latitude  = Column(Numeric(10, 7))
    longitude = Column(Numeric(10, 7))

    # Relations
    organizations = relationship("Organization", back_populates="address")
    places        = relationship("Place",        back_populates="address")


class Organization(Base):
    __tablename__ = "organization"

    id                  = Column(BigInteger, primary_key=True, autoincrement=True)
    name                = Column(String(100), nullable=False)
    siren               = Column(String(9),   unique=True)
    siret               = Column(String(14),  unique=True)
    description         = Column(Text)
    status              = Column(Integer, nullable=False, default=1)   # 1=active, 0=inactive
    creation_date       = Column(DateTime(timezone=True), server_default=func.now())
    id_address          = Column(BigInteger, ForeignKey("address.id"))
    id_parent           = Column(BigInteger, ForeignKey("organization.id"), nullable=True)

    # Flags de rôle — une orga peut avoir plusieurs rôles
    is_food_provider    = Column(Boolean, nullable=False, default=False)
    is_cont_washer      = Column(Boolean, nullable=False, default=False)
    is_cont_transporter = Column(Boolean, nullable=False, default=False)
    is_cont_stockeur    = Column(Boolean, nullable=False, default=False)
    is_cont_recycleur   = Column(Boolean, nullable=False, default=False)
    is_cont_destructeur = Column(Boolean, nullable=False, default=False)
    is_cont_provider    = Column(Boolean, nullable=False, default=False)  # fournisseur (géré par NUT)

    # Relations
    address  = relationship("Address",      back_populates="organizations")
    parent   = relationship("Organization", remote_side="Organization.id", backref="subsidiaries")
    users    = relationship("User",         back_populates="organization")
    places   = relationship("Place",        back_populates="organization")
    credits  = relationship("Credit",       back_populates="organization")
    orders_as_client   = relationship("Order", foreign_keys="Order.id_client",   back_populates="client")
    orders_as_provider = relationship("Order", foreign_keys="Order.id_provider", back_populates="provider")
