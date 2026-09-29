from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base

if TYPE_CHECKING:
    from app.models.counter import Counter
    from app.models.service import Service
    from app.models.queue_ticket import QueueTicket


class Branch(Base):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    address: Mapped[str] = mapped_column(String(255))

    services: Mapped[list[Service]] = relationship(back_populates="branch")
    counters: Mapped[list[Counter]] = relationship(back_populates="branch")
    tickets: Mapped[list[QueueTicket]] = relationship(back_populates="branch")