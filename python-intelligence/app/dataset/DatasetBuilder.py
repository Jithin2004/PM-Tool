import pandas as pd
from .DatasetExtractor import DatasetExtractor
from .DatasetTransformer import DatasetTransformer
from .DatasetQualityEngine import DatasetQualityEngine
from .DatasetHasher import DatasetHasher
from .DatasetVersionManager import DatasetVersionManager
from .DatasetExporter import DatasetExporter

class DatasetBuilder:
    def __init__(self):
        self.extractor = DatasetExtractor()
        self.transformer = DatasetTransformer()
        self.quality = DatasetQualityEngine()
        self.hasher = DatasetHasher()
        self.versioning = DatasetVersionManager()
        self.exporter = DatasetExporter()

    def build_dataset(self, db_session, workspace_id: str = None) -> dict:
        raw_df = self.extractor.extract_prediction_history(db_session, workspace_id)
        features_df = self.transformer.flatten_features(raw_df)
        targets_df = self.transformer.generate_targets(raw_df)
        
        quality_metrics = self.quality.calculate_quality(features_df)
        if quality_metrics['quality_score'] < 0.5:
            raise ValueError("Dataset Quality Score below threshold")
            
        checksum = self.hasher.generate_checksum(features_df)
        version_meta = self.versioning.create_version(checksum, "v1.0")
        
        export_path_features = f"./data/exports/{version_meta['dataset_id']}/feature_matrix.parquet"
        export_path_targets = f"./data/exports/{version_meta['dataset_id']}/targets_matrix.parquet"
        
        self.exporter.export_parquet(features_df, export_path_features)
        self.exporter.export_parquet(targets_df, export_path_targets)
        
        return {
            "version": version_meta,
            "quality": quality_metrics,
            "paths": {"features": export_path_features, "targets": export_path_targets}
        }
