class ModelCache:
    def __init__(self):
        self.cache = {}
    def get(self, model_id):
        return self.cache.get(model_id)
    def set(self, model_id, model):
        self.cache[model_id] = model
