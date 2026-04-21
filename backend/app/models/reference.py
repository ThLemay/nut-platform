from sqlalchemy import Column, BigInteger, String
from app.db.database import Base


class PlaceTypeRef(Base):
    __tablename__ = "ref_place_type"
    id    = Column(BigInteger, primary_key=True, autoincrement=True)
    code  = Column(String(50), nullable=False, unique=True)
    label = Column(String(100), nullable=False)


class OrderTypeRef(Base):
    __tablename__ = "ref_order_type"
    id    = Column(BigInteger, primary_key=True, autoincrement=True)
    code  = Column(String(50), nullable=False, unique=True)
    label = Column(String(100), nullable=False)


class ContainerStatusRef(Base):
    __tablename__ = "ref_container_status"
    id    = Column(BigInteger, primary_key=True, autoincrement=True)
    code  = Column(String(50), nullable=False, unique=True)
    label = Column(String(100), nullable=False)
    color = Column(String(7), nullable=True)
    order = Column(BigInteger, default=0)


class StockStatusRef(Base):
    __tablename__ = "ref_stock_status"
    id    = Column(BigInteger, primary_key=True, autoincrement=True)
    code  = Column(String(50), nullable=False, unique=True)
    label = Column(String(100), nullable=False)


class EventTypeRef(Base):
    __tablename__ = "ref_event_type"
    id    = Column(BigInteger, primary_key=True, autoincrement=True)
    code  = Column(String(50), nullable=False, unique=True)
    label = Column(String(100), nullable=False)
