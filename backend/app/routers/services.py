from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.branch import Branch
from app.models.service import Service
from app.models.user import User
from app.routers.branches import require_admin
from app.schemas.service import ServiceCreate, ServiceRead, ServiceUpdate

router = APIRouter(prefix="/services", tags=["Services"])


@router.get("/", response_model=list[ServiceRead])
def list_services(
    branch_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = select(Service)
    if branch_id is not None:
        query = query.where(Service.branch_id == branch_id)
    return db.scalars(query.order_by(Service.id)).all()


@router.get("/{service_id}", response_model=ServiceRead)
def get_service(service_id: int, db: Session = Depends(get_db)):
    service = db.get(Service, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    return service


@router.post("/", response_model=ServiceRead, status_code=201)
def create_service(
    data: ServiceCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if db.get(Branch, data.branch_id) is None:
        raise HTTPException(status_code=404, detail="Branch not found")

    existing = db.scalar(
        select(Service).where(
            Service.branch_id == data.branch_id,
            Service.code == data.code,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="Service code already exists in this branch",
        )

    service = Service(**data.model_dump())
    db.add(service)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not create service")

    db.refresh(service)
    return service


@router.put("/{service_id}", response_model=ServiceRead)
def update_service(
    service_id: int,
    data: ServiceUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    service = db.get(Service, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")

    changes = data.model_dump(exclude_unset=True)
    if any(value is None for value in changes.values()):
        raise HTTPException(status_code=422, detail="Fields cannot be null")

    if "code" in changes:
        existing = db.scalar(
            select(Service).where(
                Service.branch_id == service.branch_id,
                Service.code == changes["code"],
                Service.id != service_id,
            )
        )
        if existing is not None:
            raise HTTPException(
                status_code=409,
                detail="Service code already exists in this branch",
            )

    for field, value in changes.items():
        setattr(service, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not update service")

    db.refresh(service)
    return service


@router.delete("/{service_id}", status_code=204)
def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    service = db.get(Service, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")

    db.delete(service)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Service has related counters or tickets",
        )