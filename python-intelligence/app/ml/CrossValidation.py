class CrossValidation:
    def split(self, X, y):
        return [(list(range(len(X))), list(range(len(X))))]
