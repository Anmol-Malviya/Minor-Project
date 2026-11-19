from typing import List, Dict, Any
from src.features.url_parser import ParsedURL

def derive_risk_score(probability_phishing: float) -> float:
    """Scales calibrated probability into a 0-100 risk score rounded to 1 decimal place."""
    score = float(probability_phishing) * 100.0
    return round(max(0.0, min(100.0, score)), 1)

def extract_threat_indicators(url: str, feature_dict: Dict[str, float], risk_score: float) -> List[str]:
    """Generates precise, explainable indicators based on extracted URL features."""
    indicators = []

    if feature_dict.get("is_ip", 0.0) == 1.0:
        indicators.append("IP-address-based hostname detected (bypassing DNS domain identity)")

    if feature_dict.get("is_punycode", 0.0) == 1.0:
        indicators.append("Punycode / IDN homograph attack indicator detected (xn--)")

    if feature_dict.get("is_unusual_port", 0.0) == 1.0:
        indicators.append("Non-standard web port detected")

    if feature_dict.get("has_login_keyword", 0.0) == 1.0:
        indicators.append("Credential harvesting / login authentication keyword in URL path")

    if feature_dict.get("has_brand_keyword", 0.0) == 1.0 and feature_dict.get("num_subdomains", 0.0) >= 2.0:
        indicators.append("High-profile target brand name in subdomain/path structure")

    if feature_dict.get("url_entropy", 0.0) >= 4.5:
        indicators.append("High URL character entropy (indicative of token obfuscation or generated paths)")

    if feature_dict.get("num_at_symbols", 0.0) > 0.0:
        indicators.append("URL contains '@' symbol (potential credential/destination redirection trick)")

    if feature_dict.get("num_dots", 0.0) >= 4.0:
        indicators.append("Excessive dot count in URL structure")

    if feature_dict.get("has_https", 1.0) == 0.0 and feature_dict.get("has_login_keyword", 0.0) == 1.0:
        indicators.append("Insecure plain HTTP connection soliciting login actions")

    if feature_dict.get("url_length", 0.0) > 120.0:
        indicators.append("Unusually long URL structure designed to conceal destination")

    if not indicators and risk_score >= 50.0:
        indicators.append("Suspicious URL structure and lexical feature profile")

    return indicators
