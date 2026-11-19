"""Feature Schema definition for SecureOS Phishing Detection.

Defines the exact list, order, types, and descriptions of features
extracted directly from URL strings for training and production inference.
"""

FEATURE_COLUMNS = [
    "url_length",
    "hostname_length",
    "path_length",
    "query_length",
    "num_dots",
    "num_hyphens",
    "num_underscores",
    "num_slashes",
    "num_question_marks",
    "num_equal_signs",
    "num_at_symbols",
    "num_ampersands",
    "num_percent_signs",
    "num_digits",
    "num_letters",
    "num_subdomains",
    "has_https",
    "is_ip",
    "is_ipv6",
    "is_punycode",
    "has_port",
    "is_unusual_port",
    "digit_ratio",
    "letter_ratio",
    "special_char_ratio",
    "url_entropy",
    "hostname_entropy",
    "num_suspicious_keywords",
    "has_login_keyword",
    "has_security_keyword",
    "has_brand_keyword",
    "tld_length",
    "path_depth",
    "is_trusted_authority",
]

def get_feature_schema() -> dict:
    """Return formal dictionary of schema specifications."""
    return {
        "version": "1.0",
        "num_features": len(FEATURE_COLUMNS),
        "columns": FEATURE_COLUMNS,
        "dtypes": {col: "float32" for col in FEATURE_COLUMNS}
    }
