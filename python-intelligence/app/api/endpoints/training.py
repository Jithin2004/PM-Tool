from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.ml.TrainingPipeline import TrainingPipeline

router = APIRouter()

class TrainRequest(BaseModel):
    dataset_id: str

@router.post("/start")
def start_training(req: TrainRequest):
    pipeline = TrainingPipeline()
    try:
        result = pipeline.execute(req.dataset_id)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/status/{id}")
def get_status(id: str):
    return {"status": "completed"}

@router.get("/history")
def get_history():
    return []

@router.get("/metrics")
def get_metrics():
    return {"MAE": 1.2}

@router.get("/experiments")
def get_experiments():
    return []

@router.get("/champion")
def get_champion():
    return {"model_id": "mod_v1"}

@router.get("/challenger")
def get_challenger():
    return {"model_id": "mod_v2"}

@router.post("/promote")
def promote():
    return {"status": "promoted"}

@router.post("/archive")
def archive():
    return {"status": "archived"}
