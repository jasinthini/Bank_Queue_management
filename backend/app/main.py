from fastapi import FastAPI

from app.database.connection import Base, engine
from app.models.user import User  # Import செய்தால்தான் users table பதிவு ஆகும்
from app.routers.auth import router as auth_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Bank Queue Management API")
app.include_router(auth_router)


@app.get("/")
def home():
    return {"message": "Bank Queue Management API is running"}