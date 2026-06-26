from app.ml.TrainingPipeline import TrainingPipeline
def test_training_pipeline():
    pipeline = TrainingPipeline()
    result = pipeline.execute("mock_id")
    assert result['status'] == 'success'
    assert 'model_id' in result
