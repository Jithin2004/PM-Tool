from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()

@router.get("/health")
def get_health():
    return {"status": "ok", "service": settings.PROJECT_NAME}

@router.get("/version")
def get_version():
    return {"version": "1.5.0"}

@router.get("/status")
def get_status():
    return {"status": "operational", "ml_ready": False}

@router.get("/readiness")
def get_readiness():
    return {"ready": True, "dependencies": {"database": "disconnected"}}
