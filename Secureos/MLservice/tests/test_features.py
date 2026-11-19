import pytest
import numpy as np
from src.features.url_parser import ParsedURL
from src.features.url_feature_extractor import extract_features_from_url, extract_features_vector
from src.features.feature_schema import FEATURE_COLUMNS

def test_url_parser_standard():
    p = ParsedURL("https://www.google.com/search?q=test")
    assert p.scheme == "https"
    assert p.hostname == "www.google.com"
    assert p.domain == "google"
    assert p.suffix == "com"
    assert p.subdomain == "www"
    assert p.is_ip is False

def test_url_parser_ipv4():
    p = ParsedURL("http://192.168.1.1:8080/admin")
    assert p.is_ip is True
    assert p.port == 8080
    assert p.hostname == "192.168.1.1"

def test_url_parser_ipv6():
    p = ParsedURL("http://[2001:db8::1]:80/path")
    assert p.is_ip is True
    assert p.is_ipv6 is True

def test_url_parser_punycode():
    p = ParsedURL("http://xn--pypal-4ve.com/account")
    assert p.is_punycode is True

def test_url_parser_missing_scheme():
    p = ParsedURL("domain.com/path?arg=1")
    assert p.domain == "domain"
    assert p.scheme in {"http", "https"}
    assert "domain.com" in p.hostname

def test_feature_extractor_consistency():
    url = "https://secure-login.bank.example.com:443/verify?user=admin#top"
    feat_dict = extract_features_from_url(url)
    feat_vec = extract_features_vector(url)

    assert len(feat_dict) == len(FEATURE_COLUMNS)
    assert len(feat_vec) == len(FEATURE_COLUMNS)

    for i, col in enumerate(FEATURE_COLUMNS):
        assert feat_dict[col] == feat_vec[i], f"Mismatch for feature {col}"
