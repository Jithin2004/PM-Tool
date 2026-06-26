from app.inference.PredictionPipeline import PredictionPipeline
def test_pipeline():
    pipeline = PredictionPipeline()
    res = pipeline.execute("ws_1", "project", {"f1": 1})
    assert "prediction" in res or "status" in res
