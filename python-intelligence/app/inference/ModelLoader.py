from .ModelCache import ModelCache
class ModelLoader:
    def __init__(self):
        self.cache = ModelCache()
    def load_champion(self, workspace_id):
        return {"id": "champ_v1", "model": lambda x: 42}
