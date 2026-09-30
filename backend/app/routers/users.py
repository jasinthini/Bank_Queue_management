from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.database.connection import get_db
from app.models.user import User
from app.routers.branches import require_admin
from app.schemas.user import UserCreate, UserResponse

router = APIRouter(
    prefix="/users",
    tags=["Users"],
    dependencies=[Depends(require_admin)],
)


class UserRoleUpdate(BaseModel):
    role: Literal["CUSTOMER", "STAFF"]


@router.get("/", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db)):
    return db.scalars(
        select(User).order_by(User.id)
    ).all()


@router.post("/staff", response_model=UserResponse, status_code=201)
def create_staff(
    data: UserCreate,
    db: Session = Depends(get_db),
):
    email = str(data.email).lower()

    existing = db.scalar(
        select(User).where(User.email == email)
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="Email already registered",
        )

    staff = User(
        full_name=data.full_name,
        email=email,
        hashed_password=hash_password(data.password),
        role="STAFF",
    )
    db.add(staff)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Email already registered",
        )

    db.refresh(staff)
    return staff


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )
    return user


@router.put("/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    data: UserRoleUpdate,
    db: Session = Depends(get_db),
):
    user = db.scalar(
        select(User)
        .where(User.id == user_id)
        .with_for_update()
    )
    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    if user.role.upper() == "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Admin role cannot be changed here",
        )

    user.role = data.role
    db.commit()
    db.refresh(user)
    return user