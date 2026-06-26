import pandas as pd
import os
class DatasetExporter:
    def export_parquet(self, df: pd.DataFrame, filepath: str):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        df.to_parquet(filepath, engine='pyarrow', compression='snappy')
