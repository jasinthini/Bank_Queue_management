from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.database.connection import get_db
from app.models.counter import Counter
from app.models.queue_ticket import QueueTicket
from app.models.service import Service
from app.models.user import User
from app.routers.auth import get_me
from app.schemas.queue_ticket import (
    QueueTicketCreate,
    QueueTicketRead,
    QueueTicketStatusUpdate,
)

router = APIRouter(
    prefix="/queue-tickets",
    tags=["Queue Tickets"],
)


def require_staff(user: User = Depends(get_me)) -> User:
    if user.role.upper() not in {"ADMIN", "STAFF"}:
        raise HTTPException(
            status_code=403,
            detail="Staff access required",
        )
    return user


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ticket_data(ticket: QueueTicket) -> dict:
    return {
        "id": ticket.id,
        "customer_id": ticket.customer_id,
        "customer_name": ticket.customer.full_name,
        "branch_id": ticket.branch_id,
        "service_id": ticket.service_id,
        "counter_id": ticket.counter_id,
        "queue_date": ticket.queue_date,
        "sequence_number": ticket.sequence_number,
        "token_number": ticket.token_number,
        "status": ticket.status,
        "created_at": ticket.created_at,
        "called_at": ticket.called_at,
        "completed_at": ticket.completed_at,
    }


@router.post(
    "/",
    response_model=QueueTicketRead,
    status_code=201,
)
def create_ticket(
    data: QueueTicketCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_me),
):
    service = db.scalar(
        select(Service)
        .where(Service.id == data.service_id)
        .with_for_update()
    )

    if service is None:
        raise HTTPException(
            status_code=404,
            detail="Service not found",
        )

    if service.branch_id != data.branch_id:
        raise HTTPException(
            status_code=422,
            detail="Service does not belong to this branch",
        )

    today = date.today()

    latest_number = db.scalar(
        select(func.max(QueueTicket.sequence_number)).where(
            QueueTicket.service_id == service.id,
            QueueTicket.queue_date == today,
        )
    )

    next_number = (latest_number or 0) + 1

    ticket = QueueTicket(
        customer_id=user.id,
        branch_id=data.branch_id,
        service_id=service.id,
        queue_date=today,
        sequence_number=next_number,
        token_number=f"{service.token_prefix}{next_number}",
        status="WAITING",
    )

    db.add(ticket)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Could not create ticket; please try again",
        )

    db.refresh(ticket)
    return ticket_data(ticket)


@router.get(
    "/my",
    response_model=list[QueueTicketRead],
)
def my_tickets(
    db: Session = Depends(get_db),
    user: User = Depends(get_me),
):
    tickets = db.scalars(
        select(QueueTicket)
        .options(joinedload(QueueTicket.customer))
        .where(QueueTicket.customer_id == user.id)
        .order_by(QueueTicket.id.desc())
    ).all()

    return [ticket_data(ticket) for ticket in tickets]


@router.get(
    "/staff",
    response_model=list[QueueTicketRead],
)
def staff_tickets(
    branch_id: int,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
):
    tickets = db.scalars(
        select(QueueTicket)
        .options(joinedload(QueueTicket.customer))
        .where(
            QueueTicket.branch_id == branch_id,
            QueueTicket.queue_date == date.today(),
        )
        .order_by(
            QueueTicket.sequence_number,
            QueueTicket.id,
        )
    ).all()

    return [ticket_data(ticket) for ticket in tickets]


@router.get("/board")
def get_board(
    branch_id: int,
    db: Session = Depends(get_db),
):
    tickets = db.scalars(
        select(QueueTicket)
        .where(
            QueueTicket.branch_id == branch_id,
            QueueTicket.queue_date == date.today(),
            QueueTicket.status.in_(
                ("WAITING", "CALLED", "SERVING", "MISSED")
            ),
        )
        .order_by(
            QueueTicket.sequence_number,
            QueueTicket.id,
        )
    ).all()

    return [
        {
            "id": ticket.id,
            "token_number": ticket.token_number,
            "service_id": ticket.service_id,
            "counter_id": ticket.counter_id,
            "status": ticket.status,
            "called_at": ticket.called_at,
        }
        for ticket in tickets
    ]


@router.post(
    "/call-next/{counter_id}",
    response_model=QueueTicketRead,
)
def call_next(
    counter_id: int,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
):
    counter = db.scalar(
        select(Counter)
        .where(Counter.id == counter_id)
        .with_for_update()
    )

    if counter is None:
        raise HTTPException(
            status_code=404,
            detail="Counter not found",
        )

    if not counter.is_active:
        raise HTTPException(
            status_code=409,
            detail="Counter is inactive",
        )

    active_ticket = db.scalar(
        select(QueueTicket.id).where(
            QueueTicket.counter_id == counter_id,
            QueueTicket.status.in_(("CALLED", "SERVING")),
        )
    )

    if active_ticket is not None:
        raise HTTPException(
            status_code=409,
            detail="Complete or mark the current ticket missed first",
        )

    ticket = db.scalar(
        select(QueueTicket)
        .where(
            QueueTicket.branch_id == counter.branch_id,
            QueueTicket.service_id == counter.service_id,
            QueueTicket.queue_date == date.today(),
            QueueTicket.status == "WAITING",
        )
        .order_by(
            QueueTicket.sequence_number,
            QueueTicket.id,
        )
        .limit(1)
        .with_for_update(skip_locked=True)
    )

    if ticket is None:
        raise HTTPException(
            status_code=404,
            detail="No waiting tickets",
        )

    ticket.counter_id = counter.id
    ticket.status = "CALLED"
    ticket.called_at = utc_now()

    db.commit()
    db.refresh(ticket)
    return ticket_data(ticket)


@router.get(
    "/{ticket_id}",
    response_model=QueueTicketRead,
)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_me),
):
    ticket = db.get(QueueTicket, ticket_id)

    if ticket is None:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found",
        )

    if (
        user.role.upper() not in {"ADMIN", "STAFF"}
        and ticket.customer_id != user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    return ticket_data(ticket)


@router.put(
    "/{ticket_id}/cancel",
    response_model=QueueTicketRead,
)
def cancel_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_me),
):
    ticket = db.scalar(
        select(QueueTicket)
        .where(QueueTicket.id == ticket_id)
        .with_for_update()
    )

    if ticket is None:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found",
        )

    if ticket.customer_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only cancel your own ticket",
        )

    if ticket.status == "CANCELLED":
        return ticket_data(ticket)

    if ticket.status != "WAITING":
        raise HTTPException(
            status_code=409,
            detail="Only waiting tickets can be cancelled",
        )

    ticket.status = "CANCELLED"

    db.commit()
    db.refresh(ticket)
    return ticket_data(ticket)


@router.put(
    "/{ticket_id}/status",
    response_model=QueueTicketRead,
)
def update_ticket_status(
    ticket_id: int,
    data: QueueTicketStatusUpdate,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
):
    ticket = db.scalar(
        select(QueueTicket)
        .where(QueueTicket.id == ticket_id)
        .with_for_update()
    )

    if ticket is None:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found",
        )

    allowed = {
        "CALLED": {"SERVING", "MISSED"},
        "SERVING": {"COMPLETED", "MISSED"},
    }

    if data.status not in allowed.get(ticket.status, set()):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Cannot change status from "
                f"{ticket.status} to {data.status}"
            ),
        )

    ticket.status = data.status

    if data.status == "COMPLETED":
        ticket.completed_at = utc_now()

    db.commit()
    db.refresh(ticket)
    return ticket_data(ticket)