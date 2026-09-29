from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.branch import Branch
from app.models.user import User
from app.routers.auth import get_me
from app.schemas.branch import BranchCreate, BranchResponse, BranchUpdate

router = APIRouter(prefix="/branches", tags=["Branches"])


def require_admin(user: User = Depends(get_me)) -> User:
    if user.role.upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/", response_model=list[BranchResponse])
def list_branches(db: Session = Depends(get_db)):
    return db.scalars(select(Branch).order_by(Branch.id)).all()


@router.get("/{branch_id}", response_model=BranchResponse)
def get_branch(branch_id: int, db: Session = Depends(get_db)):
    branch = db.get(Branch, branch_id)
    if branch is None:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch


@router.post("/", response_model=BranchResponse, status_code=201)
def create_branch(
    data: BranchCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    branch = Branch(**data.model_dump())
    db.add(branch)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Branch code already exists")
    db.refresh(branch)
    return branch


@router.put("/{branch_id}", response_model=BranchResponse)
def update_branch(
    branch_id: int,
    data: BranchUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    branch = db.get(Branch, branch_id)
    if branch is None:
        raise HTTPException(status_code=404, detail="Branch not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(branch, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Branch code already exists")
    db.refresh(branch)
    return branch


@router.delete("/{branch_id}", status_code=204)
def delete_branch(
    branch_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    branch = db.get(Branch, branch_id)
    if branch is None:
        raise HTTPException(status_code=404, detail="Branch not found")

    db.delete(branch)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Branch has related services, counters, or tickets",
        )