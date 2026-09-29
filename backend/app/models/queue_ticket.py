from __future__ import annotations

from datetime import date, datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base

if TYPE_CHECKING:
    from app.models.branch import Branch
    from app.models.counter import Counter
    from app.models.service import Service
    from app.models.user import User


class QueueTicket(Base):
    __tablename__ = "queue_tickets"
    __table_args__ = (
        UniqueConstraint(
            "service_id", "queue_date", "sequence_number",
            name="uq_service_daily_sequence",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), index=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), index=True)
    counter_id: Mapped[int | None] = mapped_column(
        ForeignKey("counters.id"), nullable=True
    )

    queue_date: Mapped[date] = mapped_column(Date, default=date.today)
    sequence_number: Mapped[int]
    token_number: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="WAITING")

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    called_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    customer: Mapped[User] = relationship(back_populates="tickets")
    branch: Mapped[Branch] = relationship(back_populates="tickets")
    service: Mapped[Service] = relationship(back_populates="tickets")
    counter: Mapped[Counter | None] = relationship(back_populates="tickets")