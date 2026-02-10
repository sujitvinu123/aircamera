"""
=============================================================================
STEP 5: OUTPUT — RESULT ASSEMBLY & EXPLANATION
=============================================================================
Purpose:
    Assemble the final output of the pipeline:
        1. Original image (for visual reference)
        2. Haze / transmission map image
        3. Approximate PSI value
        4. Explanation text (what it means, limitations, caveats)

    Also generates a composite summary image saved to disk.

Design Notes:
    The explanation text is CRITICAL for responsible deployment.
    We must clearly communicate:
        - What the haze score represents physically.
        - Why the PSI estimate is only *approximate*.
        - Known limitations (night images, fog ≠ pollution, etc.).
=============================================================================
"""

import os
import textwrap

import numpy as np
import matplotlib
import matplotlib.pyplot as plt

matplotlib.use("Agg")


# ---------------------------------------------------------------------------
# Explanation Text
# ---------------------------------------------------------------------------
EXPLANATION_TEMPLATE = textwrap.dedent("""\
+========================================================================+
|                     AIRWANA -- RESULT EXPLANATION                      |
+========================================================================+
|                                                                        |
|  Estimated PSI:        {psi:>6.1f}                                     |
|  Air Quality Category: {category:<20s}                                 |
|  Mean Haze Score:      {mean_haze:>6.4f}  (0 = clear, 1 = dense)      |
|                                                                        |
+========================================================================+
|                                                                        |
|  WHAT THE HAZE SCORE REPRESENTS                                        |
|  -----------------------------------                                   |
|  The haze score is derived from the Dark Channel Prior, a computer     |
|  vision technique that estimates atmospheric scattering in outdoor     |
|  images.  When air contains more particulate matter (PM2.5, PM10),     |
|  light is scattered more, making distant objects appear washed-out.    |
|  The haze map quantifies this scattering per pixel.                    |
|                                                                        |
|  WHY THE PSI VALUE IS APPROXIMATE                                      |
|  -----------------------------------                                   |
|  * The regression model is trained on SYNTHETIC data, not real         |
|    sensor-paired observations.                                         |
|  * Camera settings (exposure, white balance) affect haze estimation.   |
|  * The Dark Channel Prior assumes outdoor, daylight scenes.            |
|  * Real PSI depends on pollutant species; haze is only one indicator.  |
|                                                                        |
|  KNOWN LIMITATIONS                                                     |
|  -----------------------------------                                   |
|  * Night-time images -- dark channel assumption breaks down.           |
|  * Natural fog / mist -- indistinguishable from pollution haze.        |
|  * Indoor images -- meaningless results.                               |
|  * Overcast sky -- may be misinterpreted as haze.                      |
|  * Close-up scenes without sky -- insufficient depth for estimation.   |
|                                                                        |
|  [!] This module is a SUPPLEMENTARY SENSOR.                            |
|      It does NOT replace physical air quality monitoring instruments.   |
|                                                                        |
+========================================================================+
""")


def generate_explanation(psi: float, category: str,
                         mean_haze: float) -> str:
    """
    Produce a human-readable explanation of the estimation result.

    Args:
        psi:       Predicted PSI value.
        category:  Air quality category string.
        mean_haze: Mean haze intensity from feature extraction.

    Returns:
        Formatted multi-line string.
    """
    return EXPLANATION_TEMPLATE.format(
        psi=psi,
        category=category,
        mean_haze=mean_haze,
    )


def save_summary_image(original_rgb: np.ndarray,
                       haze_map: np.ndarray,
                       psi: float,
                       category: str,
                       features: dict,
                       output_path: str = "output/result_summary.png"):
    """
    Create and save a side-by-side summary image:
        Left  — Original input image
        Right — Haze intensity map (colormapped)
        Bottom — Key metrics and PSI estimate

    Args:
        original_rgb: Original image in RGB (uint8).
        haze_map:     Haze intensity map (float64, [0, 1]).
        psi:          Predicted PSI value.
        category:     Air quality category.
        features:     Feature dict from feature_extraction.
        output_path:  File path to save the composite image.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    fig, axes = plt.subplots(1, 2, figsize=(14, 6))

    # --- Left panel: Original image ---
    axes[0].imshow(original_rgb)
    axes[0].set_title("Original Image", fontsize=13, fontweight="bold")
    axes[0].axis("off")

    # --- Right panel: Haze map ---
    im = axes[1].imshow(haze_map, cmap="jet", vmin=0.0, vmax=1.0)
    axes[1].set_title("Haze Intensity Map\n(Blue = Clear · Red = Hazy)",
                      fontsize=13, fontweight="bold")
    axes[1].axis("off")
    cbar = fig.colorbar(im, ax=axes[1], fraction=0.046, pad=0.04)
    cbar.set_label("Haze Intensity", fontsize=10)

    # --- Bottom text block ---
    # Choose colour based on severity
    psi_colours = {
        "Good": "#2ecc71",
        "Moderate": "#f1c40f",
        "Unhealthy": "#e67e22",
        "Very Unhealthy": "#e74c3c",
        "Hazardous": "#8e44ad",
    }
    colour = psi_colours.get(category, "#ffffff")

    info_text = (
        f"Estimated PSI: {psi:.1f}  |  "
        f"Category: {category}  |  "
        f"Mean Haze: {features['mean_haze']:.4f}  |  "
        f"Variance: {features['haze_variance']:.6f}  |  "
        f"Contrast: {features['contrast']:.4f}"
    )
    fig.text(0.5, 0.02, info_text, ha="center", fontsize=11,
             fontweight="bold", color=colour,
             bbox=dict(boxstyle="round,pad=0.5", facecolor="#1a1a2e",
                       edgecolor=colour, alpha=0.9))

    fig.suptitle("AIRWANA — Camera-Based Air Pollution Estimation",
                 fontsize=15, fontweight="bold", y=0.98)
    fig.tight_layout(rect=[0, 0.06, 1, 0.95])
    fig.savefig(output_path, dpi=150, bbox_inches="tight",
                facecolor="#0f0f1a", edgecolor="none")
    plt.close(fig)
    print(f"[Output] Summary image saved to {output_path}")


def assemble_result(original_rgb: np.ndarray,
                    haze_result: dict,
                    features: dict,
                    psi: float,
                    category: str) -> dict:
    """
    Assemble the complete output package.

    Args:
        original_rgb: Original image (RGB, uint8).
        haze_result:  Dictionary from haze_estimation.estimate_haze().
        features:     Dictionary from feature_extraction.extract_haze_features().
        psi:          Predicted PSI float.
        category:     Air quality category string.

    Returns:
        Dictionary containing all output artifacts.
    """
    explanation = generate_explanation(psi, category, features["mean_haze"])

    # Save composite visualisation
    save_summary_image(
        original_rgb=original_rgb,
        haze_map=haze_result["haze_map"],
        psi=psi,
        category=category,
        features=features,
    )

    return {
        "original_image": original_rgb,
        "haze_map": haze_result["haze_map"],
        "haze_map_rgb": haze_result["haze_map_rgb"],
        "psi": psi,
        "category": category,
        "features": features,
        "explanation": explanation,
    }
