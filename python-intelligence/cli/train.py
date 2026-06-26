import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.ml.TrainingPipeline import TrainingPipeline

if __name__ == "__main__":
    print("Initializing Training Pipeline...")
    pipeline = TrainingPipeline()
    result = pipeline.execute("mock_dataset_1")
    print("Training Completed:")
    print(result)
