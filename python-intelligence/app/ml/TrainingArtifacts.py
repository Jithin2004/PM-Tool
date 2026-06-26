class TrainingArtifacts:
    def save(self, model, metrics, version):
        return {"model_path": f"models/{version}.joblib"}
