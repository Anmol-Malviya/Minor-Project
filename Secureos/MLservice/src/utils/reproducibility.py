import os
import random
import numpy as np

def set_seed(seed: int = 42) -> None:
    """Fix random seeds across standard library, numpy, and environment for reproducibility."""
    random.seed(seed)
    np.random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
