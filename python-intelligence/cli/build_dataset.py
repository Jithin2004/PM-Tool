import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.dataset.DatasetBuilder import DatasetBuilder

if __name__ == "__main__":
    print("Initializing Dataset Builder...")
    builder = DatasetBuilder()
    result = builder.build_dataset(db_session=None)
    print("Dataset Built Successfully:")
    print(result)
