"""Final validation: run pipeline on all 3 images and write results."""
import sys, json
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except: pass

from preprocessing import preprocess
from haze_estimation import estimate_haze
from feature_extraction import extract_haze_features, features_to_vector
from psi_model import load_model, predict_psi, psi_category

model = load_model()

images = [
    ("sample_images/sample_clear.jpg",     "Clear_0.1"),
    ("sample_images/sample_urban.jpg",     "Medium_0.4"),
    ("sample_images/sample_heavy_haze.jpg","Heavy_0.8"),
]

all_results = []
for path, label in images:
    pp = preprocess(path)
    hz = estimate_haze(pp["processed_bgr"])
    ft = extract_haze_features(hz["haze_map"])
    fv = features_to_vector(ft)
    psi = predict_psi(model, fv)
    cat = psi_category(psi)
    entry = {"label": label, "psi": psi, "category": cat}
    entry.update(ft)
    all_results.append(entry)
    print(f"{label}: PSI={psi}, category={cat}, mean_haze={ft['mean_haze']}")

with open("output/validation.json", "w") as f:
    json.dump(all_results, f, indent=2)

# Validate ordering
psival = [r["psi"] for r in all_results]
if psival[0] < psival[1] < psival[2]:
    print("PASS: PSI increases with haze (clear < medium < heavy)")
else:
    print(f"WARN: Ordering issue: {psival}")
