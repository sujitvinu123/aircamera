# AIRWANA — Camera-Based Air Pollution Estimation Module

## Overview

**AIRWANA** estimates approximate air pollution (PSI / PM2.5 proxy) from a single
outdoor RGB image using atmospheric haze and visibility analysis.

This module is inspired by research such as **AirTick** and the **Dark Channel
Prior** (He et al., 2009). It is a **research prototype** — accuracy is secondary
to pipeline clarity and explainability.

## How It Works

```
┌─────────────┐    ┌──────────────────┐    ┌──────────────┐    ┌──────────────┐
│  Input RGB   │───▶│  Haze Estimation │───▶│  Feature     │───▶│  ML Model    │
│  Image       │    │  (Dark Channel   │    │  Extraction  │    │  (PSI Est.)  │
│              │    │   Prior + ATM)   │    │              │    │              │
└─────────────┘    └──────────────────┘    └──────────────┘    └──────────────┘
                          │                       │                    │
                   Transmission Map         Haze Score           PSI Value
                   Visualization            (0.0–1.0)           (Approx.)
```

## Quick Start — Streamlit Demo (Recommended)

```bash
pip install -r requirements.txt
streamlit run app.py
```

Then open **http://localhost:8501** in your browser.

Upload any outdoor image (road, buildings, skyline) and click **Analyze Air Quality**.

## CLI Usage

```bash
# Run with any outdoor image
python main.py --image path/to/your/image.jpg

# Run with sample images (generate them first)
python generate_sample.py
python main.py --image sample_images/sample_urban.jpg
```

## Pipeline Steps

| Step | Module | Description |
|------|--------|-------------|
| **1. Preprocessing** | `preprocessing.py` | Resize, RGB conversion, Gaussian blur |
| **2. Haze Estimation** | `haze_estimation.py` | Dark Channel Prior → Atmospheric Light → Transmission Map |
| **3. Feature Extraction** | `feature_extraction.py` | Mean haze intensity, variance, contrast |
| **4. PSI Prediction** | `psi_model.py` | RandomForest regression on synthetic data |
| **5. Output** | `output_handler.py` / `app.py` | Visual results + explanation text |

## Project Structure

```
AIRWANA/
├── app.py                   # Streamlit frontend (jury-demo ready)
├── main.py                  # CLI entry point
├── preprocessing.py         # Step 1: Image preprocessing
├── haze_estimation.py       # Step 2: Dark Channel Prior + ATM
├── feature_extraction.py    # Step 3: Numeric haze features
├── psi_model.py             # Step 4: ML model (RandomForest)
├── output_handler.py        # Step 5: CLI output & visualizations
├── generate_sample.py       # Synthetic test image generator
├── run_tests.py             # Validation test suite
├── requirements.txt         # Python dependencies
├── models/                  # Saved ML model (.pkl)
├── sample_images/           # Generated test images
└── output/                  # CLI output images
```

## PSI Scale

| PSI Range | Category | Description |
|-----------|----------|-------------|
| 0 – 50 | Good | Air quality is satisfactory |
| 51 – 100 | Moderate | Acceptable; sensitive individuals should limit outdoor exertion |
| 101 – 200 | Unhealthy | Everyone may experience health effects |
| 201 – 300 | Very Unhealthy | Serious health effects for sensitive groups |
| > 300 | Hazardous | Emergency conditions |

## ⚠️ Disclaimer

This module is a **supplementary sensor prototype**. It does **NOT** replace
physical air quality monitoring instruments. PSI estimates are approximate and
based on synthetic training data. Real-world deployment requires calibration
against ground-truth sensor readings.

## Dependencies

- Python 3.8+
- OpenCV
- NumPy
- Matplotlib
- scikit-learn
- Streamlit
- Pillow

## References

- He, K., Sun, J., & Tang, X. (2009). *Single Image Haze Removal Using Dark Channel Prior.* IEEE TPAMI.
- Liu, C., et al. (2019). *AirTick: Air Quality Estimation from Outdoor Images.*
