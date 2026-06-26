from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.inference.PredictionPipeline import PredictionPipeline
from typing import Dict, Any

router = APIRouter()
pipeline = PredictionPipeline()

class PredictRequest(BaseModel):
    workspace_id: str
    features: Dict[str, Any]

@router.post("/project")
def predict_project(req: PredictRequest):
    return pipeline.execute(req.workspace_id, "project", req.features)

@router.post("/task")
def predict_task(req: PredictRequest):
    return pipeline.execute(req.workspace_id, "task", req.features)

@router.post("/sprint")
def predict_sprint(req: PredictRequest):
    return pipeline.execute(req.workspace_id, "sprint", req.features)

@router.post("/milestone")
def predict_milestone(req: PredictRequest):
    return pipeline.execute(req.workspace_id, "milestone", req.features)

@router.get("/health")
def health():
    return {"status": "inference_active"}
