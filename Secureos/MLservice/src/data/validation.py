from typing import Dict, Any, List
import pandas as pd
from src.utils.logger import get_logger

logger = get_logger("data.validation")

def validate_dataset_schema(df: pd.DataFrame) -> Dict[str, Any]:
    """Validates presence of essential columns (URL and label), null counts, and data types."""
    # Check URL column
    url_col = None
    for c in df.columns:
        if c.strip().lower() == "url":
            url_col = c
            break

    label_col = None
    for c in df.columns:
        if c.strip().lower() == "label":
            label_col = c
            break

    if not url_col:
        raise ValueError("Missing required 'URL' column in dataset.")
    if not label_col:
        raise ValueError("Missing required 'label' column in dataset.")

    total_rows = len(df)
    null_urls = int(df[url_col].isna().sum())
    null_labels = int(df[label_col].isna().sum())

    # Check distinct label values
    unique_labels = [int(x) for x in df[label_col].dropna().unique()]
    valid_labels = set(unique_labels).issubset({0, 1})

    report = {
        "total_rows": total_rows,
        "url_col": url_col,
        "label_col": label_col,
        "null_urls": null_urls,
        "null_labels": null_labels,
        "unique_labels": unique_labels,
        "valid_labels": valid_labels,
    }

    logger.info(f"Dataset schema validated. Rows: {total_rows:,}, Unique labels: {unique_labels}")
    return report

def analyze_duplicates_and_conflicts(df: pd.DataFrame, url_col: str, label_col: str) -> Dict[str, Any]:
    """Performs duplicate URL analysis and detects conflicting labels."""
    total_records = len(df)
    unique_urls = df[url_col].nunique()
    exact_duplicates = total_records - unique_urls

    # Check conflicts
    grouped = df.groupby(url_col)[label_col].nunique()
    conflicts = grouped[grouped > 1]
    conflict_count = len(conflicts)

    report = {
        "total_records": total_records,
        "unique_urls": unique_urls,
        "exact_duplicates": exact_duplicates,
        "conflicting_urls_count": conflict_count,
        "conflicting_sample": conflicts.index.tolist()[:5] if conflict_count > 0 else []
    }

    logger.info(
        f"Duplicate Analysis: {exact_duplicates:,} duplicates found ({unique_urls:,} unique URLs). "
        f"Conflicting labels: {conflict_count}."
    )
    return report
