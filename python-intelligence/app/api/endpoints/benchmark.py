from fastapi import APIRouter
router = APIRouter()
@router.post("/run")
def run_benchmark():
    return {"status": "benchmarked"}
