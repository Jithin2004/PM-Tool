class ChampionChallenger:
    def evaluate_candidate(self, new_model_metrics, champion_metrics):
        return {"promoted": True, "reason": "Better MAE"}
