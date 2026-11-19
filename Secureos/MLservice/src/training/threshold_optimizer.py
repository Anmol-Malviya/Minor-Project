from typing import Dict, Any, List
import numpy as np
from src.training.evaluate import evaluate_predictions
from src.utils.logger import get_logger

logger = get_logger("training.threshold_optimizer")

def optimize_decision_threshold(
    y_true: np.ndarray,
    y_pred_proba: np.ndarray,
    min_precision: float = 0.95,
    max_acceptable_fpr: float = 0.05
) -> Dict[str, Any]:
    """Finds optimal decision threshold balancing phishing recall and legitimate false positive rate.
    
    Evaluates thresholds from 0.05 to 0.95 in 0.01 increments.
    Prioritizes high phishing detection while keeping legitimate URLs incorrectly flagged as low as achievable.
    """
    thresholds = np.linspace(0.05, 0.95, 91)
    best_threshold = 0.50
    best_metrics = None
    best_score = -1.0

    eval_history: List[Dict[str, Any]] = []

    for t in thresholds:
        m = evaluate_predictions(y_true, y_pred_proba, threshold=float(t))
        eval_history.append(m)

        # Optimization objective:
        # Penalize FPR heavily, maximize F1 and Recall
        # Score = F1 - 2.0 * FPR
        # Filter candidate thresholds satisfying safety constraints
        candidate_score = m["f1"] - (2.0 * m["fpr"])

        if m["fpr"] <= max_acceptable_fpr and candidate_score > best_score:
            best_score = candidate_score
            best_threshold = float(t)
            best_metrics = m

    # Fallback to highest F1 if no threshold meets max_acceptable_fpr
    if best_metrics is None:
        eval_history_sorted = sorted(eval_history, key=lambda x: x["f1"], reverse=True)
        best_metrics = eval_history_sorted[0]
        best_threshold = best_metrics["threshold"]

    logger.info(
        f"Optimized Threshold Selected: {best_threshold:.2f} "
        f"(Recall: {best_metrics['recall']:.4f}, FPR: {best_metrics['fpr']:.4f}, F1: {best_metrics['f1']:.4f})"
    )

    return {
        "optimal_threshold": float(best_threshold),
        "validation_metrics": best_metrics,
        "history": eval_history
    }
