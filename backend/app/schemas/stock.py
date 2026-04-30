from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from app.models.container import ContainerStatus
from app.models.stock import StockStatus


class StockCreate(BaseModel):
    name:     str
    note:     Optional[str] = None
    id_place: Optional[int] = None


class StockUpdate(BaseModel):
    name:   Optional[str]         = None
    status: Optional[StockStatus] = None
    note:   Optional[str]         = None


class StockContainerOut(BaseModel):
    id:           int
    uid:          str
    id_cont_type: int
    status:       ContainerStatus
    added_at:     datetime
    model_config = {"from_attributes": True}


class StockOut(BaseModel):
    id:                    int
    name:                  Optional[str]
    status:                StockStatus
    note:                  Optional[str]
    id_place:              Optional[int]
    id_order:              Optional[int]
    id_owner_organization: Optional[int]
    created_at:            Optional[datetime]
    container_count:       int = 0
    containers:            list[StockContainerOut] = []
    model_config = {"from_attributes": True}


class AddContainerPayload(BaseModel):
    uid: str


class BulkStatusPayload(BaseModel):
    status: ContainerStatus
    note:   Optional[str] = None


class BulkStatusResult(BaseModel):
    updated: int
    skipped: int
