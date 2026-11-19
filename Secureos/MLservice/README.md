# SecureOS — Production-Grade Phishing Detection ML Pipeline

Production-grade, leak-free machine learning training and inference pipeline for **SecureOS**, engineered to classify URLs into **LEGITIMATE** or **MALICIOUS** without executing live network requests or relying on inaccessible webpage DOM features.

---

## 1. Architecture & Design Principles

1. **Pure URL Feature Extraction**: Real-world URLs submitted from web interfaces or browser extensions cannot safely or immediately execute live web visits. SecureOS extracts 33 lexical, structural, statistical (Shannon entropy), and threat-indicative features purely from the URL string.
2. **Domain-Aware Split (Leakage Prevention)**: To prevent domain memorization, URLs from the same registrable domain (`domain.tld`) are strictly isolated within partitions using `GroupShuffleSplit` (70% Train, 15% Validation, 15% Test).
3. **Calibrated Probabilities & Threshold Optimization**: Platt sigmoid calibration via `CalibratedClassifierCV` is applied to ensure probabilities reflect true empirical risk. Decision thresholds are tuned on the validation set to heavily penalize False Positives (FPR $\le 0.03\%$).
4. **Binary Decision Engine**: Strictly outputs `LEGITIMATE` (`ALLOW`) or `MALICIOUS` (`BLOCK`), with 0-100 risk score and explainable threat indicators.

---

## 2. Directory Layout

```text
MLservice/
├── Dataset/
│   └── PhiUSIIL_Phishing_URL_Dataset.csv
├── src/
│   ├── config/
│   │   └── settings.py
│   ├── data/
│   │   ├── loader.py
│   │   ├── validation.py
│   │   └── preprocessing.py
│   ├── features/
│   │   ├── url_parser.py
│   │   ├── url_feature_extractor.py
│   │   └── feature_schema.py
│   ├── training/
│   │   ├── train.py
│   │   ├── compare_models.py
│   │   ├── evaluate.py
│   │   └── threshold_optimizer.py
│   ├── inference/
│   │   ├── predictor.py
│   │   └── risk_engine.py
│   ├── api/
│   │   └── main.py
│   └── utils/
│       ├── logger.py
│       └── reproducibility.py
├── models/
│   ├── production/
│   │   ├── secureos_phishing_model.joblib
│   │   ├── feature_schema.json
│   │   ├── model_metadata.json
│   │   └── threshold_config.json
│   └── experiments/
├── reports/
│   ├── metrics/
│   │   ├── test_evaluation_metrics.json
│   │   ├── validation_evaluation_metrics.json
│   │   └── feature_importance.json
│   ├── figures/
│   │   ├── roc_curve.png
│   │   ├── precision_recall_curve.png
│   │   └── confusion_matrix.png
│   └── model_comparison/
│       ├── model_comparison.csv
│       └── model_comparison.json
├── tests/
│   ├── test_data.py
│   ├── test_features.py
│   ├── test_predictor.py
│   └── test_api.py
├── scripts/
│   └── train_model.py
├── requirements.txt
├── pytest.ini
├── .gitignore
└── README.md
```

---

## 3. Dataset Attribution & Integrity

- **Dataset**: PhiUSIIL Phishing URL Dataset
- **Authors**: Prasad, A., & Chandra, S. (UCI Machine Learning Repository)
- **License**: Creative Commons Attribution 4.0 International ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/))
- **Total Records**: 235,795
- **Unique URLs**: 235,370 (425 exact duplicates pruned, 0 conflicting labels)
- **Original Dataset Labels**: `1 = LEGITIMATE` (134,850), `0 = PHISHING` (100,945)
- **Pipeline Binary Target Convention**: `1 = MALICIOUS (PHISHING)`, `0 = LEGITIMATE`
- **SHA-256 Checksum**: `a236549cd369cd80bd478ff8e1779cbf44c58d5c3f79f7a51a1adbed7d06d1c6`

---

## 4. Benchmark & Model Selection Results

Trained on 170,215 domain-grouped records across 4 algorithms:

| Model | Precision | Recall | F1-Score | ROC-AUC | PR-AUC | FPR | FNR | Train Time (s) | Latency (ms/sample) |
|---|---|---|---|---|---|---|---|---|---|
| **Logistic Regression (Baseline)** | 0.9989 | 0.9855 | 0.9922 | 0.9948 | 0.9958 | 0.0006 | 0.0145 | 0.13 | 0.0002 |
| **Random Forest** | 0.9980 | 0.9902 | 0.9941 | 0.9979 | 0.9981 | 0.0012 | 0.0098 | 1.53 | 0.0012 |
| **XGBoost** | 0.9978 | 0.9902 | 0.9940 | 0.9979 | 0.9980 | 0.0013 | 0.0098 | 0.57 | 0.0005 |
| **LightGBM (Champion)** | **0.9980** | **0.9903** | **0.9941** | **0.9980** | **0.9981** | **0.0012** | **0.0097** | **0.48** | **0.0012** |

### Held-Out Test Evaluation (32,928 Unseen URLs)
With probability calibration and optimized threshold ($0.78$):

- **Phishing Recall**: `99.12%` (Caught 12,698 of 12,811 phishing attacks)
- **False Positive Rate**: `0.01%` (Only 3 legitimate false alarms out of 20,117 legitimate URLs)
- **Precision**: `99.98%`
- **F1-Score**: `99.55%`
- **ROC-AUC**: `0.9981`
- **Brier Score Loss**: `0.0031`

---

## 5. Quickstart & Commands

### 1. Environment Setup
```bash
cd MLservice

python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Run Automated Tests
```bash
pytest -v
```

### 3. Reproduce Training Pipeline
```bash
# Full dataset training
python scripts/train_model.py

# Or quick sample verification (e.g. 10k rows)
python scripts/train_model.py --sample-limit 10000
```

### 4. Start the FastAPI Inference Service
```bash
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Query the Prediction API
```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"url": "http://192.168.1.50:8080/secure-update/login.php"}'
```

**Response**:
```json
{
  "url": "http://192.168.1.50:8080/secure-update/login.php",
  "classification": "MALICIOUS",
  "is_phishing": true,
  "risk_score": 100.0,
  "model_version": "secureos-v1",
  "indicators": [
    "IP-address-based hostname detected (bypassing DNS domain identity)",
    "Credential harvesting / login authentication keyword in URL path",
    "Excessive dot count in URL structure",
    "Insecure plain HTTP connection soliciting login actions"
  ],
  "action": "BLOCK"
}
```

---

## 6. Model Limitations

1. **Shortened URLs**: Bit.ly, TinyURL, and similar redirection links obscure target lexical features until expanded.
2. **Compromised Legitimate Subdomains**: Legitimate multi-tenant hosts (e.g., Google Sites, GitHub Pages, Firebase) hosting phishing pages may evade purely lexical checks if the URL mimics legitimate structure.
3. **Evolving Evasion**: Attackers utilizing novel TLDs or sophisticated homoglyphs should be periodically incorporated through continuous pipeline retraining.
