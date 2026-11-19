import pytest
import pandas as pd
from src.data.loader import load_raw_dataset, find_dataset_path
from src.data.validation import validate_dataset_schema, analyze_duplicates_and_conflicts
from src.data.preprocessing import clean_and_deduplicate

def test_dataset_discovery_and_loader():
    path = find_dataset_path()
    assert path.exists(), "Dataset path must resolve to an existing file."
    df, path_str, checksum = load_raw_dataset(nrows=100)
    assert len(df) == 100
    assert len(checksum) == 64

def test_label_mapping_and_schema():
    df, _, _ = load_raw_dataset(nrows=500)
    schema_info = validate_dataset_schema(df)
    assert schema_info["valid_labels"] is True
    # Verify labels 0 (phishing) and 1 (legitimate) exist
    unique = set(schema_info["unique_labels"])
    assert 0 in unique and 1 in unique

def test_duplicate_handling():
    sample_data = pd.DataFrame({
        "URL": ["http://a.com", "http://a.com", "http://b.com"],
        "label": [1, 1, 0]
    })
    dup_info = analyze_duplicates_and_conflicts(sample_data, "URL", "label")
    assert dup_info["exact_duplicates"] == 1
    assert dup_info["conflicting_urls_count"] == 0

    df_clean = clean_and_deduplicate(sample_data, "URL", "label")
    assert len(df_clean) == 2
