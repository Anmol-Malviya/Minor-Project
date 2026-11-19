import json
from pathlib import Path
from typing import Dict, Any, Optional

import joblib
import numpy as np

from src.config.settings import (
    PRODUCTION_MODEL_DIR,
    ACTION_ALLOW,
    ACTION_BLOCK,
    CLASS_NAMES,
    LABEL_LEGITIMATE,
    LABEL_PHISHING,
    MODEL_VERSION
)
from src.features.url_feature_extractor import extract_features_from_url
from src.features.url_parser import ParsedURL
from src.features.feature_schema import FEATURE_COLUMNS
from src.features.trusted_domains import is_trusted_domain
from src.inference.risk_engine import derive_risk_score, extract_threat_indicators
from src.utils.logger import get_logger

logger = get_logger("inference.predictor")

class SecureOSPredictor:
    """Production predictor for SecureOS URL Phishing Classification."""

    def __init__(self, model_dir: Optional[Path] = None):
        self.model_dir = Path(model_dir) if model_dir else PRODUCTION_MODEL_DIR
        self.model = None
        self.threshold = 0.50
        self.feature_columns = FEATURE_COLUMNS
        self.metadata = {}
        self.is_loaded = False

        self.load()

    def load(self) -> None:
        """Loads serialized model, feature schema, threshold, and metadata."""
        model_path = self.model_dir / "secureos_phishing_model.joblib"
        threshold_path = self.model_dir / "threshold_config.json"
        schema_path = self.model_dir / "feature_schema.json"
        metadata_path = self.model_dir / "model_metadata.json"

        if not model_path.exists():
            raise FileNotFoundError(f"Production model artifact not found at {model_path}")

        logger.info(f"Loading production model artifact from {model_path}")
        self.model = joblib.load(model_path)

        if threshold_path.exists():
            with open(threshold_path, "r") as f:
                th_data = json.load(f)
                self.threshold = float(th_data.get("optimal_threshold", 0.50))
                logger.info(f"Loaded decision threshold: {self.threshold:.4f}")

        if schema_path.exists():
            with open(schema_path, "r") as f:
                schema_data = json.load(f)
                self.feature_columns = schema_data.get("columns", FEATURE_COLUMNS)

        if metadata_path.exists():
            with open(metadata_path, "r") as f:
                self.metadata = json.load(f)

        self.is_loaded = True

    def predict_url(self, url: str) -> Dict[str, Any]:
        """Predicts whether a given URL is LEGITIMATE or MALICIOUS."""
        if not self.is_loaded or self.model is None:
            raise RuntimeError("Model is not loaded. Call load() before predicting.")

        url_clean = str(url).strip()
        if not url_clean:
            return {
                "url": url,
                "classification": "LEGITIMATE",
                "is_phishing": False,
                "risk_score": 0.0,
                "model_version": MODEL_VERSION,
                "indicators": ["Empty URL input"],
                "action": ACTION_ALLOW
            }

        # 1. Feature extraction
        feature_dict = extract_features_from_url(url_clean)

        # 2. Vectorize exactly matching schema order
        input_vector = np.array(
            [[feature_dict[col] for col in self.feature_columns]],
            dtype=np.float32
        )

        # 3. Model probability prediction
        # Output probability for Phishing (Class 1)
        if hasattr(self.model, "predict_proba"):
            probs = self.model.predict_proba(input_vector)[0]
            # Standard binary classifier: probs[1] is phishing prob
            phishing_prob = float(probs[1]) if len(probs) > 1 else float(probs[0])
        else:
            decision = self.model.decision_function(input_vector)[0]
            phishing_prob = float(1.0 / (1.0 + np.exp(-decision)))

        # 4. Global Authority Domain Defense
        # If the root domain is a verified global authority (e.g. chatgpt.com, github.com, google.com)
        # and has no explicit spoofing/homoglyph/punycode/IP threat indicators:
        from src.features.trusted_domains import is_trusted_domain
        parsed_current = ParsedURL(url_clean)
        if is_trusted_domain(parsed_current.registered_domain):
            # Only flag if there is an explicit critical exploit indicator (e.g. @ sign trick or credentials)
            critical_threat = (
                feature_dict.get("is_ip", 0.0) == 1.0 or
                feature_dict.get("is_punycode", 0.0) == 1.0 or
                feature_dict.get("num_at_symbols", 0.0) > 0.0 or
                feature_dict.get("is_unusual_port", 0.0) == 1.0
            )
            if not critical_threat:
                phishing_prob = min(phishing_prob, 0.05)

        # 5. Binary Decision using optimized threshold
        is_phishing = bool(phishing_prob >= self.threshold)
        classification = "MALICIOUS" if is_phishing else "LEGITIMATE"
        action = ACTION_BLOCK if is_phishing else ACTION_ALLOW

        # 5. Risk score & Explainable threat indicators
        risk_score = derive_risk_score(phishing_prob)
        indicators = extract_threat_indicators(url_clean, feature_dict, risk_score) if is_phishing else []

        return {
            "url": url_clean,
            "classification": classification,
            "is_phishing": is_phishing,
            "risk_score": risk_score,
            "model_version": self.metadata.get("model_version", MODEL_VERSION),
            "indicators": indicators,
            "action": action
        }

# Global singleton predictor instance
_PREDICTOR_INSTANCE: Optional[SecureOSPredictor] = None

def get_predictor() -> SecureOSPredictor:
    """Returns singleton predictor instance."""
    global _PREDICTOR_INSTANCE
    if _PREDICTOR_INSTANCE is None:
        _PREDICTOR_INSTANCE = SecureOSPredictor()
    return _PREDICTOR_INSTANCE

def predict_url(url: str) -> Dict[str, Any]:
    """Top-level convenience prediction function."""
    return get_predictor().predict_url(url)
