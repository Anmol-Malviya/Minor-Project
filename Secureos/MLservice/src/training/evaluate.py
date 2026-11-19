from typing import Dict, Any, Tuple
import numpy as np
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    confusion_matrix,
    brier_score_loss,
    log_loss
)

def evaluate_predictions(
    y_true: np.ndarray,
    y_pred_proba: np.ndarray,
    threshold: float = 0.50
) -> Dict[str, Any]:
    """Computes comprehensive cybersecurity evaluation metrics.
    
    Convention:
      - Class 1: Phishing / Malicious
      - Class 0: Legitimate
    """
    y_true_binary = (y_true == 1).astype(int)
    y_pred_binary = (y_pred_proba >= threshold).astype(int)

    # Confusion matrix
    # tn: Legitimate predicted Legitimate
    # fp: Legitimate predicted Malicious (False Alarm)
    # fn: Malicious predicted Legitimate (Missed Phish)
    # tp: Malicious predicted Malicious (Caught Phish)
    cm = confusion_matrix(y_true_binary, y_pred_binary, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()

    precision = float(precision_score(y_true_binary, y_pred_binary, zero_division=0))
    recall = float(recall_score(y_true_binary, y_pred_binary, zero_division=0))
    f1 = float(f1_score(y_true_binary, y_pred_binary, zero_division=0))

    # Area Under Curves
    try:
        roc_auc = float(roc_auc_score(y_true_binary, y_pred_proba))
    except Exception:
        roc_auc = 0.0

    try:
        pr_auc = float(average_precision_score(y_true_binary, y_pred_proba))
    except Exception:
        pr_auc = 0.0

    # Rates
    fpr = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0
    fnr = float(fn / (fn + tp)) if (fn + tp) > 0 else 0.0
    brier = float(brier_score_loss(y_true_binary, y_pred_proba))

    return {
        "threshold": float(threshold),
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "roc_auc": roc_auc,
        "pr_auc": pr_auc,
        "fpr": fpr,
        "fnr": fnr,
        "brier_score": brier,
        "true_negatives": int(tn),
        "false_positives": int(fp),
        "false_negatives": int(fn),
        "true_positives": int(tp),
        "confusion_matrix": [[int(tn), int(fp)], [int(fn), int(tp)]]
    }
