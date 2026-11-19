from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATASET_DIR = BASE_DIR / "Dataset"
MODELS_DIR = BASE_DIR / "models"
PRODUCTION_MODEL_DIR = MODELS_DIR / "production"
EXPERIMENTS_MODEL_DIR = MODELS_DIR / "experiments"
REPORTS_DIR = BASE_DIR / "reports"
METRICS_DIR = REPORTS_DIR / "metrics"
FIGURES_DIR = REPORTS_DIR / "figures"
COMPARISON_DIR = REPORTS_DIR / "model_comparison"

# Dataset file locations
DATASET_FILENAME = "PhiUSIIL_Phishing_URL_Dataset.csv"
PRIMARY_DATASET_PATH = DATASET_DIR / DATASET_FILENAME
FALLBACK_DATASET_PATHS = [
    Path("/Users/hritikjaiswal/Desktop/rd/SecureOS/Secureos/MLservice/Dataset") / DATASET_FILENAME,
    Path("/Users/hritikjaiswal/Desktop/rd/AV-SAFE/MLservice/Dataset") / DATASET_FILENAME,
]

# Random Seed for Reproducibility
RANDOM_SEED = 42

# Label Definitions
# In PhiUSIIL dataset: 1 = LEGITIMATE, 0 = PHISHING
LABEL_LEGITIMATE = 1
LABEL_PHISHING = 0

# Human-readable labels for inference
CLASS_NAMES = {
    LABEL_LEGITIMATE: "LEGITIMATE",
    LABEL_PHISHING: "MALICIOUS",
}

# Actions
ACTION_ALLOW = "ALLOW"
ACTION_BLOCK = "BLOCK"

# Model Version
MODEL_VERSION = "secureos-v1"

# Feature definitions
URL_MAX_LENGTH = 2048
