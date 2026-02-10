/**
 * ═══════════════════════════════════════════════════════════════
 * AIRSSP — Camera Perception Module
 * ═══════════════════════════════════════════════════════════════
 * Integrates the Streamlit project's camera-based air pollution
 * estimation directly into the AIRSSP interface.
 * 
 * Pipeline (from haze_estimation.py → feature_extraction.py → psi_model.py):
 *   1. Upload outdoor RGB image
 *   2. Dark Channel Prior → Transmission Map → Haze Map
 *   3. Extract features: mean_haze, variance, max_haze, contrast
 *   4. Estimate PSI via learned mapping
 *   5. Display results in command-interface style
 * 
 * NOTE: The actual Dark Channel Prior runs in JavaScript here,
 * faithfully ported from the Python haze_estimation.py
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useRef, useCallback } from 'react';

// ── Dark Channel Prior (from haze_estimation.py) ──
function computeDarkChannel(imageData, width, height, patchSize = 15) {
    const halfPatch = Math.floor(patchSize / 2);
    const darkChannel = new Float32Array(width * height);

    // Step A: per-pixel minimum across RGB channels
    const channelMin = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
        const r = imageData[i * 4] / 255;
        const g = imageData[i * 4 + 1] / 255;
        const b = imageData[i * 4 + 2] / 255;
        channelMin[i] = Math.min(r, g, b);
    }

    // Step B: local patch minimum (erosion)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let minVal = 1.0;
            for (let dy = -halfPatch; dy <= halfPatch; dy++) {
                for (let dx = -halfPatch; dx <= halfPatch; dx++) {
                    const ny = Math.max(0, Math.min(height - 1, y + dy));
                    const nx = Math.max(0, Math.min(width - 1, x + dx));
                    minVal = Math.min(minVal, channelMin[ny * width + nx]);
                }
            }
            darkChannel[y * width + x] = minVal;
        }
    }

    return darkChannel;
}

// ── Atmospheric Light Estimation (from haze_estimation.py) ──
function estimateAtmosphericLight(imageData, darkChannel, width, height) {
    const numPixels = width * height;
    const topPercent = 0.001;
    const numTop = Math.max(1, Math.floor(numPixels * topPercent));

    // Find indices of brightest dark channel pixels
    const indexed = Array.from(darkChannel).map((v, i) => ({ v, i }));
    indexed.sort((a, b) => b.v - a.v);
    const candidates = indexed.slice(0, numTop);

    // Among candidates, find pixel with highest total intensity
    let bestIdx = candidates[0].i;
    let bestSum = 0;
    for (const c of candidates) {
        const sum = imageData[c.i * 4] + imageData[c.i * 4 + 1] + imageData[c.i * 4 + 2];
        if (sum > bestSum) {
            bestSum = sum;
            bestIdx = c.i;
        }
    }

    return [
        imageData[bestIdx * 4] / 255,
        imageData[bestIdx * 4 + 1] / 255,
        imageData[bestIdx * 4 + 2] / 255,
    ];
}

// ── Transmission Map (from haze_estimation.py) ──
function computeTransmissionMap(imageData, atmLight, width, height, omega = 0.95, patchSize = 15) {
    // Normalize by atmospheric light
    const normalized = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        normalized[i * 4] = Math.min(255, (imageData[i * 4] / 255 / (atmLight[0] + 1e-8)) * 255);
        normalized[i * 4 + 1] = Math.min(255, (imageData[i * 4 + 1] / 255 / (atmLight[1] + 1e-8)) * 255);
        normalized[i * 4 + 2] = Math.min(255, (imageData[i * 4 + 2] / 255 / (atmLight[2] + 1e-8)) * 255);
        normalized[i * 4 + 3] = 255;
    }

    const dcNorm = computeDarkChannel(normalized, width, height, patchSize);

    const transmission = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
        transmission[i] = Math.max(0.01, Math.min(1.0, 1.0 - omega * dcNorm[i]));
    }

    return transmission;
}

// ── Haze Map (from haze_estimation.py) ──
function computeHazeMap(transmission) {
    return transmission.map(t => 1.0 - t);
}

// ── Feature Extraction (from feature_extraction.py) ──
function extractHazeFeatures(hazeMap) {
    const n = hazeMap.length;
    let sum = 0, maxVal = 0, minVal = 1;
    for (let i = 0; i < n; i++) {
        sum += hazeMap[i];
        if (hazeMap[i] > maxVal) maxVal = hazeMap[i];
        if (hazeMap[i] < minVal) minVal = hazeMap[i];
    }
    const mean = sum / n;

    let varSum = 0;
    for (let i = 0; i < n; i++) {
        varSum += (hazeMap[i] - mean) ** 2;
    }
    const variance = varSum / n;

    return {
        mean_haze: Math.round(mean * 10000) / 10000,
        haze_variance: Math.round(variance * 1000000) / 1000000,
        max_haze: Math.round(maxVal * 10000) / 10000,
        contrast: Math.round((maxVal - minVal) * 10000) / 10000,
    };
}

// ── PSI Prediction (from psi_model.py synthetic mapping) ──
function predictPSI(features) {
    const { mean_haze, haze_variance, max_haze, contrast } = features;

    // Faithful port of the synthetic data formula from psi_model.py
    let psi = (
        350 * Math.pow(mean_haze, 1.2) +
        50 * max_haze -
        10 * contrast -
        5 * haze_variance * 100
    );

    psi = Math.max(0, Math.min(500, psi));
    return Math.round(psi * 10) / 10;
}

function psiCategory(psi) {
    if (psi <= 50) return { label: 'Good', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
    if (psi <= 100) return { label: 'Moderate', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' };
    if (psi <= 200) return { label: 'Unhealthy', color: '#f97316', bg: 'rgba(249,115,22,0.12)' };
    if (psi <= 300) return { label: 'Very Unhealthy', color: '#fb7185', bg: 'rgba(251,113,133,0.12)' };
    return { label: 'Hazardous', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
}

// ── Render haze map to canvas with jet colormap ──
function renderHazeMapToDataURL(hazeMap, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);

    for (let i = 0; i < width * height; i++) {
        const v = hazeMap[i]; // 0-1
        // Jet colormap approximation
        let r, g, b;
        if (v < 0.25) {
            r = 0; g = Math.round(v * 4 * 255); b = 255;
        } else if (v < 0.5) {
            r = 0; g = 255; b = Math.round((1 - (v - 0.25) * 4) * 255);
        } else if (v < 0.75) {
            r = Math.round((v - 0.5) * 4 * 255); g = 255; b = 0;
        } else {
            r = 255; g = Math.round((1 - (v - 0.75) * 4) * 255); b = 0;
        }
        imgData.data[i * 4] = r;
        imgData.data[i * 4 + 1] = g;
        imgData.data[i * 4 + 2] = b;
        imgData.data[i * 4 + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
}

// ── Main Component ──
export default function CameraPerception() {
    const [imageURL, setImageURL] = useState(null);
    const [hazeMapURL, setHazeMapURL] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [processing, setProcessing] = useState(false);
    const fileInputRef = useRef(null);
    const canvasRef = useRef(null);

    const processImage = useCallback((file) => {
        setProcessing(true);
        setAnalysis(null);
        setHazeMapURL(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            const url = e.target.result;
            setImageURL(url);

            const img = new Image();
            img.onload = () => {
                // Resize to max 320px for performance (matching Streamlit's 640 / 2)
                const maxDim = 320;
                const scale = maxDim / Math.max(img.width, img.height);
                const w = Math.round(img.width * (scale < 1 ? scale : 1));
                const h = Math.round(img.height * (scale < 1 ? scale : 1));

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const imageData = ctx.getImageData(0, 0, w, h).data;

                const t0 = performance.now();

                // Run the pipeline (ported from haze_estimation.py)
                const darkChannel = computeDarkChannel(imageData, w, h, 15);
                const atmLight = estimateAtmosphericLight(imageData, darkChannel, w, h);
                const transmission = computeTransmissionMap(imageData, atmLight, w, h);
                const hazeMap = computeHazeMap(transmission);
                const features = extractHazeFeatures(hazeMap);
                const psi = predictPSI(features);
                const category = psiCategory(psi);
                const elapsed = ((performance.now() - t0) / 1000).toFixed(2);

                // Render haze visualization
                const hazeURL = renderHazeMapToDataURL(hazeMap, w, h);
                setHazeMapURL(hazeURL);

                setAnalysis({ features, psi, category, elapsed });
                setProcessing(false);
            };
            img.src = url;
        };
        reader.readAsDataURL(file);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        const files = e.dataTransfer?.files;
        if (files && files[0]) processImage(files[0]);
    }, [processImage]);

    const handleFileChange = useCallback((e) => {
        if (e.target.files && e.target.files[0]) {
            processImage(e.target.files[0]);
        }
    }, [processImage]);

    return (
        <div className="panel-section">
            <div className="panel-title">Camera Perception</div>

            {/* Upload Zone */}
            {!imageURL && !processing && (
                <div
                    className="upload-zone"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    id="image-upload-zone"
                >
                    <div className="upload-icon">📷</div>
                    <div className="upload-text">Upload outdoor image</div>
                    <div className="upload-hint">JPG / PNG · Daytime scenes best</div>
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                className="upload-input"
                onChange={handleFileChange}
                id="image-file-input"
            />

            {/* Processing Indicator */}
            {processing && (
                <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: 'var(--accent-emerald)',
                    letterSpacing: '1px',
                }}>
                    ⏳ ANALYZING ATMOSPHERIC HAZE...
                </div>
            )}

            {/* Analysis Results */}
            {analysis && imageURL && (
                <div className="analysis-result">
                    {/* Image Pair */}
                    <div className="analysis-image-pair">
                        <div className="analysis-img-container">
                            <img src={imageURL} alt="Original" />
                            <div className="analysis-img-label">Original</div>
                        </div>
                        <div className="analysis-img-container">
                            <img src={hazeMapURL} alt="Haze Map" />
                            <div className="analysis-img-label">Haze Map</div>
                        </div>
                    </div>

                    {/* PSI Result */}
                    <div className="psi-display">
                        <div>
                            <div className="psi-label">Estimated PSI</div>
                            <div className="psi-value" style={{ color: analysis.category.color }}>
                                {analysis.psi}
                            </div>
                        </div>
                        <div>
                            <span
                                className="psi-category-badge"
                                style={{
                                    background: analysis.category.bg,
                                    color: analysis.category.color,
                                    border: `1px solid ${analysis.category.color}30`,
                                }}
                            >
                                {analysis.category.label}
                            </span>
                            <div style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '8px',
                                color: 'var(--text-muted)',
                                marginTop: '4px',
                                textAlign: 'right',
                            }}>
                                {analysis.elapsed}s
                            </div>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="features-grid">
                        <div className="feature-cell">
                            <div className="feature-cell-label">Mean Haze</div>
                            <div className="feature-cell-val">{analysis.features.mean_haze}</div>
                        </div>
                        <div className="feature-cell">
                            <div className="feature-cell-label">Variance</div>
                            <div className="feature-cell-val">{analysis.features.haze_variance}</div>
                        </div>
                        <div className="feature-cell">
                            <div className="feature-cell-label">Max Haze</div>
                            <div className="feature-cell-val">{analysis.features.max_haze}</div>
                        </div>
                        <div className="feature-cell">
                            <div className="feature-cell-label">Contrast</div>
                            <div className="feature-cell-val">{analysis.features.contrast}</div>
                        </div>
                    </div>

                    {/* Re-upload */}
                    <button
                        style={{
                            width: '100%',
                            padding: '8px',
                            background: 'transparent',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '6px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '9px',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            letterSpacing: '1px',
                            transition: 'all 0.2s',
                        }}
                        onClick={() => {
                            setImageURL(null);
                            setHazeMapURL(null);
                            setAnalysis(null);
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.borderColor = 'var(--accent-emerald)';
                            e.target.style.color = 'var(--accent-emerald)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.borderColor = 'var(--border-subtle)';
                            e.target.style.color = 'var(--text-secondary)';
                        }}
                        id="reanalyze-btn"
                    >
                        ANALYZE ANOTHER IMAGE
                    </button>

                    {/* Disclaimer */}
                    <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '8px',
                        color: 'var(--text-muted)',
                        lineHeight: '1.5',
                        padding: '6px 0',
                        borderTop: '1px solid var(--border-subtle)',
                    }}>
                        ⚠ Camera-based supplementary sensor. Does not replace physical monitors.
                        PSI approximate — synthetic training data.
                    </div>
                </div>
            )}
        </div>
    );
}
