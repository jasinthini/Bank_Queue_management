from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base

if TYPE_CHECKING:
    from app.models.branch import Branch
    from app.models.counter import Counter
    from app.models.queue_ticket import QueueTicket


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(
        ForeignKey("branches.id"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str] = mapped_column(String(20))
    token_prefix: Mapped[str] = mapped_column(String(5), default="A")

    branch: Mapped[Branch] = relationship(back_populates="services")
    counters: Mapped[list[Counter]] = relationship(back_populates="service")
    tickets: Mapped[list[QueueTicket]] = relationship(back_populates="service")