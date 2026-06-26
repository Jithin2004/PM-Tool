from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DatasetMetadata(BaseModel):
    dataset_id: str
    feature_version: str
    prediction_version: str
    snapshot_version: str
    evidence_version: str
    creation_time: datetime
    workspace: str
    checksum: str
    record_count: int
    quality_score: float
