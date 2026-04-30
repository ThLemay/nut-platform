from datetime import datetime
from pydantic import BaseModel


class NotificationOut(BaseModel):
    id:               int
    type:             str
    message:          str
    is_read:          bool
    created_at:       datetime
    id_related_order: int | None = None

    model_config = {"from_attributes": True}
