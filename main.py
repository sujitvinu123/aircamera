"""
=============================================================================
AIRWANA — Camera-Based Air Pollution Estimation Module
=============================================================================
Main entry point that orchestrates the full pipeline:

    Image → Preprocess → Haze Estimation → Feature Extraction → PSI Model → Output

Usage:
    python main.py --image path/to/outdoor_image.jpg

This module is a RESEARCH-INSPIRED PROTOTYPE.
Accuracy is secondary to pipeline clarity and explainability.
=============================================================================
"""

import os
import sys
import argparse
import time

# ---------------------------------------------------------------------------
# Windows console encoding fix — ensure UTF-8 output
# ---------------------------------------------------------------------------
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ---------------------------------------------------------------------------
# Pipeline modules (Steps 1-5)
# ---------------------------------------------------------------------------
from preprocessing import preprocess
from haze_estimation import estimate_haze
from feature_extraction import extract_haze_features, features_to_vector
from psi_model import load_model, predict_psi, psi_category, train_model
from output_handler import assemble_result


def print_banner():
    """Print a startup banner for clarity."""
    banner = """
    +===============================================================+
    |                                                               |
    |       A I R W A N A                                           |
    |                                                               |
    |   Camera-Based Air Pollution Estimation -- Part 1             |
    |   Research-Inspired Prototype                                 |
    +===============================================================+
    """
    print(banner)


def run_pipeline(image_path: str) -> dict:
    """
    Execute the full AIRWANA pipeline on a single image.

    Pipeline steps:
        1. Preprocess the input image.
        2. Estimate atmospheric haze using the Dark Channel Prior.
        3. Extract numeric haze features.
        4. Predict PSI using the trained ML model.
        5. Assemble and output results.

    Args:
        image_path: Path to the input outdoor RGB image.

    Returns:
        Dictionary containing all output artifacts (see output_handler.py).
    """
    # Ensure output directory exists
    os.makedirs("output", exist_ok=True)

    # ===================================================================
    # STEP 1: IMAGE PREPROCESSING
    # ===================================================================
    print("\n" + "=" * 60)
    print("  STEP 1: IMAGE PREPROCESSING")
    print("=" * 60)

    t0 = time.time()
    preprocessed = preprocess(image_path)
    t1 = time.time()

    h, w = preprocessed["original_bgr"].shape[:2]
    print(f"  [OK] Image loaded and resized to {w}x{h}")
    print(f"  [OK] Gaussian blur applied (noise reduction)")
    print(f"  [TIME] Preprocessing took {t1 - t0:.3f}s")

    # ===================================================================
    # STEP 2: ATMOSPHERIC HAZE ESTIMATION
    # ===================================================================
    print("\n" + "=" * 60)
    print("  STEP 2: ATMOSPHERIC HAZE ESTIMATION")
    print("=" * 60)

    t0 = time.time()
    haze_result = estimate_haze(preprocessed["processed_bgr"])
    t1 = time.time()

    atm_light = haze_result["atmospheric_light"]
    print(f"  [OK] Dark channel computed (patch size 15x15)")
    print(f"  [OK] Atmospheric light estimated: "
          f"R={atm_light[2]:.3f}  G={atm_light[1]:.3f}  B={atm_light[0]:.3f}")
    print(f"  [OK] Transmission map computed (omega = 0.95)")
    print(f"  [OK] Haze intensity map generated")
    print(f"  [OK] Haze map visualisation saved to output/haze_map.png")
    print(f"  [TIME] Haze estimation took {t1 - t0:.3f}s")

    # ===================================================================
    # STEP 3: NUMERIC HAZE FEATURE EXTRACTION
    # ===================================================================
    print("\n" + "=" * 60)
    print("  STEP 3: HAZE FEATURE EXTRACTION")
    print("=" * 60)

    features = extract_haze_features(haze_result["haze_map"])
    feature_vec = features_to_vector(features)

    print(f"  [OK] Mean haze intensity : {features['mean_haze']:.4f}")
    print(f"  [OK] Haze variance       : {features['haze_variance']:.6f}")
    print(f"  [OK] Max haze            : {features['max_haze']:.4f}")
    print(f"  [OK] Contrast (max-min)  : {features['contrast']:.4f}")

    # ===================================================================
    # STEP 4: PSI PREDICTION
    # ===================================================================
    print("\n" + "=" * 60)
    print("  STEP 4: PSI PREDICTION (ML Model)")
    print("=" * 60)

    model = load_model()
    psi = predict_psi(model, feature_vec)
    category = psi_category(psi)

    print(f"  [OK] Predicted PSI       : {psi:.1f}")
    print(f"  [OK] Air Quality Category: {category}")

    # ===================================================================
    # STEP 5: OUTPUT ASSEMBLY
    # ===================================================================
    print("\n" + "=" * 60)
    print("  STEP 5: OUTPUT ASSEMBLY")
    print("=" * 60)

    result = assemble_result(
        original_rgb=preprocessed["original_rgb"],
        haze_result=haze_result,
        features=features,
        psi=psi,
        category=category,
    )

    # Print explanation to console
    print(result["explanation"])

    print("  [OK] Summary image saved to output/result_summary.png")
    print("\n  Pipeline complete.\n")

    return result


# ===========================================================================
# CLI ENTRY POINT
# ===========================================================================
def main():
    """Parse CLI arguments and run the pipeline."""
    print_banner()

    parser = argparse.ArgumentParser(
        description="AIRWANA — Camera-Based Air Pollution Estimation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=("Example:\n"
                "  python main.py --image sample_images/sample_urban.jpg\n\n"
                "This module is a research prototype.\n"
                "It does NOT replace physical air quality sensors."),
    )
    parser.add_argument(
        "--image", "-i",
        required=True,
        help="Path to an outdoor RGB image (JPEG/PNG).",
    )
    parser.add_argument(
        "--retrain",
        action="store_true",
        help="Force re-training the PSI model on synthetic data.",
    )

    args = parser.parse_args()

    # Validate image path
    if not os.path.isfile(args.image):
        print(f"\n  [ERROR] Image file not found: {args.image}")
        sys.exit(1)

    # Optionally retrain
    if args.retrain:
        print("\n  [Re-training PSI model on synthetic data...]\n")
        train_model()

    # Run the full pipeline
    run_pipeline(args.image)


if __name__ == "__main__":
    main()
