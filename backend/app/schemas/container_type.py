from __future__ import annotations

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, AliasChoices


# ── Packaging ──────────────────────────────────────────────────────────────────

class PackagingCreate(BaseModel):
    name: Optional[str] = Field(None, description="Ex: Sac de 10, Carton de 50")
    pieces_per_bag: Optional[int] = None
    bag_per_box: Optional[int] = None
    box_per_pallet: Optional[int] = None
    width_box: Optional[Decimal] = None
    length_box: Optional[Decimal] = None
    height_box: Optional[Decimal] = None
    weight_box: Optional[Decimal] = None


class PackagingUpdate(BaseModel):
    name: Optional[str] = None
    pieces_per_bag: Optional[int] = None
    bag_per_box: Optional[int] = None
    box_per_pallet: Optional[int] = None
    width_box: Optional[Decimal] = None
    length_box: Optional[Decimal] = None
    height_box: Optional[Decimal] = None
    weight_box: Optional[Decimal] = None


class PackagingOut(BaseModel):
    id: int
    id_cont_type: int
    name: Optional[str] = None
    pieces_per_bag: Optional[int] = None
    bag_per_box: Optional[int] = None
    box_per_pallet: Optional[int] = None
    width_box: Optional[Decimal] = None
    length_box: Optional[Decimal] = None
    height_box: Optional[Decimal] = None
    weight_box: Optional[Decimal] = None

    model_config = {"from_attributes": True}


# ── ContainerType ──────────────────────────────────────────────────────────────

class ContainerTypeCreate(BaseModel):
    name: str = Field(..., description="Nom du type de contenant")
    description: Optional[str] = None
    literage: Optional[Decimal] = None
    weight: Optional[Decimal] = None
    width: Optional[Decimal] = None
    length: Optional[Decimal] = None
    height: Optional[Decimal] = None
    stacking_height: Optional[Decimal] = None
    material: Optional[str] = None
    sealable: bool = False
    max_wash_cycles: Optional[int] = None
    color: Optional[str] = None
    temp_min: Optional[int] = None
    temp_max: Optional[int] = None
    wash_recommendations: Optional[str] = None
    quality_check_interval: Optional[int] = 20
    id_supplier: Optional[int] = None


class ContainerTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    literage: Optional[Decimal] = None
    weight: Optional[Decimal] = None
    width: Optional[Decimal] = None
    length: Optional[Decimal] = None
    height: Optional[Decimal] = None
    stacking_height: Optional[Decimal] = None
    material: Optional[str] = None
    sealable: Optional[bool] = None
    max_wash_cycles: Optional[int] = None
    color: Optional[str] = None
    temp_min: Optional[int] = None
    temp_max: Optional[int] = None
    wash_recommendations: Optional[str] = None
    quality_check_interval: Optional[int] = None
    id_supplier: Optional[int] = None


class ContainerTypeOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    literage: Optional[Decimal] = None
    weight: Optional[Decimal] = None
    width: Optional[Decimal] = None
    length: Optional[Decimal] = None
    height: Optional[Decimal] = None
    stacking_height: Optional[Decimal] = None
    material: Optional[str] = None
    sealable: bool
    max_wash_cycles: Optional[int] = None
    color: Optional[str] = None
    temp_min: Optional[int] = None
    temp_max: Optional[int] = None
    wash_recommendations: Optional[str] = None
    quality_check_interval: Optional[int] = None
    id_supplier: Optional[int] = None
    packagings: list[PackagingOut] = Field(
        default=[],
        validation_alias=AliasChoices("packagings", "packaging_types"),
    )

    model_config = {"from_attributes": True, "populate_by_name": True}
