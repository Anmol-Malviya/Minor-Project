#!/usr/bin/env python3
"""Interactive Console Tool for SecureOS URL Phishing Detection Testing.

Allows real-time manual testing of arbitrary URLs from the terminal.
"""

import json
import sys
from pathlib import Path

# Set up project root in path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.inference.predictor import get_predictor
from src.features.url_feature_extractor import extract_features_from_url

# ANSI Colors for clean Apple terminal output
GREEN = "\033[92m"
RED = "\033[91m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

def display_result(result: dict, verbose: bool = False):
    is_phish = result["is_phishing"]
    color = RED if is_phish else GREEN
    tag = "[ MALICIOUS / BLOCK ]" if is_phish else "[ LEGITIMATE / ALLOW ]"

    print("\n" + "=" * 64)
    print(f"URL: {BOLD}{result['url']}{RESET}")
    print(f"Status: {color}{BOLD}{tag}{RESET}")
    print(f"Risk Score: {color}{result['risk_score']} / 100{RESET}")
    print(f"Model: {result['model_version']}")

    if result.get("indicators"):
        print(f"\n{BOLD}Threat Indicators Detected:{RESET}")
        for ind in result["indicators"]:
            print(f"  {RED}!{RESET} {ind}")
    else:
        print(f"\n{DIM}No suspicious threat indicators triggered.{RESET}")

    if verbose:
        print(f"\n{DIM}--- Extracted Features ---{RESET}")
        feats = extract_features_from_url(result["url"])
        for k, v in feats.items():
            print(f"  {DIM}{k:<26}: {v}{RESET}")

    print("=" * 64 + "\n")

def main():
    print(f"\n{BOLD}SecureOS Phishing Detection — Interactive Console Tester{RESET}")
    print(f"{DIM}Loading production model and schema...{RESET}")
    
    predictor = get_predictor()
    print(f"{GREEN}✓ Model ready!{RESET} (Threshold: {predictor.threshold:.2f}, Version: {predictor.metadata.get('model_version', 'secureos-v1')})")
    print(f"{DIM}Type any URL to test. Add '--features' at the end for feature breakdown. Type 'exit' or 'q' to quit.{RESET}\n")

    # If CLI arguments provided, test them directly and exit
    if len(sys.argv) > 1 and sys.argv[1] not in {"-i", "--interactive"}:
        target_url = sys.argv[1]
        verbose = "--features" in sys.argv
        res = predictor.predict_url(target_url)
        display_result(res, verbose=verbose)
        return

    # Interactive loop
    while True:
        try:
            user_input = input(f"{BOLD}Enter URL > {RESET}").strip()
            if not user_input:
                continue
            if user_input.lower() in {"exit", "quit", "q"}:
                print("\nExiting SecureOS tester. Stay safe!\n")
                break

            verbose = False
            if user_input.endswith("--features"):
                verbose = True
                user_input = user_input[:-10].strip()

            res = predictor.predict_url(user_input)
            display_result(res, verbose=verbose)

        except (KeyboardInterrupt, EOFError):
            print("\nExiting SecureOS tester.\n")
            break

if __name__ == "__main__":
    main()
