"""
=============================================================================
STEP 1: IMAGE PREPROCESSING
=============================================================================
Purpose:
    Prepare an input outdoor RGB image for downstream haze analysis.

Operations:
    1. Load the image from disk.
    2. Resize to a manageable resolution (preserving aspect ratio).
    3. Ensure the image is in RGB colour space.
    4. Apply a light Gaussian blur to suppress sensor noise.

Design Notes:
    - We resize to a maximum dimension of 640px. This keeps computation
      fast while retaining enough spatial detail for haze estimation.
    - The Gaussian blur kernel is intentionally small (3×3) so that we
      reduce noise without smearing the edges that the Dark Channel
      Prior relies on.
=============================================================================
"""

import cv2
import numpy as np


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_DIMENSION = 640        # Maximum width or height after resizing
BLUR_KERNEL_SIZE = (3, 3)  # Small kernel — noise reduction without edge loss


def load_image(image_path: str) -> np.ndarray:
    """
    Load an image from the filesystem.

    Args:
        image_path: Absolute or relative path to the image file.

    Returns:
        The image as a NumPy array in BGR colour space (OpenCV default).

    Raises:
        FileNotFoundError: If the image cannot be read from disk.
    """
    image = cv2.imread(image_path)
    if image is None:
        raise FileNotFoundError(
            f"Could not load image at '{image_path}'. "
            "Please check the path and file format."
        )
    return image


def resize_image(image: np.ndarray, max_dim: int = MAX_DIMENSION) -> np.ndarray:
    """
    Resize the image so that its largest dimension equals `max_dim`,
    preserving the original aspect ratio.

    Why resize?
        - The Dark Channel Prior requires a sliding-window minimum
          operation which is O(N) in pixel count.  Keeping images
          small makes the pipeline interactive.
        - For a *proxy* estimator, ultra-high resolution adds noise
          rather than useful signal.

    Args:
        image:   Input image (BGR, uint8).
        max_dim: Target for the largest dimension (default 640).

    Returns:
        Resized image (BGR, uint8).
    """
    h, w = image.shape[:2]
    scale = max_dim / max(h, w)

    # Only downscale — never upscale a small image
    if scale >= 1.0:
        return image.copy()

    new_w = int(w * scale)
    new_h = int(h * scale)

    # INTER_AREA is best for downsampling (avoids aliasing)
    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return resized


def ensure_rgb(image_bgr: np.ndarray) -> np.ndarray:
    """
    Convert a BGR image (OpenCV default) to RGB.

    Many visualisation libraries (Matplotlib) expect RGB ordering.
    We keep both representations available in the pipeline.

    Args:
        image_bgr: Image in BGR colour space.

    Returns:
        Image in RGB colour space.
    """
    return cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)


def apply_gaussian_blur(image: np.ndarray,
                        kernel_size: tuple = BLUR_KERNEL_SIZE) -> np.ndarray:
    """
    Apply a light Gaussian blur to reduce high-frequency sensor noise.

    A 3×3 kernel is deliberately chosen:
        - Large enough to smooth out JPEG artefacts and sensor noise.
        - Small enough to preserve the edge structure needed by the
          Dark Channel Prior's patch-wise minimum operation.

    Args:
        image:       Input image (any colour space).
        kernel_size: Gaussian kernel dimensions (default 3×3).

    Returns:
        Blurred image.
    """
    return cv2.GaussianBlur(image, kernel_size, sigmaX=0)


def preprocess(image_path: str) -> dict:
    """
    Full preprocessing pipeline.

    Args:
        image_path: Path to the input image.

    Returns:
        Dictionary with the following keys:
            - 'original_bgr' : Original image after resizing (BGR).
            - 'original_rgb' : Same image in RGB (for Matplotlib).
            - 'processed_bgr': Blurred image in BGR (for OpenCV ops).
            - 'processed_rgb': Blurred image in RGB (for display).
    """
    # Step 1a: Load from disk
    raw = load_image(image_path)

    # Step 1b: Resize to manageable size
    resized = resize_image(raw)

    # Step 1c: Light Gaussian blur
    blurred = apply_gaussian_blur(resized)

    # Step 1d: Prepare RGB copies for visualisation
    original_rgb = ensure_rgb(resized)
    processed_rgb = ensure_rgb(blurred)

    return {
        "original_bgr": resized,
        "original_rgb": original_rgb,
        "processed_bgr": blurred,
        "processed_rgb": processed_rgb,
    }
