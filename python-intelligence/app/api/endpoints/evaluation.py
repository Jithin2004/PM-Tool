from fastapi import APIRouter
router = APIRouter()
@router.post("/run")
def run_evaluation():
    return {"status": "evaluated"}
