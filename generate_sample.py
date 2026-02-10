"""
=============================================================================
SAMPLE IMAGE GENERATOR
=============================================================================
Purpose:
    Generate a synthetic outdoor urban scene image for testing the
    pipeline when no real photograph is available.

    The generated image simulates:
        - A gradient sky (blue above, hazy near horizon)
        - Simple building silhouettes
        - A road surface
        - Controllable haze level for testing

    This is NOT meant to be realistic — it is a FUNCTIONAL test image
    that produces valid pipeline outputs.

Usage:
    python generate_sample.py               # Default medium haze
    python generate_sample.py --haze 0.8    # Heavy haze
    python generate_sample.py --haze 0.1    # Clear day
=============================================================================
"""

import os
import argparse

import cv2
import numpy as np


def generate_urban_scene(width: int = 640,
                         height: int = 480,
                         haze_level: float = 0.4) -> np.ndarray:
    """
    Generate a synthetic urban scene with controllable haze.

    The scene has three regions:
        1. Sky (top 40%)   — blue-to-white gradient
        2. Buildings (mid) — dark rectangular silhouettes
        3. Road (bottom)   — grey surface

    Haze is simulated by blending the scene toward a white "atmospheric
    light" proportional to the haze_level parameter.

    Args:
        width:      Image width in pixels.
        height:     Image height in pixels.
        haze_level: Float in [0, 1].  0 = perfectly clear, 1 = whiteout.

    Returns:
        Synthetic image as a BGR uint8 NumPy array.
    """
    # Create base canvas
    canvas = np.zeros((height, width, 3), dtype=np.float64)

    # ----- Sky (top 40%) -----
    sky_end = int(height * 0.40)
    for y in range(sky_end):
        # Gradient: deep blue at top → lighter blue at horizon
        ratio = y / sky_end
        r = 135 + 100 * ratio   # Red increases toward horizon
        g = 180 + 60 * ratio    # Green increases
        b = 235                 # Blue stays high
        canvas[y, :] = [b, g, r]  # BGR

    # ----- Buildings (40% – 75%) -----
    building_start = sky_end
    building_end = int(height * 0.75)

    # Background (lighter buildings in distance)
    canvas[building_start:building_end, :] = [160, 160, 160]

    # Draw several building silhouettes
    rng = np.random.RandomState(123)
    num_buildings = 8
    building_width_range = (width // 12, width // 6)
    gap = width // (num_buildings + 2)

    for i in range(num_buildings):
        bw = rng.randint(*building_width_range)
        bh = rng.randint(int(height * 0.15), int(height * 0.35))
        bx = gap * (i + 1) + rng.randint(-20, 20)
        bx = max(0, min(bx, width - bw))
        by = building_end - bh

        # Building colour — darker shades of grey/brown
        shade = rng.randint(50, 120)
        colour = [shade, shade + rng.randint(-10, 10), shade + rng.randint(-5, 15)]
        cv2.rectangle(canvas, (bx, by), (bx + bw, building_end), colour, -1)

        # Simple windows (small bright rectangles)
        win_size = 6
        for wy in range(by + 8, building_end - 8, 14):
            for wx in range(bx + 6, bx + bw - 6, 12):
                if rng.random() > 0.3:  # Some windows are dark
                    win_colour = [180, 200, 220]
                    cv2.rectangle(canvas, (wx, wy),
                                  (wx + win_size, wy + win_size),
                                  win_colour, -1)

    # ----- Road (bottom 25%) -----
    road_start = building_end
    canvas[road_start:, :] = [90, 90, 95]  # Dark grey

    # Road markings
    for x in range(0, width, 60):
        cv2.rectangle(canvas, (x, height - 20),
                      (x + 30, height - 16), [200, 200, 200], -1)

    # ----- Apply haze -----
    # Haze = blend toward atmospheric light (white-ish)
    # This simulates the Koschmieder model:  I(x) = J(x)*t + A*(1-t)
    atm_light = np.array([235, 235, 240], dtype=np.float64)

    # Apply mostly uniform haze with a slight depth gradient.
    # The depth gradient is intentionally weak so that the dominant
    # signal is the overall haze_level, not the spatial variation.
    for y in range(height):
        # Mild depth factor: ranges from 1.0 (top/far) to 0.85 (bottom/near)
        depth_factor = 1.0 - (y / height) * 0.15
        t = 1.0 - haze_level * depth_factor
        t = max(t, 0.05)  # Never fully opaque
        canvas[y] = canvas[y] * t + atm_light * (1 - t)

    # Clamp and convert to uint8
    canvas = np.clip(canvas, 0, 255).astype(np.uint8)

    return canvas


def main():
    parser = argparse.ArgumentParser(
        description="Generate a synthetic urban scene for AIRWANA testing."
    )
    parser.add_argument(
        "--haze", type=float, default=0.4,
        help="Haze level: 0.0 (clear) to 1.0 (whiteout). Default: 0.4"
    )
    parser.add_argument(
        "--output", type=str, default="sample_images/sample_urban.jpg",
        help="Output image path."
    )
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.output), exist_ok=True)

    print(f"Generating synthetic urban scene (haze = {args.haze})...")
    image = generate_urban_scene(haze_level=args.haze)
    cv2.imwrite(args.output, image)
    print(f"Saved to {args.output}")

    # Also generate a clear and heavy-haze variant for comparison
    clear = generate_urban_scene(haze_level=0.1)
    cv2.imwrite("sample_images/sample_clear.jpg", clear)
    print("Saved sample_images/sample_clear.jpg (haze=0.1)")

    heavy = generate_urban_scene(haze_level=0.8)
    cv2.imwrite("sample_images/sample_heavy_haze.jpg", heavy)
    print("Saved sample_images/sample_heavy_haze.jpg (haze=0.8)")


if __name__ == "__main__":
    main()
