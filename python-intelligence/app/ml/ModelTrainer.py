from sklearn.ensemble import RandomForestRegressor
class ModelTrainer:
    def train(self, X, y, algorithm, params):
        model = RandomForestRegressor(**params)
        model.fit(X, y) if not X.empty else None
        return model
