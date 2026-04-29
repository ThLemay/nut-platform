# Importer tous les modèles ici pour qu'Alembic les découvre automatiquement
from app.db.database import Base
from app.models.user         import User, UserRole, UserStatus
from app.models.organization import Organization, Address
from app.models.place        import Place, PlaceTypeEnum
from app.models.container    import Container, ContainerType, ContPackagingType, ContainerStatus, OwnershipType
from app.models.stock        import Stock, StockContainer, StockStatus
from app.models.order        import Order, OrderLine, Transport, TransportSlot, OrderType, OrderStatus
from app.models.credit       import Credit, CreditConfig
from app.models.event_log    import EventLog, EventType, EntityType
from app.models.reference    import PlaceTypeRef, OrderTypeRef, ContainerStatusRef, StockStatusRef, EventTypeRef
from app.models.notification import Notification

__all__ = [
    "Base",
    "User", "UserRole", "UserStatus",
    "Organization", "Address",
    "Place", "PlaceTypeEnum",
    "Container", "ContainerType", "ContPackagingType", "ContainerStatus", "OwnershipType",
    "Stock", "StockContainer", "StockStatus",
    "Order", "OrderLine", "Transport", "TransportSlot", "OrderType", "OrderStatus",
    "Credit", "CreditConfig",
    "EventLog", "EventType", "EntityType",
    "PlaceTypeRef", "OrderTypeRef", "ContainerStatusRef", "StockStatusRef", "EventTypeRef",
    "Notification",
]
