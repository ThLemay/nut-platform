from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
from datetime import datetime
from app.models.order import OrderType, OrderStatus, TransportResponsible


class OrderLineCreate(BaseModel):
    id_cont_type: int = Field(..., description="ID du type de contenant")
    id_cont_packaging: Optional[int] = Field(None, description="ID du conditionnement (bag). Obligatoire pour commande contenants")
    quantity: int = Field(..., ge=1, description="Quantité de bags")
    unit_price: Optional[Decimal] = Field(None, description="Prix unitaire")
    description: Optional[str] = None


class OrderLineOut(BaseModel):
    id: int
    id_cont_type: Optional[int]
    id_cont_packaging: Optional[int]
    quantity: Optional[int]
    unit_price: Optional[Decimal]
    description: Optional[str]
    model_config = {"from_attributes": True}


class OrderCreate(BaseModel):
    order_type: OrderType = Field(..., description="lavage | contenants")
    id_client: int = Field(..., description="ID de l'organisation cliente")
    desired_date: Optional[datetime] = Field(None, description="Date souhaitée")
    id_pickup_place: Optional[int] = Field(None, description="Lieu de collecte (pour lavage)")
    note: Optional[str] = None
    lines: list[OrderLineCreate] = Field(..., min_length=1, description="Lignes de commande")


class OrderUpdate(BaseModel):
    desired_date: Optional[datetime] = None
    note: Optional[str] = None
    id_pickup_place: Optional[int] = None


class OrderAssign(BaseModel):
    id_provider: int = Field(..., description="ID de l'organisation prestataire à assigner")


class TransportSlotCreate(BaseModel):
    slot_date: datetime = Field(..., description="Créneau proposé")


class TransportSlotsCreate(BaseModel):
    slots: list[TransportSlotCreate] = Field(..., min_length=1, max_length=3, description="1 à 3 créneaux proposés")
    responsible: TransportResponsible = Field(..., description="client | laveur | transporteur")
    id_pickup_place: Optional[int] = None
    id_delivery_place: Optional[int] = None
    id_transporter: Optional[int] = Field(None, description="ID transporteur tiers si responsible=transporteur")


class TransportSlotOut(BaseModel):
    id: int
    slot_date: datetime
    is_accepted: bool
    model_config = {"from_attributes": True}


class TransportOut(BaseModel):
    id: int
    responsible: TransportResponsible
    id_pickup_place: Optional[int]
    id_delivery_place: Optional[int]
    is_signed: bool
    slots: list[TransportSlotOut]
    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: int
    order_type: OrderType
    status: OrderStatus
    id_client: int
    id_provider: Optional[int]
    qr_code: Optional[str]
    order_date: Optional[datetime]
    desired_date: Optional[datetime]
    confirmed_date: Optional[datetime]
    note: Optional[str]
    lines: list[OrderLineOut]
    transport: Optional[TransportOut]
    model_config = {"from_attributes": True}
