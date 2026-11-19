import math
import re
from collections import Counter
from typing import Dict, Any, List

import numpy as np

from src.features.url_parser import ParsedURL
from src.features.feature_schema import FEATURE_COLUMNS
from src.features.trusted_domains import is_trusted_domain

# Target keywords commonly leveraged in credential harvesting and phishing attacks
LOGIN_KEYWORDS = {"login", "signin", "sign-in", "log-in", "verify", "auth", "session"}
SECURITY_KEYWORDS = {"account", "banking", "wallet", "secure", "confirm", "update", "recovery", "password", "security"}
BRAND_KEYWORDS = {"paypal", "apple", "google", "microsoft", "netflix", "amazon", "chase", "facebook", "wells-fargo", "dropbox"}
ALL_SUSPICIOUS_KEYWORDS = LOGIN_KEYWORDS | SECURITY_KEYWORDS | BRAND_KEYWORDS

STANDARD_PORTS = {80, 443, 8080, 8443}

def calculate_shannon_entropy(text: str) -> float:
    """Calculates Shannon entropy of a string."""
    if not text:
        return 0.0
    length = len(text)
    counts = Counter(text)
    return -sum((count / length) * math.log2(count / length) for count in counts.values())

def extract_features_from_url(raw_url: str) -> Dict[str, float]:
    """Extracts exactly the schema features from a single raw URL string safely.
    
    Returns a dictionary of float values keyed by FEATURE_COLUMNS.
    """
    parsed = ParsedURL(raw_url)
    url_str = parsed.cleaned_url
    hostname = parsed.hostname
    path = parsed.path
    query = parsed.query

    url_len = len(url_str)
    host_len = len(hostname)
    path_len = len(path)
    query_len = len(query)

    num_digits = sum(c.isdigit() for c in url_str)
    num_letters = sum(c.isalpha() for c in url_str)
    num_special = url_len - (num_digits + num_letters)

    digit_ratio = (num_digits / url_len) if url_len > 0 else 0.0
    letter_ratio = (num_letters / url_len) if url_len > 0 else 0.0
    special_char_ratio = (num_special / url_len) if url_len > 0 else 0.0

    # Count subdomains
    if parsed.is_ip or not parsed.subdomain:
        num_subdomains = 0
    else:
        num_subdomains = len(parsed.subdomain.split("."))

    # Port analysis
    has_port = 1.0 if parsed.port is not None else 0.0
    is_unusual_port = 1.0 if (parsed.port is not None and parsed.port not in STANDARD_PORTS) else 0.0

    # Keyword detection (case-insensitive search in domain and path)
    url_lower = url_str.lower()
    num_susp_kw = sum(1 for kw in ALL_SUSPICIOUS_KEYWORDS if kw in url_lower)
    has_login_kw = 1.0 if any(kw in url_lower for kw in LOGIN_KEYWORDS) else 0.0
    has_sec_kw = 1.0 if any(kw in url_lower for kw in SECURITY_KEYWORDS) else 0.0
    has_brand_kw = 1.0 if any(kw in url_lower for kw in BRAND_KEYWORDS) else 0.0

    # Depth
    path_depth = len([segment for segment in path.split("/") if segment])

    features = {
        "url_length": float(url_len),
        "hostname_length": float(host_len),
        "path_length": float(path_len),
        "query_length": float(query_len),
        "num_dots": float(url_str.count(".")),
        "num_hyphens": float(url_str.count("-")),
        "num_underscores": float(url_str.count("_")),
        "num_slashes": float(url_str.count("/")),
        "num_question_marks": float(url_str.count("?")),
        "num_equal_signs": float(url_str.count("=")),
        "num_at_symbols": float(url_str.count("@")),
        "num_ampersands": float(url_str.count("&")),
        "num_percent_signs": float(url_str.count("%")),
        "num_digits": float(num_digits),
        "num_letters": float(num_letters),
        "num_subdomains": float(num_subdomains),
        "has_https": 1.0 if parsed.scheme == "https" else 0.0,
        "is_ip": 1.0 if parsed.is_ip else 0.0,
        "is_ipv6": 1.0 if parsed.is_ipv6 else 0.0,
        "is_punycode": 1.0 if parsed.is_punycode else 0.0,
        "has_port": has_port,
        "is_unusual_port": is_unusual_port,
        "digit_ratio": float(digit_ratio),
        "letter_ratio": float(letter_ratio),
        "special_char_ratio": float(special_char_ratio),
        "url_entropy": float(calculate_shannon_entropy(url_str)),
        "hostname_entropy": float(calculate_shannon_entropy(hostname)),
        "num_suspicious_keywords": float(num_susp_kw),
        "has_login_keyword": has_login_kw,
        "has_security_keyword": has_sec_kw,
        "has_brand_keyword": has_brand_kw,
        "tld_length": float(len(parsed.suffix)),
        "path_depth": float(path_depth),
        "is_trusted_authority": 1.0 if is_trusted_domain(parsed.registered_domain) else 0.0,
    }

    return features

def extract_features_vector(raw_url: str) -> np.ndarray:
    """Extracts features in the exact ordered array format expected by ML models."""
    feat_dict = extract_features_from_url(raw_url)
    return np.array([feat_dict[col] for col in FEATURE_COLUMNS], dtype=np.float32)

def extract_features_batch(urls: List[str]) -> np.ndarray:
    """Extracts feature matrix for a batch of URLs."""
    matrix = np.zeros((len(urls), len(FEATURE_COLUMNS)), dtype=np.float32)
    for idx, url in enumerate(urls):
        feat_dict = extract_features_from_url(url)
        for c_idx, col in enumerate(FEATURE_COLUMNS):
            matrix[idx, c_idx] = feat_dict[col]
    return matrix
