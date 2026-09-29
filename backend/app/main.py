from fastapi import FastAPI

from app.database.connection import Base, engine
from app.models.branch import Branch
from app.models.counter import Counter
from app.models.queue_ticket import QueueTicket
from app.models.service import Service
from app.models.user import User
from app.routers.auth import router as auth_router
from app.routers.branches import router as branches_router
from app.routers.counters import router as counters_router
from app.routers.queue_tickets import router as queue_tickets_router
from app.routers.services import router as services_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Bank Queue Management API")

app.include_router(auth_router)
app.include_router(branches_router)
app.include_router(services_router)
app.include_router(counters_router)
app.include_router(queue_tickets_router)


@app.get("/")
def home():
    return {"message": "Bank Queue Management API is running"}