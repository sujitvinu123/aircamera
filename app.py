"""
=============================================================================
AIRWANA — Camera-Based Air Pollution Estimation
=============================================================================
Streamlit Application — Jury Demo Ready (v2)

Upload any outdoor image → instantly receive haze analysis + approximate PSI.

Key features:
    - LIVE analysis on upload (no button click needed)
    - Clean, modern, professional UI
    - Three-column result layout
    - Explanation & limitations clearly stated

Usage:
    streamlit run app.py
=============================================================================
"""

import io
import sys
import time

import cv2
import numpy as np
import matplotlib
import matplotlib.pyplot as plt
import streamlit as st
from PIL import Image

# ---------------------------------------------------------------------------
# Windows encoding fix
# ---------------------------------------------------------------------------
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

matplotlib.use("Agg")

# ---------------------------------------------------------------------------
# Pipeline imports
# ---------------------------------------------------------------------------
from haze_estimation import (
    compute_dark_channel,
    estimate_atmospheric_light,
    compute_transmission_map,
    compute_haze_map,
)
from feature_extraction import extract_haze_features, features_to_vector
from psi_model import load_model, predict_psi, psi_category


# =====================================================================
# PAGE CONFIG
# =====================================================================
st.set_page_config(
    page_title="AIRWANA | Air Pollution Estimation",
    page_icon="🌫️",
    layout="wide",
    initial_sidebar_state="expanded",
)


# =====================================================================
# NGROK & MOBILE SUPPORT
# =====================================================================

@st.cache_resource
def start_secure_tunnel():
    """
    Setup ngrok tunnel with robust reuse and error handling.
    """
    try:
        from pyngrok import ngrok
        
        # 1. Set Auth Token
        ngrok.set_auth_token("39TbwEK7iCgDl85qha2qr3oY597_71xTZvYa7ZnXpXua2gG9m")
        
        # 2. Check for existing active tunnels to reuse (fastest)
        existing_tunnels = ngrok.get_tunnels()
        if existing_tunnels:
            url = existing_tunnels[0].public_url
            print(f" * Reusing existing tunnel: {url}")
            return url
            
        # 3. If no tunnel, start a new one
        url = ngrok.connect(addr="8501", proto="http", bind_tls=True).public_url
        print(f" * New tunnel established: {url}")
        return url
        
    except Exception as e:
        print(f" Tunnel Error: {e}")
        return None

# Initialize Tunnel
public_url = start_secure_tunnel()

if public_url:
    st.toast(f"Mobile Link Ready: {public_url}", icon="📱")
    with st.sidebar:
        st.markdown("### 📱 Mobile Access")
        st.success(f"**Public URL:**\n[{public_url}]({public_url})")
        st.caption("Scan or share this link to view on mobile.")



# =====================================================================
# CUSTOM CSS (Responsive & Mobile-Friendly)
# =====================================================================
st.markdown("""
<style>
/* ===== Google Font ===== */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

/* ===== Responsive Mobile Tweaks ===== */
@media only screen and (max-width: 768px) {
    .block-container {
        padding: 1rem 1rem 2rem 1rem !important;
        max-width: 100%;
    }
    .hero {
        padding: 1.5rem 1rem !important;
        margin-bottom: 1rem !important;
    }
    .hero h1 {
        font-size: 1.6rem !important;
    }
    .psi-value {
        font-size: 2.8rem !important;
    }
    .psi-card {
        min-height: auto !important;
        padding: 1.5rem 1rem !important;
    }
    /* Force single column stack for custom grids if necessary */
    .feat-grid {
        grid-template-columns: 1fr 1fr !important; /* Keep 2 cols for pills */
    }
    .explain-panel {
        margin-top: 1rem;
        border-radius: 12px !important;
        border-left: none !important;
        border-top: 4px solid #6366f1 !important;
    }
}

/* ===== Reset & Global ===== */
html, body, [class*="css"] {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}
#MainMenu, footer, header { visibility: hidden; }

.block-container {
    padding: 1.5rem 2rem 2rem 2rem;
    max-width: 1180px;
}

/* ===== Header Banner ===== */
.hero {
    text-align: center;
    padding: 2.2rem 1.5rem 1.6rem;
    margin-bottom: 1.8rem;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #334155 100%);
    border-radius: 18px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.18);
    position: relative;
    overflow: hidden;
}
.hero::before {
    content: '';
    position: absolute;
    top: -40%; left: -20%;
    width: 60%; height: 180%;
    background: radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%);
    pointer-events: none;
}
.hero h1 {
    color: #f8fafc;
    font-size: 2rem;
    font-weight: 800;
    margin: 0 0 0.35rem 0;
    letter-spacing: -0.4px;
    position: relative;
}
.hero .sub {
    color: #a5b4fc;
    font-size: 1rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
    position: relative;
}
.hero .tag {
    color: #94a3b8;
    font-size: 0.82rem;
    font-weight: 300;
    position: relative;
}

/* ===== Upload Prompt ===== */
.upload-prompt {
    text-align: center;
    color: #475569;
    font-size: 0.92rem;
    font-weight: 500;
    margin-bottom: 0.4rem;
}

/* ===== Section Title ===== */
.section-title {
    text-align: center;
    font-size: 1.15rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0.5rem 0 0.3rem 0;
}
.section-subtitle {
    text-align: center;
    font-size: 0.78rem;
    color: #94a3b8;
    margin-bottom: 1.2rem;
}

/* ===== Image Frame ===== */
.img-frame {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 0.6rem;
    box-shadow: 0 1px 6px rgba(0,0,0,0.04);
}
.img-frame img {
    border-radius: 10px;
    width: 100%;
}
.img-label {
    text-align: center;
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-top: 0.6rem;
    padding-bottom: 0.2rem;
}

/* ===== PSI Card ===== */
.psi-card {
    background: linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%);
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 1.8rem 1.2rem 1.4rem;
    text-align: center;
    box-shadow: 0 2px 12px rgba(0,0,0,0.05);
    min-height: 280px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}
.psi-label {
    color: #64748b;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    margin-bottom: 0.5rem;
}
.psi-value {
    font-size: 3.6rem;
    font-weight: 900;
    line-height: 1;
    margin-bottom: 0.15rem;
}
.psi-unit {
    color: #94a3b8;
    font-size: 0.72rem;
    font-weight: 500;
    margin-bottom: 0.9rem;
}

/* ===== Badge ===== */
.badge {
    display: inline-block;
    padding: 0.4rem 1.2rem;
    border-radius: 24px;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.3px;
}
.badge-good            { background: #dcfce7; color: #15803d; }
.badge-moderate        { background: #fef9c3; color: #a16207; }
.badge-unhealthy       { background: #ffedd5; color: #c2410c; }
.badge-very-unhealthy  { background: #fee2e2; color: #b91c1c; }
.badge-hazardous       { background: #f3e8ff; color: #7e22ce; }

.approx-note {
    color: #94a3b8;
    font-size: 0.7rem;
    font-weight: 500;
    margin-top: 0.8rem;
    font-style: italic;
}

/* ===== Feature Pills ===== */
.feat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-top: 1rem;
}
.feat-pill {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 0.55rem 0.7rem;
    text-align: center;
}
.feat-pill .fp-label {
    font-size: 0.62rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #94a3b8;
    margin-bottom: 0.15rem;
}
.feat-pill .fp-val {
    font-size: 0.95rem;
    font-weight: 800;
    color: #334155;
    font-family: 'Courier New', monospace;
}

/* ===== Divider ===== */
.divider { border: none; border-top: 1px solid #e2e8f0; margin: 1.8rem 0; }

/* ===== Explanation Panels ===== */
.explain-panel {
    background: #f8fafc;
    border-left: 4px solid #6366f1;
    border-radius: 0 14px 14px 0;
    padding: 1.3rem 1.5rem;
    font-size: 0.85rem;
    color: #334155;
    line-height: 1.7;
}
.explain-panel h4 {
    color: #1e293b;
    font-size: 0.95rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
}
.explain-panel ul {
    padding-left: 1.1rem;
    margin: 0.25rem 0 0.5rem 0;
}
.explain-panel li { margin-bottom: 0.2rem; }

/* ===== Disclaimer ===== */
.disclaimer-bar {
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 12px;
    padding: 0.85rem 1.2rem;
    font-size: 0.78rem;
    color: #92400e;
    text-align: center;
    margin-top: 1.5rem;
    line-height: 1.5;
}

/* ===== Processing Steps ===== */
.step-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.3rem 0;
    font-size: 0.85rem;
    color: #475569;
}
.step-done { color: #16a34a; font-weight: 600; }
.step-icon { font-size: 1rem; }

/* ===== Streamlit overrides ===== */
div[data-testid="stFileUploader"] > div { border-radius: 12px !important; }
button[kind="primary"] {
    background: linear-gradient(135deg, #6366f1, #4f46e5) !important;
    border: none !important;
    border-radius: 10px !important;
    font-weight: 600 !important;
    letter-spacing: 0.3px !important;
}
</style>
""", unsafe_allow_html=True)


# =====================================================================
# CACHED MODEL
# =====================================================================
@st.cache_resource
def get_model():
    """Load or train the PSI model (cached for the session lifetime)."""
    return load_model()


# =====================================================================
# HELPERS
# =====================================================================

def pil_to_bgr(pil_img: Image.Image) -> np.ndarray:
    """PIL Image -> OpenCV BGR array."""
    return cv2.cvtColor(np.array(pil_img.convert("RGB")), cv2.COLOR_RGB2BGR)


def render_haze_map(haze_map: np.ndarray) -> np.ndarray:
    """
    Render the haze map as a colour-mapped RGB image (no axes / chrome).
    Blue-Green = clear, Yellow-Red = hazy.
    """
    # Apply colourmap directly (avoids Matplotlib figure overhead)
    colormapped = plt.cm.jet(haze_map)[:, :, :3]  # Drop alpha
    return (colormapped * 255).astype(np.uint8)


def render_haze_map_with_bar(haze_map: np.ndarray) -> np.ndarray:
    """Render haze map with a colourbar as a complete figure."""
    h, w = haze_map.shape
    aspect = h / w
    fig_w = 5
    fig_h = fig_w * aspect
    fig, ax = plt.subplots(figsize=(fig_w, fig_h))
    im = ax.imshow(haze_map, cmap="jet", vmin=0.0, vmax=1.0)
    ax.axis("off")
    cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.03, shrink=0.85)
    cbar.ax.tick_params(labelsize=8)
    cbar.set_label("Haze Intensity", fontsize=9)
    fig.tight_layout(pad=0.3)

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, bbox_inches="tight",
                facecolor="white", edgecolor="none")
    plt.close(fig)
    buf.seek(0)
    return np.array(Image.open(buf))


def get_psi_color(cat: str) -> str:
    return {"Good": "#16a34a", "Moderate": "#ca8a04", "Unhealthy": "#ea580c",
            "Very Unhealthy": "#dc2626", "Hazardous": "#7c3aed"}.get(cat, "#ca8a04")


def get_badge_class(cat: str) -> str:
    return {"Good": "badge-good", "Moderate": "badge-moderate",
            "Unhealthy": "badge-unhealthy", "Very Unhealthy": "badge-very-unhealthy",
            "Hazardous": "badge-hazardous"}.get(cat, "badge-moderate")


# =====================================================================
# PIPELINE
# =====================================================================

def run_pipeline(pil_image: Image.Image) -> dict:
    """
    Full AIRWANA pipeline.

    Returns a dict with:
        original_rgb, haze_map, haze_vis, features, psi, category, elapsed
    """
    t0 = time.time()

    # --- Step 1: Preprocess ---
    bgr = pil_to_bgr(pil_image)
    h, w = bgr.shape[:2]
    scale = 640 / max(h, w)
    if scale < 1.0:
        bgr = cv2.resize(bgr, (int(w * scale), int(h * scale)),
                         interpolation=cv2.INTER_AREA)
    blurred = cv2.GaussianBlur(bgr, (3, 3), 0)
    original_rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

    # --- Step 2: Haze estimation ---
    dc = compute_dark_channel(blurred)
    atm = estimate_atmospheric_light(blurred, dc)
    trans = compute_transmission_map(blurred, atm)
    haze = compute_haze_map(trans)

    # --- Step 3: Features ---
    feats = extract_haze_features(haze)
    fvec = features_to_vector(feats)

    # --- Step 4: Predict ---
    model = get_model()
    psi = predict_psi(model, fvec)
    cat = psi_category(psi)

    # --- Step 5: Visualise ---
    haze_vis = render_haze_map_with_bar(haze)

    return {
        "original_rgb": original_rgb,
        "haze_map": haze,
        "haze_vis": haze_vis,
        "features": feats,
        "psi": psi,
        "category": cat,
        "elapsed": time.time() - t0,
    }


# =====================================================================
# MAIN UI
# =====================================================================

def main():
    # ───────────────── HEADER ─────────────────
    st.markdown("""
    <div class="hero">
        <h1>🌫️ Camera-Based Air Pollution Estimation</h1>
        <div class="sub">Using Atmospheric Haze Analysis</div>
        <div class="tag">Upload an outdoor image to estimate approximate air quality instantly</div>
    </div>
    """, unsafe_allow_html=True)

    # ───────────────── UPLOAD ─────────────────
    _, upload_col, _ = st.columns([1, 2, 1])
    with upload_col:
        st.markdown('<div class="upload-prompt">📷 Upload an outdoor image (road, buildings, skyline)</div>',
                    unsafe_allow_html=True)
        uploaded = st.file_uploader(
            "upload_image",
            type=["jpg", "jpeg", "png"],
            label_visibility="collapsed",
            help="JPG / PNG. Best with daytime outdoor scenes.",
        )

    # ───────────────── GUARD ─────────────────
    if uploaded is None:
        # Show a gentle prompt when no image is uploaded
        st.markdown("""
        <div style="text-align:center; padding:3rem 1rem; color:#94a3b8;">
            <div style="font-size:3rem; margin-bottom:0.5rem;">📸</div>
            <div style="font-size:0.95rem; font-weight:500;">
                Drag & drop or browse to upload an outdoor photo
            </div>
            <div style="font-size:0.8rem; margin-top:0.3rem;">
                The analysis will start automatically
            </div>
        </div>
        """, unsafe_allow_html=True)
        return

    # ───────────────── VALIDATE ─────────────────
    try:
        pil_image = Image.open(uploaded).convert("RGB")
    except Exception as e:
        st.error(f"Could not read the uploaded file: {e}")
        return

    # ───────────────── LIVE ANALYSIS ─────────────────
    st.markdown('<hr class="divider">', unsafe_allow_html=True)

    # Show processing feedback
    status = st.empty()
    status.markdown("""
    <div style="text-align:center; padding:1rem; color:#6366f1; font-weight:600;">
        ⏳ Analyzing atmospheric haze...
    </div>
    """, unsafe_allow_html=True)

    result = run_pipeline(pil_image)
    status.empty()

    # ───────────────── RESULTS HEADER ─────────────────
    st.markdown(f"""
    <div class="section-title">📊 Analysis Results</div>
    <div class="section-subtitle">Processed in {result['elapsed']:.2f}s</div>
    """, unsafe_allow_html=True)

    # ───────────────── THREE-COLUMN LAYOUT ─────────────────
    col1, col2, col3 = st.columns([1, 1, 1], gap="large")

    # --- Column 1: Original Image ---
    with col1:
        st.markdown('<div class="img-frame">', unsafe_allow_html=True)
        st.image(result["original_rgb"], width="stretch")
        st.markdown('</div>', unsafe_allow_html=True)
        st.markdown('<div class="img-label">📷 Uploaded Image</div>', unsafe_allow_html=True)

    # --- Column 2: Haze Map ---
    with col2:
        st.markdown('<div class="img-frame">', unsafe_allow_html=True)
        st.image(result["haze_vis"], width="stretch")
        st.markdown('</div>', unsafe_allow_html=True)
        st.markdown('<div class="img-label">🌫️ Haze / Visibility Map</div>', unsafe_allow_html=True)

    # --- Column 3: PSI & Features ---
    with col3:
        psi = result["psi"]
        cat = result["category"]
        feats = result["features"]
        color = get_psi_color(cat)
        badge = get_badge_class(cat)

        st.markdown(f"""
        <div class="psi-card">
            <div class="psi-label">Estimated PSI</div>
            <div class="psi-value" style="color:{color};">{psi:.0f}</div>
            <div class="psi-unit">Pollutant Standards Index</div>
            <span class="badge {badge}">{cat}</span>
            <div class="approx-note">~ Approximate estimate</div>
        </div>
        """, unsafe_allow_html=True)

        # Feature pills
        st.markdown(f"""
        <div class="feat-grid">
            <div class="feat-pill">
                <div class="fp-label">Mean Haze</div>
                <div class="fp-val">{feats['mean_haze']:.4f}</div>
            </div>
            <div class="feat-pill">
                <div class="fp-label">Variance</div>
                <div class="fp-val">{feats['haze_variance']:.5f}</div>
            </div>
            <div class="feat-pill">
                <div class="fp-label">Max Haze</div>
                <div class="fp-val">{feats['max_haze']:.4f}</div>
            </div>
            <div class="feat-pill">
                <div class="fp-label">Contrast</div>
                <div class="fp-val">{feats['contrast']:.4f}</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

    # ───────────────── EXPLANATION BOXES ─────────────────
    st.markdown('<hr class="divider">', unsafe_allow_html=True)

    ex1, ex2 = st.columns(2, gap="large")

    with ex1:
        st.markdown("""
        <div class="explain-panel">
            <h4>🔍 What does the Haze Map represent?</h4>
            <p>
                The haze map uses the <strong>Dark Channel Prior</strong> to estimate
                atmospheric scattering. When air contains particulate matter (PM2.5,
                PM10), light scatters more, washing out distant objects.
            </p>
            <ul>
                <li><strong>Blue / Green</strong> — Clear air, good visibility</li>
                <li><strong>Yellow / Orange</strong> — Moderate haze</li>
                <li><strong>Red</strong> — Dense haze, poor air quality</li>
            </ul>
            <p>
                PSI is estimated by a <strong>machine learning model</strong>
                mapping haze intensity to an approximate pollution index.
            </p>
        </div>
        """, unsafe_allow_html=True)

    with ex2:
        st.markdown("""
        <div class="explain-panel">
            <h4>⚠️ Why is PSI approximate?</h4>
            <ul>
                <li>Model trained on <strong>synthetic data</strong>, not real sensor readings</li>
                <li>Camera exposure & white balance affect haze estimation</li>
                <li>Dark Channel Prior assumes <strong>outdoor daytime</strong> scenes</li>
                <li>Real PSI depends on pollutant species — haze is one indicator</li>
            </ul>
            <h4 style="margin-top:0.8rem;">🚫 Known Limitations</h4>
            <ul>
                <li><strong>Night images</strong> — dark channel assumption fails</li>
                <li><strong>Fog / mist</strong> — indistinguishable from pollution</li>
                <li><strong>Indoor scenes</strong> — meaningless results</li>
                <li><strong>Overcast sky</strong> — may be misread as haze</li>
            </ul>
        </div>
        """, unsafe_allow_html=True)

    # ───────────────── DISCLAIMER ─────────────────
    st.markdown("""
    <div class="disclaimer-bar">
        ⚠️ <strong>Disclaimer:</strong>
        This is a <strong>camera-based supplementary sensor</strong>.
        It does <strong>not</strong> replace physical air quality monitors.
        PSI values are approximate. Real deployment requires ground-truth calibration.
    </div>
    """, unsafe_allow_html=True)

    # ───────────────── COLLAPSIBLE EXTRAS ─────────────────
    with st.expander("📋  PSI Scale Reference"):
        ref1, ref2 = st.columns([1, 2])
        with ref1:
            st.markdown("""
| PSI | Category |
|-----|----------|
| 0–50 | Good |
| 51–100 | Moderate |
| 101–200 | Unhealthy |
| 201–300 | Very Unhealthy |
| >300 | Hazardous |
""")
        with ref2:
            st.markdown("""
- **Good (0–50):** Satisfactory air quality.
- **Moderate (51–100):** Acceptable. Sensitive individuals should limit outdoor exertion.
- **Unhealthy (101–200):** Health effects possible for everyone.
- **Very Unhealthy (201–300):** Health warnings for sensitive groups.
- **Hazardous (>300):** Emergency conditions.
""")

    with st.expander("🔬  Technical Methodology"):
        st.markdown("""
### Pipeline

```
Image Upload  →  Resize + Blur  →  Dark Channel Prior  →  Atmospheric Light
                                         ↓
                                  Transmission Map t(x)
                                         ↓
                                  Haze Map  h(x) = 1 − t(x)
                                         ↓
                                  Feature Extraction [mean, var, max, contrast]
                                         ↓
                                  RandomForest Regressor  →  PSI Estimate
```

**References:**
- He, K., Sun, J., & Tang, X. (2009). *Single Image Haze Removal Using Dark Channel Prior.* IEEE TPAMI.
- Liu, C., et al. (2019). *AirTick: Air Quality Estimation from Outdoor Images.*
""")


# =====================================================================
if __name__ == "__main__":
    main()
