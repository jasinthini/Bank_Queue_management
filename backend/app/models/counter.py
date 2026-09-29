from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base

if TYPE_CHECKING:
    from app.models.branch import Branch
    from app.models.service import Service
    from app.models.queue_ticket import QueueTicket


class Counter(Base):
    __tablename__ = "counters"

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(
        ForeignKey("branches.id"), index=True
    )
    service_id: Mapped[int] = mapped_column(
        ForeignKey("services.id"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(default=True)

    branch: Mapped[Branch] = relationship(back_populates="counters")
    service: Mapped[Service] = relationship(back_populates="counters")
    tickets: Mapped[list[QueueTicket]] = relationship(back_populates="counter")
    