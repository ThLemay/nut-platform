from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
from datetime import datetime


class CreditConfigCreate(BaseModel):
    id_organization: int = Field(..., description="ID de l'organisation")
    id_cont_type: int = Field(..., description="ID du type de contenant")
    credit_amount: Decimal = Field(..., ge=0, description="Nombre de crédits attribués au retour")


class CreditConfigUpdate(BaseModel):
    credit_amount: Decimal = Field(..., ge=0, description="Nouveau montant de crédits")


class CreditConfigOut(BaseModel):
    id: int
    id_organization: int
    id_cont_type: int
    credit_amount: Decimal
    model_config = {"from_attributes": True}


class CreditOut(BaseModel):
    id: int
    id_user: int
    balance: Decimal
    updated_at: Optional[datetime]
    model_config = {"from_attributes": True}


class CreditAdjust(BaseModel):
    amount: Decimal = Field(..., description="Montant à ajouter (positif) ou retirer (négatif)")
    note: Optional[str] = None
