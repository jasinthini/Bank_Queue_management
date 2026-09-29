from fastapi import FastAPI

from app.database.connection import Base, engine
from app.models.branch import Branch
from app.models.counter import Counter
from app.models.queue_ticket import QueueTicket
from app.models.service import Service
from app.models.user import User
from app.routers.auth import router as auth_router
from app.routers.branches import router as branches_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Bank Queue Management API")

app.include_router(auth_router)
app.include_router(branches_router)


@app.get("/")
def home():
    return {"message": "Bank Queue Management API is running"}