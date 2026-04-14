from sqlalchemy import Column, BigInteger, DateTime, ForeignKey, String, Text, Enum as SAEnum, Numeric, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base
import enum

class OrderType(str, enum.Enum):
    lavage      = "lavage"
    transport   = "transport"
    contenants  = "contenants"
    machine     = "machine"

class OrderStatus(str, enum.Enum):
    brouillon           = "brouillon"
    envoyee             = "envoyee"         # envoyée aux prestataires proches
    acceptee            = "acceptee"        # un prestataire a accepté
    en_cours            = "en_cours"        # en cours de traitement
    controle_qualite    = "controle_qualite"
    prete               = "prete"           # prête à livrer / à récupérer
    en_transit          = "en_transit"
    livree              = "livree"          # réceptionnée par le client
    annulee             = "annulee"

class TransportResponsible(str, enum.Enum):
    client      = "client"       # le client livre/récupère lui-même
    laveur      = "laveur"       # le laveur assure le transport
    transporteur = "transporteur" # transporteur tiers

class Order(Base):
    """Commande unifiée — lavage, transport, contenants ou machine."""
    __tablename__ = "order"

    id               = Column(BigInteger, primary_key=True, autoincrement=True)
    order_type       = Column(SAEnum(OrderType),   nullable=False)
    status           = Column(SAEnum(OrderStatus), nullable=False, default=OrderStatus.brouillon)
    id_client        = Column(BigInteger, ForeignKey("organization.id"), nullable=False)
    id_provider      = Column(BigInteger, ForeignKey("organization.id"), nullable=True)   # assigné après acceptation
    id_parent_order  = Column(BigInteger, ForeignKey("order.id"),        nullable=True)   # ex: transport généré dpuis lavage
    qr_code          = Column(String(255), unique=True)    # QR code associé à la commande
    order_date       = Column(DateTime(timezone=True), server_default=func.now())
    desired_date     = Column(DateTime(timezone=True))     # date souhaitée par le client
    confirmed_date   = Column(DateTime(timezone=True))     # date confirmée
    note             = Column(Text)

    # Relations
    client        = relationship("Organization", foreign_keys=[id_client],   back_populates="orders_as_client")
    provider      = relationship("Organization", foreign_keys=[id_provider], back_populates="orders_as_provider")
    parent_order  = relationship("Order",        remote_side="Order.id",     backref="sub_orders")
    lines         = relationship("OrderLine",    back_populates="order")
    transport     = relationship("Transport",    back_populates="order",      uselist=False)
    stocks        = relationship("Stock",        back_populates="order")


class OrderLine(Base):
    """Détail d'une commande."""
    __tablename__ = "order_line"

    id                   = Column(BigInteger, primary_key=True, autoincrement=True)
    id_order             = Column(BigInteger, ForeignKey("order.id"),              nullable=False)
    id_cont_type         = Column(BigInteger, ForeignKey("container_type.id"),     nullable=True)
    id_cont_packaging    = Column(BigInteger, ForeignKey("cont_packaging_type.id"), nullable=True)
    quantity             = Column(BigInteger)
    unit_price           = Column(Numeric(10, 2))
    description          = Column(Text)

    # Relations
    order           = relationship("Order",            back_populates="lines")
    container_type  = relationship("ContainerType")
    packaging       = relationship("ContPackagingType")


class Transport(Base):
    """Bloc transport associé à une commande (optionnel)."""
    __tablename__ = "transport"

    id                   = Column(BigInteger, primary_key=True, autoincrement=True)
    id_order             = Column(BigInteger, ForeignKey("order.id"),         nullable=False, unique=True)
    id_transporter       = Column(BigInteger, ForeignKey("organization.id"),  nullable=True)  # null si client ou laveur
    responsible          = Column(SAEnum(TransportResponsible), nullable=False)
    id_pickup_place      = Column(BigInteger, ForeignKey("place.id"),         nullable=True)
    id_delivery_place    = Column(BigInteger, ForeignKey("place.id"),         nullable=True)
    accepted_slot_id     = Column(BigInteger, ForeignKey("transport_slot.id", use_alter=True, name="fk_transport_accepted_slot"), nullable=True)
    is_signed            = Column(Boolean, default=False)   # signature électronique client
    signed_at            = Column(DateTime(timezone=True))
    created_at           = Column(DateTime(timezone=True), server_default=func.now())

    # Relations
    order          = relationship("Order",        back_populates="transport")
    transporter    = relationship("Organization", foreign_keys=[id_transporter])
    pickup_place   = relationship("Place",        foreign_keys=[id_pickup_place])
    delivery_place = relationship("Place",        foreign_keys=[id_delivery_place])
    slots          = relationship("TransportSlot", back_populates="transport", foreign_keys="TransportSlot.id_transport")
    accepted_slot  = relationship("TransportSlot", foreign_keys=[accepted_slot_id])


class TransportSlot(Base):
    """Les 3 créneaux proposés par le transporteur au client."""
    __tablename__ = "transport_slot"

    id           = Column(BigInteger, primary_key=True, autoincrement=True)
    id_transport = Column(BigInteger, ForeignKey("transport.id"), nullable=False)
    slot_date    = Column(DateTime(timezone=True), nullable=False)
    is_accepted  = Column(Boolean, default=False)

    # Relations
    transport = relationship("Transport", back_populates="slots", foreign_keys=[id_transport])

TRANSITIONS_ORDER = {
    OrderStatus.brouillon: [OrderStatus.envoyee, OrderStatus.annulee],
    OrderStatus.envoyee: [OrderStatus.acceptee, OrderStatus.annulee],
    OrderStatus.acceptee: [OrderStatus.en_cours, OrderStatus.annulee],
    OrderStatus.en_cours: [
        OrderStatus.controle_qualite,
        OrderStatus.en_transit,
        OrderStatus.annulee,
    ],
    OrderStatus.controle_qualite: [
        OrderStatus.prete,
        OrderStatus.annulee,
    ],
    OrderStatus.prete: [
        OrderStatus.en_transit,
        OrderStatus.livree,
        OrderStatus.annulee,
    ],
    OrderStatus.en_transit: [
        OrderStatus.livree,
        OrderStatus.annulee,
    ],
    OrderStatus.livree: [],
    OrderStatus.annulee: [],
}