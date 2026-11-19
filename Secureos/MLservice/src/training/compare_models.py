import time
from typing import Dict, Any, Tuple
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import xgboost as xgb
import lightgbm as lgb

from src.training.evaluate import evaluate_predictions
from src.utils.logger import get_logger
from src.config.settings import RANDOM_SEED

logger = get_logger("training.compare_models")

def train_and_benchmark_models(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray
) -> Dict[str, Dict[str, Any]]:
    """Trains and benchmarks 4 algorithms:
    1. Logistic Regression (Baseline)
    2. Random Forest
    3. XGBoost
    4. LightGBM
    """
    results: Dict[str, Dict[str, Any]] = {}

    # Define models
    # Note: balanced class weighting applied
    models = {
        "LogisticRegression": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(solver="lbfgs", max_iter=2000, class_weight="balanced", random_state=RANDOM_SEED))
        ]),
        "RandomForest": RandomForestClassifier(
            n_estimators=100,
            max_depth=16,
            min_samples_split=5,
            class_weight="balanced",
            n_jobs=-1,
            random_state=RANDOM_SEED
        ),
        "XGBoost": xgb.XGBClassifier(
            n_estimators=150,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=(len(y_train) - sum(y_train)) / sum(y_train),
            eval_metric="logloss",
            random_state=RANDOM_SEED,
            n_jobs=-1
        ),
        "LightGBM": lgb.LGBMClassifier(
            n_estimators=150,
            max_depth=6,
            learning_rate=0.1,
            num_leaves=31,
            class_weight="balanced",
            random_state=RANDOM_SEED,
            n_jobs=-1,
            verbosity=-1
        )
    }

    for name, model in models.items():
        logger.info(f"--- Training {name} ---")
        t0 = time.time()
        model.fit(X_train, y_train)
        train_duration = time.time() - t0

        # Measure inference latency on validation set (per sample in ms)
        t_infer_start = time.time()
        if hasattr(model, "predict_proba"):
            val_probs = model.predict_proba(X_val)[:, 1]
        else:
            val_probs = model.decision_function(X_val)
        infer_duration = time.time() - t_infer_start
        per_sample_latency_ms = (infer_duration / len(X_val)) * 1000.0

        # Evaluate at standard 0.50 threshold
        metrics = evaluate_predictions(y_val, val_probs, threshold=0.50)
        metrics["training_time_seconds"] = float(round(train_duration, 2))
        metrics["inference_latency_ms_per_sample"] = float(round(per_sample_latency_ms, 4))

        logger.info(
            f"{name} Results -> F1: {metrics['f1']:.4f}, Recall: {metrics['recall']:.4f}, "
            f"FPR: {metrics['fpr']:.4f}, ROC-AUC: {metrics['roc_auc']:.4f}, "
            f"Train Time: {metrics['training_time_seconds']}s, Latency: {metrics['inference_latency_ms_per_sample']}ms"
        )

        results[name] = {
            "model": model,
            "val_probabilities": val_probs,
            "metrics": metrics
        }

    return results
