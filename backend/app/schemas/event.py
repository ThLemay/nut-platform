from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel

from app.models.event_log import EntityType, EventType


class EventLogOut(BaseModel):
    id:          int
    created_at:  datetime
    entity_type: EntityType
    entity_id:   int
    event_type:  EventType
    old_value:   Optional[Any]
    new_value:   Optional[Any]
    note:        Optional[str]
    meta:        Optional[Any]
    id_user:     Optional[int]
    id_org:      Optional[int]
    id_place:    Optional[int]

    model_config = {"from_attributes": True}
