import hashlib
import os
from pathlib import Path
from typing import Optional, Tuple

import pandas as pd

from src.config.settings import PRIMARY_DATASET_PATH, FALLBACK_DATASET_PATHS
from src.utils.logger import get_logger

logger = get_logger("data.loader")

def compute_file_sha256(filepath: Path) -> str:
    """Calculates SHA256 checksum of a file in chunks without loading entire file in memory."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192 * 1024):
            hasher.update(chunk)
    return hasher.hexdigest()

def find_dataset_path(custom_path: Optional[str] = None) -> Path:
    """Resolves dataset path checking custom input, primary path, and fallback locations."""
    if custom_path:
        p = Path(custom_path).resolve()
        if p.exists() and p.is_file():
            return p

    if PRIMARY_DATASET_PATH.exists() and PRIMARY_DATASET_PATH.is_file():
        return PRIMARY_DATASET_PATH

    for fallback in FALLBACK_DATASET_PATHS:
        if fallback.exists() and fallback.is_file():
            return fallback

    raise FileNotFoundError(
        f"Dataset file not found at primary ({PRIMARY_DATASET_PATH}) or any fallback locations."
    )

def load_raw_dataset(
    custom_path: Optional[str] = None,
    nrows: Optional[int] = None
) -> Tuple[pd.DataFrame, str, str]:
    """Loads raw dataset without modifying original file.
    
    Returns:
        (df, dataset_path_str, sha256_checksum)
    """
    path = find_dataset_path(custom_path)
    logger.info(f"Loading raw dataset from {path}")
    checksum = compute_file_sha256(path)
    logger.info(f"Dataset SHA-256: {checksum}")

    # Read CSV
    # PhiUSIIL CSV contains UTF-8 BOM in FILENAME column header
    df = pd.read_csv(path, nrows=nrows, low_memory=False)
    logger.info(f"Loaded {len(df):,} records across {len(df.columns)} columns.")

    return df, str(path), checksum
