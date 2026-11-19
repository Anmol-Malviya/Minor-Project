from typing import Tuple, Dict, Any, List
import pandas as pd
import numpy as np
from sklearn.model_selection import GroupShuffleSplit
import tldextract

from src.features.url_parser import ParsedURL
from src.features.url_feature_extractor import extract_features_batch
from src.features.feature_schema import FEATURE_COLUMNS
from src.utils.logger import get_logger
from src.config.settings import RANDOM_SEED

logger = get_logger("data.preprocessing")

_EXTRACTOR = tldextract.TLDExtract(cache_dir=None, suffix_list_urls=None)

def extract_registrable_domain(url: str) -> str:
    """Extracts registrable domain (e.g., example.co.uk -> example.co.uk) for group splitting."""
    try:
        p = ParsedURL(url)
        if p.is_ip:
            return p.hostname or "ip_address"
        ext = _EXTRACTOR(p.hostname)
        if ext.domain and ext.suffix:
            return f"{ext.domain}.{ext.suffix}".lower()
        return (p.hostname or "unknown_domain").lower()
    except Exception:
        return "unknown_domain"

def clean_and_deduplicate(
    df: pd.DataFrame,
    url_col: str,
    label_col: str
) -> pd.DataFrame:
    """Removes invalid, null, exact duplicate, and conflicting-label records."""
    initial_len = len(df)
    
    # Drop rows with null URL or null label
    df_clean = df.dropna(subset=[url_col, label_col]).copy()
    
    # Strip whitespaces
    df_clean[url_col] = df_clean[url_col].astype(str).str.strip()
    df_clean[label_col] = df_clean[label_col].astype(int)

    # Drop empty strings
    df_clean = df_clean[df_clean[url_col] != ""]

    # Remove conflicting label URLs if any
    conflicts = df_clean.groupby(url_col)[label_col].nunique()
    conflict_urls = set(conflicts[conflicts > 1].index)
    if conflict_urls:
        logger.warning(f"Dropping {len(conflict_urls)} URLs with conflicting labels.")
        df_clean = df_clean[~df_clean[url_col].isin(conflict_urls)]

    # Deduplicate exact URLs keeping the first instance
    df_clean = df_clean.drop_duplicates(subset=[url_col], keep="first").reset_index(drop=True)
    
    logger.info(
        f"Data cleaned & deduplicated: from {initial_len:,} rows to {len(df_clean):,} unique valid records."
    )
    return df_clean

def split_dataset_domain_grouped(
    df: pd.DataFrame,
    url_col: str,
    label_col: str,
    train_size: float = 0.70,
    val_size: float = 0.15,
    test_size: float = 0.15,
    random_state: int = RANDOM_SEED
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Splits dataset into Train, Validation, and Test sets using domain-aware grouping.
    
    Ensures URLs belonging to the same registrable domain cannot leak across partitions.
    """
    assert abs((train_size + val_size + test_size) - 1.0) < 1e-5, "Split fractions must sum to 1.0"

    logger.info("Extracting registrable domains for GroupShuffleSplit...")
    df["reg_domain"] = df[url_col].apply(extract_registrable_domain)

    # First split: Train vs (Val + Test)
    val_test_ratio = val_size + test_size
    gss_first = GroupShuffleSplit(n_splits=1, test_size=val_test_ratio, random_state=random_state)
    train_idx, temp_idx = next(gss_first.split(df, groups=df["reg_domain"]))

    train_df = df.iloc[train_idx].copy().reset_index(drop=True)
    temp_df = df.iloc[temp_idx].copy().reset_index(drop=True)

    # Second split: Val vs Test
    test_relative_ratio = test_size / val_test_ratio
    gss_second = GroupShuffleSplit(n_splits=1, test_size=test_relative_ratio, random_state=random_state)
    val_idx, test_idx = next(gss_second.split(temp_df, groups=temp_df["reg_domain"]))

    val_df = temp_df.iloc[val_idx].copy().reset_index(drop=True)
    test_df = temp_df.iloc[test_idx].copy().reset_index(drop=True)

    # Verify zero domain overlap
    train_domains = set(train_df["reg_domain"])
    val_domains = set(val_df["reg_domain"])
    test_domains = set(test_df["reg_domain"])

    overlap_train_val = len(train_domains.intersection(val_domains))
    overlap_train_test = len(train_domains.intersection(test_domains))
    overlap_val_test = len(val_domains.intersection(test_domains))

    logger.info(
        f"Domain-aware split completed: "
        f"Train={len(train_df):,} ({len(train_domains):,} domains), "
        f"Val={len(val_df):,} ({len(val_domains):,} domains), "
        f"Test={len(test_df):,} ({len(test_domains):,} domains)"
    )
    logger.info(
        f"Domain leakage checks: Train-Val={overlap_train_val}, "
        f"Train-Test={overlap_train_test}, Val-Test={overlap_val_test}"
    )

    return train_df, val_df, test_df
