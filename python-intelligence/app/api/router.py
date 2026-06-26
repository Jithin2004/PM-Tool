from fastapi import APIRouter
from app.api.endpoints import health, datasets, models, training, evaluation, benchmark, prediction

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["datasets"])
api_router.include_router(models.router, prefix="/models", tags=["models"])
api_router.include_router(training.router, prefix="/training", tags=["training"])
api_router.include_router(evaluation.router, prefix="/evaluation", tags=["evaluation"])
api_router.include_router(benchmark.router, prefix="/benchmark", tags=["benchmark"])
api_router.include_router(prediction.router, prefix="/prediction", tags=["prediction"])
