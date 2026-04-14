# Importer tous les modèles ici pour qu'Alembic les découvre automatiquement
from app.db.database import Base
from app.models.user         import User, UserRole, UserStatus
from app.models.organization import Organization, Address
from app.models.place        import Place, PlaceTypeEnum
from app.models.container    import Container, ContainerType, ContPackagingType, ContainerStatusHistory, ContainerStatus, QualityCheck, OwnershipType, QualityCheckResult
from app.models.stock        import Stock, StockContainer, StockStatus
from app.models.order        import Order, OrderLine, Transport, TransportSlot, OrderType, OrderStatus
from app.models.credit       import Credit, CreditTransaction, CreditTransactionType, CreditConfig

__all__ = [
    "Base",
    "User", "UserRole", "UserStatus",
    "Organization", "Address",
    "Place", "PlaceTypeEnum",
    "Container", "ContainerType", "ContPackagingType", "ContainerStatusHistory", "ContainerStatus",
    "QualityCheck", "OwnershipType", "QualityCheckResult",
    "Stock", "StockContainer", "StockStatus",
    "Order", "OrderLine", "Transport", "TransportSlot", "OrderType", "OrderStatus",
    "Credit", "CreditTransaction", "CreditTransactionType", "CreditConfig",
]
