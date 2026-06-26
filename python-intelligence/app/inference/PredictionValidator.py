class PredictionValidator:
    def validate(self, request):
        if not request: raise ValueError("Invalid Request")
        return True
