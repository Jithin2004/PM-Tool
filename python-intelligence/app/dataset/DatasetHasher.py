import hashlib
import pandas as pd
class DatasetHasher:
    def generate_checksum(self, df: pd.DataFrame) -> str:
        if df.empty:
            return hashlib.sha256(b"empty").hexdigest()
        return hashlib.sha256(pd.util.hash_pandas_object(df, index=True).values).hexdigest()
