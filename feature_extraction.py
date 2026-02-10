"""
=============================================================================
STEP 3: NUMERIC HAZE FEATURE EXTRACTION
=============================================================================
Purpose:
    Convert the 2-D haze intensity map (from Step 2) into a compact set
    of numeric features that can be fed to a regression model.

Features computed:
    ┌────────────────────┬────────────────────────────────────────────┐
    │ Feature            │ Meaning                                    │
    ├────────────────────┼────────────────────────────────────────────┤
    │ mean_haze          │ Average haze across the entire image.      │
    │                    │ Higher → more uniformly hazy.              │
    ├────────────────────┼────────────────────────────────────────────┤
    │ haze_variance      │ Spatial variation in haze.  Low variance   │
    │                    │ + high mean  → uniform thick haze.         │
    │                    │ High variance → patchy haze or mixed scene.│
    ├────────────────────┼────────────────────────────────────────────┤
    │ max_haze           │ Peak haze value — worst-case region.       │
    ├────────────────────┼────────────────────────────────────────────┤
    │ contrast           │ max − min.  Indicates depth range visible  │
    │                    │ in the scene.  Low contrast → whiteout.    │
    └────────────────────┴────────────────────────────────────────────┘

Design Notes:
    - We intentionally keep the feature set SMALL.  With synthetic
      training data a large feature set would just overfit.
    - The primary feature for PSI regression is `mean_haze`.  The
      auxiliary features provide richer signal if real calibration
      data becomes available later.
=============================================================================
"""

import numpy as np


def extract_haze_features(haze_map: np.ndarray) -> dict:
    """
    Extract numeric haze descriptors from the haze intensity map.

    Args:
        haze_map: 2-D float64 array with values in [0, 1].
                  Output of `haze_estimation.compute_haze_map()`.

    Returns:
        Dictionary of named features (all float values).
    """
    # -----------------------------------------------------------------------
    # Feature 1: MEAN HAZE INTENSITY
    # -----------------------------------------------------------------------
    # The single most informative feature.  Represents the average
    # fraction of light scattered by the atmosphere across the image.
    mean_haze = float(np.mean(haze_map))

    # -----------------------------------------------------------------------
    # Feature 2: HAZE VARIANCE
    # -----------------------------------------------------------------------
    # Quantifies spatial uniformity.
    # Uniform haze (e.g., heavy smog) → low variance.
    # Patchy haze (e.g., partial cloud cover) → high variance.
    haze_variance = float(np.var(haze_map))

    # -----------------------------------------------------------------------
    # Feature 3: MAXIMUM HAZE
    # -----------------------------------------------------------------------
    # Captures the densest haze region — useful for worst-case estimation.
    max_haze = float(np.max(haze_map))

    # -----------------------------------------------------------------------
    # Feature 4: CONTRAST (max − min)
    # -----------------------------------------------------------------------
    # If contrast is very low AND mean is high, the scene is a near-
    # total whiteout — very poor air quality.
    contrast = float(np.max(haze_map) - np.min(haze_map))

    features = {
        "mean_haze": round(mean_haze, 4),
        "haze_variance": round(haze_variance, 6),
        "max_haze": round(max_haze, 4),
        "contrast": round(contrast, 4),
    }

    return features


def features_to_vector(features: dict) -> np.ndarray:
    """
    Convert the feature dictionary to a 1-D NumPy array in a fixed
    order, suitable for scikit-learn model input.

    Order: [mean_haze, haze_variance, max_haze, contrast]

    Args:
        features: Output of `extract_haze_features()`.

    Returns:
        NumPy array of shape (4,).
    """
    return np.array([
        features["mean_haze"],
        features["haze_variance"],
        features["max_haze"],
        features["contrast"],
    ])
