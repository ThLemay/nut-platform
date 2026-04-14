from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AddressCreate(BaseModel):
    address: Optional[str] = None
    city: Optional[str] = None
    zipcode: Optional[str] = None
    country: Optional[str] = None


class AddressOut(BaseModel):
    id: int
    address: Optional[str]
    city: Optional[str]
    zipcode: Optional[str]
    country: Optional[str]
    model_config = {"from_attributes": True}


class OrganizationCreate(BaseModel):
    name: str = Field(..., description="Nom de l'organisation")
    siren: Optional[str] = Field(None, description="SIREN 9 chiffres")
    siret: Optional[str] = Field(None, description="SIRET 14 chiffres")
    description: Optional[str] = None
    id_parent: Optional[int] = Field(None, description="ID organisation parente")
    is_food_provider: bool = False
    is_cont_washer: bool = False
    is_cont_transporter: bool = False
    is_cont_stockeur: bool = False
    is_cont_recycleur: bool = False
    is_cont_destructeur: bool = False
    is_cont_provider: bool = False
    address: Optional[AddressCreate] = None


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    siren: Optional[str] = None
    siret: Optional[str] = None
    description: Optional[str] = None
    status: Optional[int] = None
    is_food_provider: Optional[bool] = None
    is_cont_washer: Optional[bool] = None
    is_cont_transporter: Optional[bool] = None
    is_cont_stockeur: Optional[bool] = None
    is_cont_recycleur: Optional[bool] = None
    is_cont_destructeur: Optional[bool] = None
    is_cont_provider: Optional[bool] = None


class OrganizationOut(BaseModel):
    id: int
    name: str
    siren: Optional[str]
    siret: Optional[str]
    description: Optional[str]
    status: int
    creation_date: Optional[datetime]
    id_parent: Optional[int]
    is_food_provider: bool
    is_cont_washer: bool
    is_cont_transporter: bool
    is_cont_stockeur: bool
    is_cont_recycleur: bool
    is_cont_destructeur: bool
    is_cont_provider: bool
    address: Optional[AddressOut]
    model_config = {"from_attributes": True}


class MemberAdd(BaseModel):
    user_id: int = Field(..., description="ID de l'utilisateur à ajouter")
