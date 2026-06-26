class ConfidenceEngine:
    def calculate(self, model_confidence, calibration_score, data_quality):
        return min(model_confidence, calibration_score, data_quality)
