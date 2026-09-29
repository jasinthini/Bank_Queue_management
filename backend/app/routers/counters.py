from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.branch import Branch
from app.models.counter import Counter
from app.models.service import Service
from app.models.user import User
from app.routers.branches import require_admin
from app.schemas.counter import CounterCreate, CounterRead, CounterUpdate

router = APIRouter(prefix="/counters", tags=["Counters"])


@router.get("/", response_model=list[CounterRead])
def list_counters(
    branch_id: int | None = None,
    service_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = select(Counter)
    if branch_id is not None:
        query = query.where(Counter.branch_id == branch_id)
    if service_id is not None:
        query = query.where(Counter.service_id == service_id)
    return db.scalars(query.order_by(Counter.id)).all()


@router.get("/{counter_id}", response_model=CounterRead)
def get_counter(counter_id: int, db: Session = Depends(get_db)):
    counter = db.get(Counter, counter_id)
    if counter is None:
        raise HTTPException(status_code=404, detail="Counter not found")
    return counter


@router.post("/", response_model=CounterRead, status_code=201)
def create_counter(
    data: CounterCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if db.get(Branch, data.branch_id) is None:
        raise HTTPException(status_code=404, detail="Branch not found")

    service = db.get(Service, data.service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    if service.branch_id != data.branch_id:
        raise HTTPException(
            status_code=422,
            detail="Service does not belong to this branch",
        )

    counter = Counter(**data.model_dump())
    db.add(counter)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not create counter")

    db.refresh(counter)
    return counter


@router.put("/{counter_id}", response_model=CounterRead)
def update_counter(
    counter_id: int,
    data: CounterUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    counter = db.get(Counter, counter_id)
    if counter is None:
        raise HTTPException(status_code=404, detail="Counter not found")

    changes = data.model_dump(exclude_unset=True)
    if any(value is None for value in changes.values()):
        raise HTTPException(status_code=422, detail="Fields cannot be null")

    for field, value in changes.items():
        setattr(counter, field, value)

    db.commit()
    db.refresh(counter)
    return counter


@router.delete("/{counter_id}", status_code=204)
def delete_counter(
    counter_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    counter = db.get(Counter, counter_id)
    if counter is None:
        raise HTTPException(status_code=404, detail="Counter not found")

    db.delete(counter)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Counter has related queue tickets",
        )