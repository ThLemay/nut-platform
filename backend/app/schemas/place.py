from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
from app.models.place import PlaceTypeEnum
from app.schemas.organization import AddressOut


class PlaceCreate(BaseModel):
    name: str = Field(..., description="Nom du lieu")
    place_type: PlaceTypeEnum = Field(..., description="Type de lieu")
    id_organization: Optional[int] = Field(None, description="Organisation propriétaire")
    id_parent: Optional[int] = Field(None, description="Lieu parent (ex: stand dans un centre commercial)")
    latitude: Optional[Decimal] = Field(None, description="Latitude GPS")
    longitude: Optional[Decimal] = Field(None, description="Longitude GPS")
    volume_capacity: Optional[Decimal] = Field(None, description="Capacité de stockage en litres")
    address: Optional[dict] = Field(None, description="Adresse optionnelle : {address, city, zipcode, country}")


class PlaceUpdate(BaseModel):
    name: Optional[str] = None
    place_type: Optional[PlaceTypeEnum] = None
    id_organization: Optional[int] = None
    id_parent: Optional[int] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    volume_capacity: Optional[Decimal] = None
    address: Optional[dict] = Field(None, description="Adresse : {address, city, zipcode, country}")


class PlaceOut(BaseModel):
    id: int
    name: str
    place_type: PlaceTypeEnum
    id_organization: Optional[int]
    id_parent: Optional[int]
    latitude: Optional[Decimal]
    longitude: Optional[Decimal]
    volume_capacity: Optional[Decimal]
    id_address: Optional[int]
    address: Optional[AddressOut] = None
    organization_name: Optional[str] = None

    model_config = {"from_attributes": True}
