from app.dataset.DatasetBuilder import DatasetBuilder

def test_dataset_builder_empty():
    builder = DatasetBuilder()
    result = builder.build_dataset(db_session=None)
    assert result['status'] != 'failed'
    assert 'version' in result
    assert result['quality']['quality_score'] >= 0.0
