import argparse
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.training.train import run_training_pipeline
from src.utils.logger import get_logger

logger = get_logger("scripts.train_model")

def main():
    parser = argparse.ArgumentParser(description="SecureOS Phishing Detection ML Training Script")
    parser.add_argument(
        "--dataset",
        type=str,
        default=None,
        help="Optional path to PhiUSIIL CSV dataset"
    )
    parser.add_argument(
        "--sample-limit",
        type=int,
        default=None,
        help="Optional row limit for quick testing (e.g. 50000)"
    )

    args = parser.parse_args()

    logger.info("Initializing SecureOS Production ML Training...")
    metadata = run_training_pipeline(
        custom_dataset_path=args.dataset,
        sample_limit=args.sample_limit
    )

    logger.info(f"Training completed successfully! Artifact version: {metadata['model_version']}")

if __name__ == "__main__":
    main()
