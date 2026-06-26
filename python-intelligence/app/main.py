from fastapi import FastAPI
from app.api.router import api_router
from app.core.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Resolve Intelligence API",
    version="1.5.0",
    description="Python Intelligence Platform (Milestone 1)"
)

app.include_router(api_router)

@app.on_event("startup")
async def startup_event():
    logger.info("Resolve Intelligence Platform started. Environment: %s", settings.ENVIRONMENT)
