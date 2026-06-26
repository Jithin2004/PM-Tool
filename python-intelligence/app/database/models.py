from sqlalchemy import Column, String, Integer, Float, JSON, DateTime
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class PredictionHistory(Base):
    __tablename__ = 'prediction_history'
    id = Column(String, primary_key=True)
    workspace_id = Column(String)
    prediction_id = Column(String)
    snapshot_id = Column(String)
    model_version = Column(String)
    features = Column(JSON)
    prediction_payload = Column(JSON)
    created_at = Column(DateTime)

class FeatureSnapshots(Base):
    __tablename__ = 'feature_snapshots'
    id = Column(String, primary_key=True)
    workspace_id = Column(String)
    snapshot_hash = Column(String)
    feature_payload = Column(JSON)
    created_at = Column(DateTime)

class LearningDatasetVersions(Base):
    __tablename__ = 'learning_dataset_versions'
    id = Column(String, primary_key=True)
    dataset_version = Column(String)
    checksum = Column(String)
    record_count = Column(Integer)
    quality_score = Column(Float)
    metadata_payload = Column(JSON)
    created_at = Column(DateTime)
