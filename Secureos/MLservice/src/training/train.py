import datetime
import json
import platform
import sys
from pathlib import Path
from typing import Optional, Dict, Any

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import roc_curve, precision_recall_curve

from src.config.settings import (
    BASE_DIR,
    PRODUCTION_MODEL_DIR,
    EXPERIMENTS_MODEL_DIR,
    METRICS_DIR,
    FIGURES_DIR,
    COMPARISON_DIR,
    RANDOM_SEED,
    MODEL_VERSION
)
from src.data.loader import load_raw_dataset
from src.data.validation import validate_dataset_schema, analyze_duplicates_and_conflicts
from src.data.preprocessing import clean_and_deduplicate, split_dataset_domain_grouped
from src.features.url_feature_extractor import extract_features_batch
from src.features.feature_schema import FEATURE_COLUMNS, get_feature_schema
from src.training.compare_models import train_and_benchmark_models
from src.training.threshold_optimizer import optimize_decision_threshold
from src.training.evaluate import evaluate_predictions
from src.utils.logger import get_logger
from src.utils.reproducibility import set_seed

logger = get_logger("training.train")

def run_training_pipeline(
    custom_dataset_path: Optional[str] = None,
    sample_limit: Optional[int] = None
) -> Dict[str, Any]:
    """Executes the complete end-to-end training, validation, threshold optimization, and artifact export."""
    set_seed(RANDOM_SEED)

    # Ensure output directories exist
    for d in [PRODUCTION_MODEL_DIR, EXPERIMENTS_MODEL_DIR, METRICS_DIR, FIGURES_DIR, COMPARISON_DIR]:
        d.mkdir(parents=True, exist_ok=True)

    # 1. Load dataset safely
    logger.info("=== STEP 1: Load and Validate Raw Dataset ===")
    df_raw, dataset_path, checksum = load_raw_dataset(custom_dataset_path, nrows=sample_limit)
    
    validation_info = validate_dataset_schema(df_raw)
    url_col = validation_info["url_col"]
    label_col = validation_info["label_col"]

    dup_info = analyze_duplicates_and_conflicts(df_raw, url_col, label_col)

    # 2. Clean and Deduplicate
    logger.info("=== STEP 2: Clean and Deduplicate Dataset ===")
    df_clean = clean_and_deduplicate(df_raw, url_col, label_col)

    # Invert target label mapping:
    # Original PhiUSIIL dataset: 1 = Legitimate, 0 = Phishing
    # Model binary classification convention: 1 = Phishing (Malicious), 0 = Legitimate
    logger.info("Mapping target labels: Phishing=1 (was 0), Legitimate=0 (was 1)")
    df_clean["target"] = (df_clean[label_col] == 0).astype(int)

    # 3. Domain-Aware Splitting
    logger.info("=== STEP 3: Domain-Aware Dataset Splitting (70% / 15% / 15%) ===")
    train_df, val_df, test_df = split_dataset_domain_grouped(
        df_clean,
        url_col=url_col,
        label_col="target",
        train_size=0.70,
        val_size=0.15,
        test_size=0.15,
        random_state=RANDOM_SEED
    )

    # 4. Feature Extraction
    logger.info("=== STEP 4: Feature Extraction from URL Strings ===")
    logger.info(f"Extracting features for {len(train_df):,} training URLs...")
    X_train = extract_features_batch(train_df[url_col].tolist())
    y_train = train_df["target"].to_numpy(dtype=np.int32)

    logger.info(f"Extracting features for {len(val_df):,} validation URLs...")
    X_val = extract_features_batch(val_df[url_col].tolist())
    y_val = val_df["target"].to_numpy(dtype=np.int32)

    logger.info(f"Extracting features for {len(test_df):,} test URLs...")
    X_test = extract_features_batch(test_df[url_col].tolist())
    y_test = test_df["target"].to_numpy(dtype=np.int32)

    # 5. Model Training & Comparison
    logger.info("=== STEP 5: Train and Benchmark Candidate Models ===")
    benchmark_results = train_and_benchmark_models(X_train, y_train, X_val, y_val)

    # Select best model based on F1, Phishing Recall, and FPR constraint
    best_model_name = None
    best_model_score = -1.0
    for name, res in benchmark_results.items():
        m = res["metrics"]
        score = m["f1"] + (0.5 * m["recall"]) - (2.0 * m["fpr"])
        if score > best_model_score:
            best_model_score = score
            best_model_name = name

    logger.info(f"Selected Champion Model: {best_model_name}")
    champion_candidate = benchmark_results[best_model_name]["model"]

    # 6. Probability Calibration
    logger.info("=== STEP 6: Probability Calibration with CalibratedClassifierCV ===")
    # Calibrate champion model using sigmoid on validation data
    calibrated_model = CalibratedClassifierCV(champion_candidate, method="sigmoid", cv="prefit")
    calibrated_model.fit(X_val, y_val)

    val_probs_calibrated = calibrated_model.predict_proba(X_val)[:, 1]

    # 7. Threshold Optimization on Validation Set
    logger.info("=== STEP 7: Threshold Optimization ===")
    threshold_result = optimize_decision_threshold(
        y_val,
        val_probs_calibrated,
        min_precision=0.95,
        max_acceptable_fpr=0.03
    )
    optimal_threshold = threshold_result["optimal_threshold"]
    val_metrics = threshold_result["validation_metrics"]

    # 8. Final Held-Out Evaluation on Unseen Test Set
    logger.info("=== STEP 8: Final Unseen Test Evaluation ===")
    test_probs = calibrated_model.predict_proba(X_test)[:, 1]
    test_metrics = evaluate_predictions(y_test, test_probs, threshold=optimal_threshold)
    logger.info(
        f"Test Set Final Metrics -> Recall: {test_metrics['recall']:.4f}, "
        f"FPR: {test_metrics['fpr']:.4f}, Precision: {test_metrics['precision']:.4f}, "
        f"F1: {test_metrics['f1']:.4f}, ROC-AUC: {test_metrics['roc_auc']:.4f}"
    )

    # 9. Generate Plots & Reports
    logger.info("=== STEP 9: Generate Visualizations & Metric Reports ===")
    _generate_figures(y_test, test_probs, optimal_threshold, FIGURES_DIR)
    _save_reports(
        benchmark_results,
        validation_info,
        dup_info,
        train_df,
        val_df,
        test_df,
        val_metrics,
        test_metrics,
        optimal_threshold,
        threshold_result["history"]
    )

    # 10. Save Production Artifacts
    logger.info("=== STEP 10: Export Production Artifacts ===")
    prod_model_path = PRODUCTION_MODEL_DIR / "secureos_phishing_model.joblib"
    joblib.dump(calibrated_model, prod_model_path, compress=3)
    logger.info(f"Saved production model to {prod_model_path}")

    schema_path = PRODUCTION_MODEL_DIR / "feature_schema.json"
    with open(schema_path, "w") as f:
        json.dump(get_feature_schema(), f, indent=2)

    threshold_path = PRODUCTION_MODEL_DIR / "threshold_config.json"
    with open(threshold_path, "w") as f:
        json.dump({
            "optimal_threshold": float(optimal_threshold),
            "selection_strategy": "Penalized FPR constrained optimization on domain-grouped validation set",
            "validation_metrics": val_metrics,
            "test_metrics": test_metrics
        }, f, indent=2)

    metadata_path = PRODUCTION_MODEL_DIR / "model_metadata.json"
    metadata = {
        "model_name": f"SecureOS_{best_model_name}_Calibrated",
        "model_version": MODEL_VERSION,
        "base_model": best_model_name,
        "calibration": "sigmoid (Platt scaling prefit on val)",
        "training_timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "dataset_name": Path(dataset_path).name,
        "dataset_checksum_sha256": checksum,
        "dataset_records_raw": len(df_raw),
        "dataset_records_clean": len(df_clean),
        "train_samples": len(train_df),
        "val_samples": len(val_df),
        "test_samples": len(test_df),
        "label_mapping": {
            "0": "LEGITIMATE",
            "1": "MALICIOUS (PHISHING)"
        },
        "original_dataset_label_mapping": {
            "0": "PHISHING",
            "1": "LEGITIMATE"
        },
        "selected_threshold": float(optimal_threshold),
        "feature_names": FEATURE_COLUMNS,
        "num_features": len(FEATURE_COLUMNS),
        "validation_metrics": val_metrics,
        "test_metrics": test_metrics,
        "system_environment": {
            "os": platform.platform(),
            "python_version": sys.version,
            "architecture": platform.machine()
        }
    }
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    logger.info("Training pipeline successfully finished!")
    return metadata

def _generate_figures(y_test: np.ndarray, test_probs: np.ndarray, threshold: float, fig_dir: Path) -> None:
    # 1. ROC Curve
    fpr, tpr, _ = roc_curve(y_test, test_probs)
    plt.figure(figsize=(7, 6))
    plt.plot(fpr, tpr, color="#2563eb", lw=2, label="ROC Curve")
    plt.plot([0, 1], [0, 1], color="#94a3b8", linestyle="--")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate (Recall)")
    plt.title("SecureOS Phishing Detection - ROC Curve")
    plt.legend(loc="lower right")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(fig_dir / "roc_curve.png", dpi=200)
    plt.close()

    # 2. Precision-Recall Curve
    precision, recall, _ = precision_recall_curve(y_test, test_probs)
    plt.figure(figsize=(7, 6))
    plt.plot(recall, precision, color="#059669", lw=2, label="Precision-Recall Curve")
    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.title("SecureOS Phishing Detection - Precision-Recall Curve")
    plt.legend(loc="lower left")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(fig_dir / "precision_recall_curve.png", dpi=200)
    plt.close()

    # 3. Confusion Matrix
    y_pred = (test_probs >= threshold).astype(int)
    cm = evaluate_predictions(y_test, test_probs, threshold)["confusion_matrix"]
    plt.figure(figsize=(6, 5))
    plt.imshow(cm, interpolation="nearest", cmap="Blues")
    plt.title(f"Confusion Matrix (Threshold = {threshold:.2f})")
    plt.colorbar()
    classes = ["Legitimate", "Malicious"]
    tick_marks = np.arange(len(classes))
    plt.xticks(tick_marks, classes)
    plt.yticks(tick_marks, classes)
    for i in range(2):
        for j in range(2):
            val = cm[i][j]
            color = "white" if val > np.max(cm)/2 else "black"
            plt.text(j, i, f"{val:,}", horizontalalignment="center", verticalalignment="center", color=color, fontweight="bold")
    plt.ylabel("True Label")
    plt.xlabel("Predicted Label")
    plt.tight_layout()
    plt.savefig(fig_dir / "confusion_matrix.png", dpi=200)
    plt.close()

def _save_reports(
    benchmark_results: Dict[str, Any],
    validation_info: Dict[str, Any],
    dup_info: Dict[str, Any],
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    val_metrics: Dict[str, Any],
    test_metrics: Dict[str, Any],
    optimal_threshold: float,
    threshold_history: list
) -> None:
    # 1. Model comparison table
    comparison_rows = []
    for name, res in benchmark_results.items():
        m = res["metrics"]
        comparison_rows.append({
            "Model": name,
            "Precision": f"{m['precision']:.4f}",
            "Recall": f"{m['recall']:.4f}",
            "F1-Score": f"{m['f1']:.4f}",
            "ROC-AUC": f"{m['roc_auc']:.4f}",
            "PR-AUC": f"{m['pr_auc']:.4f}",
            "FPR": f"{m['fpr']:.4f}",
            "FNR": f"{m['fnr']:.4f}",
            "Train Time (s)": m["training_time_seconds"],
            "Latency (ms/sample)": m["inference_latency_ms_per_sample"]
        })
    df_comp = pd.DataFrame(comparison_rows)
    df_comp.to_csv(COMPARISON_DIR / "model_comparison.csv", index=False)

    with open(COMPARISON_DIR / "model_comparison.json", "w") as f:
        json.dump(comparison_rows, f, indent=2)

    # 2. Test metrics json
    with open(METRICS_DIR / "test_evaluation_metrics.json", "w") as f:
        json.dump(test_metrics, f, indent=2)

    # 3. Validation metrics json
    with open(METRICS_DIR / "validation_evaluation_metrics.json", "w") as f:
        json.dump(val_metrics, f, indent=2)
