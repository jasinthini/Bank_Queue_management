from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


TicketStatus = Literal[
    "WAITING", "CALLED", "SERVING", "COMPLETED", "MISSED", "CANCELLED"
]


class QueueTicketCreate(BaseModel):
    branch_id: int
    service_id: int


class QueueTicketStatusUpdate(BaseModel):
    status: TicketStatus


class QueueTicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    branch_id: int
    service_id: int
    counter_id: int | None
    queue_date: date
    sequence_number: int
    token_number: str
    status: str
    created_at: datetime
    called_at: datetime | None
    completed_at: datetime | None