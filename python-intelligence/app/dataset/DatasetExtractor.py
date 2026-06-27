import pandas as pd

class DatasetExtractor:
    def __init__(self):
        self.allowed_environments = ['production']

    def _get_base_query(self, db_session) -> str:
        # Centralized environment filter enforcing Phase D Sandbox Recovery Program
        envs = "', '".join(self.allowed_environments)
        return f"SELECT * FROM prediction_history ph JOIN workspaces w ON ph.workspace_id = w.id WHERE w.environment IN ('{envs}')"

    def extract_prediction_history(self, db_session, workspace_id: str = None) -> pd.DataFrame:
        query = self._get_base_query(db_session)
        if workspace_id:
            query += f" AND w.id = '{workspace_id}'"
            
        # In actual deployment, this runs the query. For now we log it and return empty safely.
        print(f"[DatasetExtractor] Executing protected query: {query}")
        return pd.DataFrame(columns=["workspace_id", "prediction_id", "snapshot_id", "feature_snapshot_id", "evidence_graph_reference", "dataset_version"])

    def extract_feature_snapshots(self, db_session) -> pd.DataFrame:
        return pd.DataFrame(columns=["feature_snapshot_id", "features"])
