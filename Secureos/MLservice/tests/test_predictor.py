import pytest
from src.inference.predictor import get_predictor, predict_url

def test_predictor_model_loaded():
    predictor = get_predictor()
    assert predictor.is_loaded is True
    assert predictor.model is not None
    assert 0.0 < predictor.threshold < 1.0

def test_prediction_output_schema():
    res = predict_url("https://www.google.com")
    assert "url" in res
    assert res["classification"] in {"LEGITIMATE", "MALICIOUS"}
    assert isinstance(res["is_phishing"], bool)
    assert 0.0 <= res["risk_score"] <= 100.0
    assert "model_version" in res
    assert isinstance(res["indicators"], list)
    assert res["action"] in {"ALLOW", "BLOCK"}

def test_empty_url_handling():
    res = predict_url("")
    assert res["classification"] == "LEGITIMATE"
    assert res["is_phishing"] is False
    assert res["action"] == "ALLOW"

def test_phishing_url_detection():
    # URL containing IP, port, credential keyword, and high entropy
    res = predict_url("http://192.168.1.1:8080/paypal-login/verify-credentials.php")
    assert res["classification"] == "MALICIOUS"
    assert res["is_phishing"] is True
    assert res["action"] == "BLOCK"
    assert len(res["indicators"]) > 0
