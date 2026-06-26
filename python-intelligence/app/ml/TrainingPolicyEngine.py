class TrainingPolicyEngine:
    def validate_dataset(self, df):
        if df.empty: raise ValueError("Dataset too small")
        return True
