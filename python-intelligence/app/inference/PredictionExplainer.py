class PredictionExplainer:
    def explain(self, model, features):
        return {"top_features": ["f1", "f2"], "evidence": "Historic delay observed"}
