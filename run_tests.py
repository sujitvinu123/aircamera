"""
=============================================================================
TEST RUNNER — Run the AIRWANA pipeline on all sample images
=============================================================================
Demonstrates the pipeline across three haze levels:
    - Clear (haze = 0.1)
    - Medium (haze = 0.4)
    - Heavy (haze = 0.8)

Usage:
    python run_tests.py
=============================================================================
"""

import sys
import os

# Windows encoding fix
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from main import run_pipeline


def main():
    test_images = [
        ("sample_images/sample_clear.jpg",      "CLEAR DAY (haze=0.1)"),
        ("sample_images/sample_urban.jpg",       "MEDIUM HAZE (haze=0.4)"),
        ("sample_images/sample_heavy_haze.jpg",  "HEAVY HAZE (haze=0.8)"),
    ]

    results = []

    for image_path, label in test_images:
        print("\n" + "#" * 70)
        print(f"  TEST: {label}")
        print("#" * 70)

        if not os.path.isfile(image_path):
            print(f"  [SKIP] Image not found: {image_path}")
            continue

        result = run_pipeline(image_path)
        results.append((label, result))

    # --- Comparison Summary ---
    print("\n\n")
    print("=" * 70)
    print("  COMPARISON SUMMARY")
    print("=" * 70)
    print(f"  {'Scene':<30s}  {'PSI':>7s}  {'Category':<18s}  {'Mean Haze':>10s}")
    print("  " + "-" * 66)

    for label, r in results:
        print(f"  {label:<30s}  {r['psi']:>7.1f}  {r['category']:<18s}  {r['features']['mean_haze']:>10.4f}")

    print("=" * 70)

    # --- Validation ---
    print("\n  VALIDATION:")
    if len(results) == 3:
        psi_clear = results[0][1]["psi"]
        psi_medium = results[1][1]["psi"]
        psi_heavy = results[2][1]["psi"]

        if psi_clear < psi_medium < psi_heavy:
            print("  [PASS] PSI increases with haze level (clear < medium < heavy)")
        else:
            print("  [WARN] PSI ordering unexpected -- check model calibration")
            print(f"         Clear={psi_clear}, Medium={psi_medium}, Heavy={psi_heavy}")

        haze_clear = results[0][1]["features"]["mean_haze"]
        haze_heavy = results[2][1]["features"]["mean_haze"]
        if haze_clear < haze_heavy:
            print("  [PASS] Mean haze increases with haze level")
        else:
            print("  [WARN] Mean haze ordering unexpected")
    else:
        print("  [SKIP] Not all 3 images found, cannot validate ordering")

    print("\n  All tests complete.\n")


if __name__ == "__main__":
    main()
