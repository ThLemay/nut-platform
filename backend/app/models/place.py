from sqlalchemy import Column, BigInteger, String, ForeignKey, Numeric, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.db.database import Base
import enum

class PlaceTypeEnum(str, enum.Enum):
    restaurant          = "restaurant"
    cuisine_collective  = "cuisine_collective"
    laveur              = "laveur"
    entrepot            = "entrepot"
    point_collecte      = "point_collecte"
    centre_commercial   = "centre_commercial"
    camion              = "camion"
    recycleur           = "recycleur"
    destructeur         = "destructeur"
    autre               = "autre"

class Place(Base):
    __tablename__ = "place"

    id               = Column(BigInteger, primary_key=True, autoincrement=True)
    name             = Column(String(100), nullable=False)
    place_type       = Column(SAEnum(PlaceTypeEnum), nullable=False)
    id_organization  = Column(BigInteger, ForeignKey("organization.id"), nullable=True)
    id_address       = Column(BigInteger, ForeignKey("address.id"),      nullable=True)
    id_parent        = Column(BigInteger, ForeignKey("place.id"),        nullable=True)  # ex: stand dans un centre commercial
    latitude         = Column(Numeric(10, 7))
    longitude        = Column(Numeric(10, 7))
    volume_capacity  = Column(Numeric(10, 2))  # capacité de stockage en litres

    # Relations
    organization = relationship("Organization",  back_populates="places")
    address      = relationship("Address",       back_populates="places")
    parent       = relationship("Place",         remote_side="Place.id", backref="sub_places")
    containers   = relationship("Container",     back_populates="current_place")
    stocks       = relationship("Stock",         back_populates="place")
