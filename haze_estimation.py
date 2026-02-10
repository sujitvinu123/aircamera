"""
=============================================================================
STEP 2: ATMOSPHERIC HAZE ESTIMATION
=============================================================================
Purpose:
    Estimate how much atmospheric haze / scattering is present in an
    outdoor image.  This is the CORE of the air-pollution proxy.

Theory (simplified):
    The Koschmieder model describes image formation in haze:

        I(x) = J(x) · t(x) + A · (1 − t(x))

    where:
        I(x) = observed image (what the camera captures)
        J(x) = scene radiance (the "clean" image)
        t(x) = transmission map — fraction of light that reaches
                the camera without being scattered
        A    = atmospheric light — the colour / intensity of the
                ambient haze

    Key insight for air quality:
        - **Low t(x)  →  heavy haze  →  worse air quality**
        - **High t(x) →  clear air   →  better air quality**

    We therefore invert t(x) to get a HAZE INTENSITY MAP:
        haze(x) = 1 − t(x)

    where haze(x) ∈ [0, 1].  A value near 1 means dense haze.

Pipeline:
    1. Compute the Dark Channel of the image.
    2. Estimate the atmospheric light A from the dark channel.
    3. Compute the transmission map t(x).
    4. Derive the haze intensity map  h(x) = 1 − t(x).
    5. Visualise using a blue-to-red colour map.

References:
    He, K., Sun, J., & Tang, X. (2009).
    "Single Image Haze Removal Using Dark Channel Prior."
    IEEE TPAMI, 33(12), 2341–2353.
=============================================================================
"""

import cv2
import numpy as np
import matplotlib
import matplotlib.pyplot as plt

# Use non-interactive backend so the module works headlessly
matplotlib.use("Agg")


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
PATCH_SIZE = 15    # Window size for the dark channel (must be odd)
OMEGA = 0.95      # Fraction of haze to remove (0.95 = keep a little for
                   # depth perception — standard in the literature)
TOP_PERCENT = 0.1  # Top 0.1% brightest pixels used to estimate atm. light


# ===========================================================================
# 2a. DARK CHANNEL COMPUTATION
# ===========================================================================
def compute_dark_channel(image_bgr: np.ndarray,
                         patch_size: int = PATCH_SIZE) -> np.ndarray:
    """
    Compute the Dark Channel of an image.

    Definition:
        For each pixel x, the dark channel is the MINIMUM intensity
        across all three colour channels (B, G, R) in a local patch
        centred at x:

            J_dark(x) = min_{y ∈ Ω(x)} ( min_{c ∈ {R,G,B}} J_c(y) )

    Why this works:
        In haze-free outdoor images, at least one colour channel tends
        to have a very low intensity in most patches (shadows, colourful
        objects, dark surfaces).  Haze adds a global "whitish" veil that
        RAISES these minimum values.  Therefore, a high dark-channel
        value correlates with heavy haze.

    Args:
        image_bgr:  Input image in BGR, uint8.
        patch_size: Side length of the square patch (default 15).

    Returns:
        Dark channel image (single-channel, float64, range [0, 1]).
    """
    # Normalise to [0, 1] for numerical stability
    img = image_bgr.astype(np.float64) / 255.0

    # Step A: Per-pixel minimum across colour channels
    # For each pixel, take the smallest of (B, G, R)
    channel_min = np.min(img, axis=2)

    # Step B: Local patch minimum using morphological erosion
    # Erosion with a rectangular kernel computes the sliding-window min
    kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT, (patch_size, patch_size)
    )
    dark_channel = cv2.erode(channel_min, kernel)

    return dark_channel


# ===========================================================================
# 2b. ATMOSPHERIC LIGHT ESTIMATION
# ===========================================================================
def estimate_atmospheric_light(image_bgr: np.ndarray,
                               dark_channel: np.ndarray,
                               top_percent: float = TOP_PERCENT) -> np.ndarray:
    """
    Estimate the global atmospheric light vector A = [A_b, A_g, A_r].

    Method:
        1. Pick the top `top_percent` brightest pixels in the dark channel.
           These pixels are most likely to be in the densest haze region
           (or the sky).
        2. Among these pixels, select the one with the highest intensity
           in the *original* image.  Its colour is our estimate of A.

    Why not just pick the brightest pixel?
        A single maximum is sensitive to specular highlights (car
        headlights, reflections).  Selecting from the top 0.1% of the
        dark channel is more robust.

    Args:
        image_bgr:   Input image (BGR, uint8).
        dark_channel: Dark channel (float64, [0, 1]).
        top_percent:  Fraction of pixels to consider (default 0.001).

    Returns:
        Atmospheric light as a 1-D NumPy array of shape (3,), float64,
        with values in [0, 1].
    """
    img = image_bgr.astype(np.float64) / 255.0
    h, w = dark_channel.shape
    num_pixels = h * w

    # Number of candidate pixels
    num_top = max(int(num_pixels * top_percent), 1)

    # Flatten and find indices of the brightest dark-channel pixels
    flat_dc = dark_channel.ravel()
    indices = np.argsort(flat_dc)[-num_top:]  # largest values last

    # Among candidates, find the pixel with highest total intensity
    flat_img = img.reshape(-1, 3)
    intensities = np.sum(flat_img[indices], axis=1)
    best = indices[np.argmax(intensities)]

    atmospheric_light = flat_img[best]
    return atmospheric_light


# ===========================================================================
# 2c. TRANSMISSION MAP
# ===========================================================================
def compute_transmission_map(image_bgr: np.ndarray,
                             atmospheric_light: np.ndarray,
                             patch_size: int = PATCH_SIZE,
                             omega: float = OMEGA) -> np.ndarray:
    """
    Compute the transmission map t(x).

    Derivation:
        Dividing the haze model  I(x) = J(x)·t(x) + A·(1−t(x))
        by A channel-wise and taking the dark channel of both sides,
        we get (under the assumption that J is haze-free):

            t(x) ≈ 1 − ω · dark_channel( I(x) / A )

        where ω < 1 keeps a small amount of haze for natural appearance.

    Args:
        image_bgr:        Input image (BGR, uint8).
        atmospheric_light: Estimated atmospheric light (shape (3,)).
        patch_size:        Patch size for dark channel (default 15).
        omega:             Haze retention factor (default 0.95).

    Returns:
        Transmission map t(x), float64, range roughly [0, 1].
        - Values near 1.0 → clear  (light travels unimpeded).
        - Values near 0.0 → heavy haze (most light scattered away).
    """
    img = image_bgr.astype(np.float64) / 255.0

    # Normalise each channel by the atmospheric light
    # This effectively asks: "How much of the observed intensity
    # is attributable to haze vs. the scene?"
    normalised = img / (atmospheric_light + 1e-8)

    # Compute the dark channel of the normalised image
    dc_norm = compute_dark_channel(
        (normalised * 255).astype(np.uint8).clip(0, 255),
        patch_size
    )
    # Re-normalise since we passed uint8
    dc_norm = dc_norm.astype(np.float64)

    # Transmission estimate
    transmission = 1.0 - omega * dc_norm

    # Clamp to valid range
    transmission = np.clip(transmission, 0.01, 1.0)

    return transmission


# ===========================================================================
# 2d. HAZE INTENSITY MAP
# ===========================================================================
def compute_haze_map(transmission: np.ndarray) -> np.ndarray:
    """
    Invert the transmission map to obtain a haze intensity map.

        haze(x) = 1 − t(x)

    Interpretation:
        - haze(x) ≈ 0  →  clear air at pixel x
        - haze(x) ≈ 1  →  dense haze at pixel x

    This is the primary signal from which we extract pollution features.

    Args:
        transmission: Transmission map t(x), float64, [0, 1].

    Returns:
        Haze intensity map, float64, [0, 1].
    """
    return 1.0 - transmission


# ===========================================================================
# 2e. VISUALISATION
# ===========================================================================
def visualise_haze_map(haze_map: np.ndarray,
                       output_path: str = "output/haze_map.png") -> np.ndarray:
    """
    Render the haze map as a colour-mapped image:
        Blue  = clear air (low haze)
        Red   = dense haze (high haze)

    Uses Matplotlib's 'jet' colormap for intuitive hot/cold encoding.

    Args:
        haze_map:    Haze intensity map (float64, [0, 1]).
        output_path: Where to save the visualisation.

    Returns:
        Colour-mapped image as an RGB uint8 NumPy array (for embedding).
    """
    fig, ax = plt.subplots(1, 1, figsize=(6, 5))
    im = ax.imshow(haze_map, cmap="jet", vmin=0.0, vmax=1.0)
    ax.set_title("Haze Intensity Map\n(Blue = Clear · Red = Hazy)", fontsize=11)
    ax.axis("off")
    cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("Haze Intensity", fontsize=10)
    fig.tight_layout()
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)

    # Also return an RGB array for compositing later
    colormapped = (plt.cm.jet(haze_map)[:, :, :3] * 255).astype(np.uint8)
    return colormapped


# ===========================================================================
# PUBLIC API
# ===========================================================================
def estimate_haze(image_bgr: np.ndarray) -> dict:
    """
    Full haze estimation pipeline.

    Args:
        image_bgr: Preprocessed image in BGR, uint8.

    Returns:
        Dictionary with:
            - 'dark_channel'      : Dark channel image (float64)
            - 'atmospheric_light' : Estimated A (shape (3,))
            - 'transmission_map'  : t(x) (float64)
            - 'haze_map'          : 1 − t(x) (float64)
            - 'haze_map_rgb'      : Colormapped visualisation (uint8 RGB)
    """
    # 2a — Dark Channel
    dark_channel = compute_dark_channel(image_bgr)

    # 2b — Atmospheric Light
    atmospheric_light = estimate_atmospheric_light(image_bgr, dark_channel)

    # 2c — Transmission Map
    transmission = compute_transmission_map(image_bgr, atmospheric_light)

    # 2d — Haze Map (inverted transmission)
    haze_map = compute_haze_map(transmission)

    # 2e — Visualisation
    haze_rgb = visualise_haze_map(haze_map)

    return {
        "dark_channel": dark_channel,
        "atmospheric_light": atmospheric_light,
        "transmission_map": transmission,
        "haze_map": haze_map,
        "haze_map_rgb": haze_rgb,
    }
