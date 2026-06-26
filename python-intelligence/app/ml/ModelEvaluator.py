from .MetricsEngine import MetricsEngine
class ModelEvaluator:
    def evaluate(self, model, X_test, y_test):
        return MetricsEngine().calculate(y_test, y_test)
