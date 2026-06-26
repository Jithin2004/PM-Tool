from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "Resolve Intelligence Platform"}

def test_version():
    response = client.get("/version")
    assert response.status_code == 200
    assert response.json() == {"version": "1.5.0"}

def test_dataset_build_501():
    response = client.post("/datasets/build")
    assert response.status_code == 501
