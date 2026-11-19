import pytest
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)

def test_api_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True

def test_api_model_info():
    response = client.get("/model/info")
    assert response.status_code == 200
    data = response.json()
    assert "model_version" in data
    assert "decision_threshold" in data
    assert data["features_count"] == 34

def test_api_predict_legitimate():
    response = client.post("/predict", json={"url": "https://www.google.com"})
    assert response.status_code == 200
    data = response.json()
    assert data["url"] == "https://www.google.com"
    assert data["classification"] in {"LEGITIMATE", "MALICIOUS"}
    assert "risk_score" in data
    assert "indicators" in data

def test_api_predict_validation_error():
    # Missing url key
    response = client.post("/predict", json={})
    assert response.status_code == 422
