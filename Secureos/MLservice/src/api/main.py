import time
from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from src.config.settings import MODEL_VERSION, URL_MAX_LENGTH
from src.inference.predictor import get_predictor
from src.utils.logger import get_logger

logger = get_logger("api.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load model once
    logger.info("Initializing SecureOS Predictor at application startup...")
    predictor = get_predictor()
    logger.info(f"Predictor ready. Model version: {predictor.metadata.get('model_version', MODEL_VERSION)}")
    yield
    # Teardown logic if needed

app = FastAPI(
    title="SecureOS Phishing Detection Inference API",
    description="Production-grade ML inference service for detecting malicious phishing URLs.",
    version="1.0.0",
    lifespan=lifespan
)

# Input schema
class PredictRequest(BaseModel):
    url: str = Field(
        ...,
        min_length=1,
        max_length=URL_MAX_LENGTH,
        description="The URL string to evaluate for phishing threats.",
        examples=["https://example.com"]
    )

# Output schema
class PredictResponse(BaseModel):
    url: str
    classification: str
    is_phishing: bool
    risk_score: float
    model_version: str
    indicators: List[str]
    action: str

# Endpoints
@app.get("/health", status_code=status.HTTP_200_OK)
def health():
    """Health check endpoint validating service status and model load state."""
    predictor = get_predictor()
    return {
        "status": "healthy",
        "model_loaded": predictor.is_loaded,
        "service": "SecureOS ML Service"
    }

@app.get("/model/info", status_code=status.HTTP_200_OK)
def model_info():
    """Returns model metadata, performance metrics, and configuration."""
    predictor = get_predictor()
    return {
        "model_version": predictor.metadata.get("model_version", MODEL_VERSION),
        "base_model": predictor.metadata.get("base_model", "LightGBM"),
        "decision_threshold": predictor.threshold,
        "features_count": len(predictor.feature_columns),
        "training_timestamp": predictor.metadata.get("training_timestamp"),
        "test_metrics": predictor.metadata.get("test_metrics")
    }

@app.post("/predict", response_model=PredictResponse, status_code=status.HTTP_200_OK)
def predict(payload: PredictRequest):
    """Predicts whether a submitted URL is LEGITIMATE or MALICIOUS."""
    try:
        t0 = time.time()
        predictor = get_predictor()
        result = predictor.predict_url(payload.url)
        elapsed_ms = (time.time() - t0) * 1000.0

        logger.info(
            f"Prediction completed in {elapsed_ms:.2f}ms | "
            f"Classification: {result['classification']} | Risk: {result['risk_score']}"
        )
        return result
    except Exception as e:
        logger.error(f"Inference error processing URL: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal prediction engine error."
        )
