from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
from datetime import datetime
from app.models.container import ContainerStatus, OwnershipType


class ContainerCreate(BaseModel):
    id_cont_type: int = Field(
        ...,
        description="ID d'un container_type existant. Créer d'abord un type via POST /container-types.",
        examples=[1]
    )
    uid: Optional[str] = Field(
        None,
        description="Identifiant unique custom (QR/RFID). Si absent, un UUID est généré automatiquement."
    )
    ownership_type: Optional[OwnershipType] = Field(
        None,
        description="achat = transfert de propriété possible. location = NUT reste propriétaire."
    )
    purchase_price: Optional[Decimal] = Field(None, description="Prix d'achat unitaire en €")
    first_use_date: Optional[datetime] = Field(None, description="Date de première mise en consigne")
    batch_number: Optional[str] = Field(None, description="Numéro de lot fabricant (optionnel)")


class ContainerBatchCreate(BaseModel):
    id_cont_type: int = Field(
        ...,
        description="ID d'un container_type existant. Créer d'abord un type via POST /container-types.",
        examples=[1]
    )
    quantity: int = Field(..., ge=1, le=500, description="Nombre de contenants à créer (max 500)")
    ownership_type: Optional[OwnershipType] = Field(None, description="achat ou location")
    purchase_price: Optional[Decimal] = Field(None, description="Prix d'achat unitaire en €")
    batch_number: Optional[str] = Field(None, description="Numéro de lot fabricant (optionnel)")


class ContainerOut(BaseModel):
    id: int
    uid: str
    id_cont_type: int
    status: ContainerStatus
    id_owner_organization: Optional[int]
    ownership_type: Optional[OwnershipType]
    purchase_price: Optional[Decimal]
    first_use_date: Optional[datetime]
    batch_number: Optional[str]
    creation_date: Optional[datetime]
    total_wash_count: int
    is_active: bool

    model_config = {"from_attributes": True}


class ContainerBatchOut(BaseModel):
    count: int
    containers: list[ContainerOut]
    id_stock: int
    stock_name: str


class ContainerStatusUpdate(BaseModel):
    status: ContainerStatus = Field(..., description="Nouveau statut du contenant")
    id_place: Optional[int] = Field(None, description="ID du lieu où se trouve le contenant (optionnel)")
    scan_method: Optional[str] = Field(None, description="qr_code | rfid | manual")
    note: Optional[str] = Field(None, description="Note libre")
    id_beneficiaire: Optional[int] = Field(None, description="ID du consommateur à créditer (pour retour contenant)")


class ContainerStatusOut(BaseModel):
    id: int
    uid: str
    status: ContainerStatus
    id_current_place: Optional[int]
    model_config = {"from_attributes": True}


class ContainerHistoryEntry(BaseModel):
    id: int
    status: ContainerStatus
    id_place: Optional[int]
    id_updated_by: Optional[int]
    changed_at: datetime
    scan_method: Optional[str]
    note: Optional[str]
    id_responsible_org: Optional[int]

    model_config = {"from_attributes": True}


class ContainerHistoryOut(BaseModel):
    uid: str
    total_entries: int
    history: list[ContainerHistoryEntry]
