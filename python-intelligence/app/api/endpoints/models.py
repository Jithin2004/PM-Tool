from fastapi import APIRouter
router = APIRouter()
@router.get("/")
def list_models():
    return []
@router.get("/{id}")
def get_model(id: str):
    return {"id": id, "version": "1.0"}
