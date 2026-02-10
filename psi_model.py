"""
=============================================================================
STEP 4: ML MODEL FOR PSI ESTIMATION
=============================================================================
Purpose:
    Map haze features (from Step 3) to an approximate PSI value using a
    simple regression model.

Model choice — RandomForestRegressor:
    - Handles non-linear relationships between haze features and PSI.
    - Robust to feature scale differences (no normalisation needed).
    - Fast to train and evaluate on small datasets.
    - Easy to inspect (feature importances).

Training data:
    We generate SYNTHETIC / MOCK data because we do not have paired
    (image, ground-truth PSI) datasets.  The synthetic mapping is:

        PSI ≈ f(mean_haze, variance, max_haze, contrast)

    The function f is designed to be *plausible* but NOT scientifically
    calibrated.  In a real deployment you would replace this with actual
    sensor-paired observations.

PSI scale used (Singapore-style, simplified):
    ┌──────────┬──────────────────┐
    │  PSI     │  Air Quality     │
    ├──────────┼──────────────────┤
    │  0 – 50  │  Good            │
    │  51–100  │  Moderate        │
    │ 101–200  │  Unhealthy       │
    │ 201–300  │  Very Unhealthy  │
    │   > 300  │  Hazardous       │
    └──────────┴──────────────────┘

⚠️  DISCLAIMER:
    This model is trained on SYNTHETIC data.  It does NOT provide
    real-world-accurate PSI readings.  It is a proof-of-concept
    demonstrating the pipeline from image → haze → air-quality proxy.
=============================================================================
"""

import os
import pickle

import numpy as np
from sklearn.ensemble import RandomForestRegressor

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MODEL_PATH = "models/psi_model.pkl"          # Saved model path
SYNTHETIC_SAMPLES = 500                       # Number of training samples
RANDOM_SEED = 42                              # Reproducibility


# ===========================================================================
# 4a. SYNTHETIC DATA GENERATION
# ===========================================================================
def generate_synthetic_data(n_samples: int = SYNTHETIC_SAMPLES,
                            seed: int = RANDOM_SEED) -> tuple:
    """
    Generate synthetic (haze features → PSI) training data.

    The mapping is designed to be *physically plausible*:
        - Higher mean haze → higher PSI
        - Higher variance → slightly lower PSI (patchy haze is less
          severe than uniform dense haze)
        - Higher max haze → higher PSI
        - Lower contrast → higher PSI (whiteout conditions)

    The exact coefficients are HAND-TUNED for demonstration.  Replace
    this function with real paired data for production use.

    Args:
        n_samples: Number of synthetic observations.
        seed:      Random seed for reproducibility.

    Returns:
        (X, y) where:
            X : np.ndarray of shape (n_samples, 4) — features
            y : np.ndarray of shape (n_samples,) — PSI values
    """
    rng = np.random.RandomState(seed)

    # -----------------------------------------------------------------------
    # Generate random haze feature vectors
    # -----------------------------------------------------------------------
    # mean_haze ∈ [0.05, 0.85]  (very clear to very hazy)
    mean_haze = rng.uniform(0.05, 0.85, n_samples)

    # variance ∈ [0.001, 0.08]  (correlated with mean — denser haze
    #                             tends to be more uniform → lower var)
    haze_variance = rng.uniform(0.001, 0.08, n_samples) * (1 - 0.5 * mean_haze)

    # max_haze ∈ [mean_haze, 1.0]  (always ≥ mean)
    max_haze = mean_haze + rng.uniform(0.05, 0.20, n_samples)
    max_haze = np.clip(max_haze, 0.0, 1.0)

    # contrast ∈ [0.1, 0.9]  (inversely related to mean haze)
    contrast = rng.uniform(0.1, 0.9, n_samples) * (1.2 - mean_haze)
    contrast = np.clip(contrast, 0.0, 1.0)

    # -----------------------------------------------------------------------
    # Compute synthetic PSI target
    # -----------------------------------------------------------------------
    # Base PSI driven primarily by mean haze (non-linear — exponential-ish)
    # mean_haze is the dominant driver.  Other features provide secondary
    # corrections but must NOT override the primary signal.
    psi = (
        350 * mean_haze ** 1.2           # Primary driver (dominant)
        + 50 * max_haze                   # Boost from peak haze
        - 10 * contrast                   # Minor penalty for clear regions
        - 5 * haze_variance * 100         # Slight penalty for patchiness
        + rng.normal(0, 8, n_samples)     # Gaussian noise (sensor error)
    )

    # Clamp PSI to a realistic range [0, 500]
    psi = np.clip(psi, 0, 500)

    # Assemble feature matrix
    X = np.column_stack([mean_haze, haze_variance, max_haze, contrast])

    return X, psi


# ===========================================================================
# 4b. MODEL TRAINING
# ===========================================================================
def train_model(X: np.ndarray = None, y: np.ndarray = None,
                save: bool = True) -> RandomForestRegressor:
    """
    Train a RandomForestRegressor on (haze features → PSI).

    If no data is provided, synthetic data is generated automatically.

    The model is intentionally SIMPLE:
        - 100 trees (enough for a smooth prediction surface)
        - max_depth = 10  (prevents overfitting on 500 samples)
        - min_samples_leaf = 5

    Args:
        X:    Feature matrix (n_samples, 4).  If None, uses synthetic data.
        y:    Target PSI values (n_samples,). If None, uses synthetic data.
        save: Whether to save the trained model to disk.

    Returns:
        Trained RandomForestRegressor instance.
    """
    if X is None or y is None:
        print("[PSI Model] No real data provided — generating synthetic data.")
        X, y = generate_synthetic_data()

    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=10,
        min_samples_leaf=5,
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )

    model.fit(X, y)

    # Report training performance (R² score on training set)
    train_score = model.score(X, y)
    print(f"[PSI Model] Training R² score: {train_score:.4f}")

    # Feature importance
    feature_names = ["mean_haze", "haze_variance", "max_haze", "contrast"]
    importances = model.feature_importances_
    print("[PSI Model] Feature importances:")
    for name, imp in sorted(zip(feature_names, importances),
                            key=lambda x: -x[1]):
        print(f"    {name:18s} : {imp:.4f}")

    # Save model
    if save:
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(model, f)
        print(f"[PSI Model] Saved to {MODEL_PATH}")

    return model


# ===========================================================================
# 4c. MODEL LOADING
# ===========================================================================
def load_model() -> RandomForestRegressor:
    """
    Load a previously trained model from disk.

    If no saved model exists, trains a new one on synthetic data.

    Returns:
        Trained RandomForestRegressor instance.
    """
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        print(f"[PSI Model] Loaded from {MODEL_PATH}")
        return model
    else:
        print(f"[PSI Model] No saved model found — training new model.")
        return train_model()


# ===========================================================================
# 4d. PREDICTION
# ===========================================================================
def predict_psi(model: RandomForestRegressor,
                feature_vector: np.ndarray) -> float:
    """
    Predict the PSI value from a haze feature vector.

    Args:
        model:          Trained regressor.
        feature_vector: 1-D array of shape (4,) —
                        [mean_haze, haze_variance, max_haze, contrast].

    Returns:
        Predicted PSI value (float, clamped to [0, 500]).
    """
    # Reshape for single-sample prediction
    X = feature_vector.reshape(1, -1)
    psi = model.predict(X)[0]

    # Clamp to valid range
    psi = float(np.clip(psi, 0, 500))
    return round(psi, 1)


def psi_category(psi: float) -> str:
    """
    Map a numeric PSI value to a human-readable air quality category.

    Args:
        psi: Predicted PSI value.

    Returns:
        Category string.
    """
    if psi <= 50:
        return "Good"
    elif psi <= 100:
        return "Moderate"
    elif psi <= 200:
        return "Unhealthy"
    elif psi <= 300:
        return "Very Unhealthy"
    else:
        return "Hazardous"
