import pandas as pd
class DatasetLoader:
    def load(self, dataset_id: str):
        # Stub: loads versioned parquet files from DatasetRegistry
        # We simulate returning a minimal dataset for tests
        return pd.DataFrame({"f1": [1, 2], "target": [0, 1]})
