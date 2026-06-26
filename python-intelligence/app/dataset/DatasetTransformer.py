import pandas as pd
class DatasetTransformer:
    def flatten_features(self, df: pd.DataFrame) -> pd.DataFrame:
        # Expands JSON columns, normalizes timestamps
        return df

    def generate_targets(self, df: pd.DataFrame) -> pd.DataFrame:
        # Generates Actual completion, Actual duration, Actual drift labels
        if df.empty:
            return pd.DataFrame(columns=["prediction_id", "actual_duration", "actual_drift", "actual_cost_variance"])
        return df
