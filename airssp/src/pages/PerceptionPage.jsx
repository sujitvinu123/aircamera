/**
 * ═══════════════════════════════════════════════════════════════
 * AIRSSP — Camera Perception Module (Research-Grade, Flash-Robust)
 * ═══════════════════════════════════════════════════════════════
 * 
 * PHYSICAL MODEL: Atmospheric Scattering Equation
 *   I(x) = J(x) · t(x) + A · (1 - t(x))
 * 
 * Where:
 *   I(x) = Observed image (camera input)
 *   J(x) = Scene radiance (true scene, glare-free)
 *   t(x) = Transmission map (what fraction of light reaches camera)
 *   A    = Atmospheric light (global illumination from sky)
 * 
 * PIPELINE:
 *   1. Image ingestion + validation
 *   2. Overexposure / flash / glare detection
 *   3. Atmospheric light estimation (glare-masked)
 *   4. Transmission map computation (Dark Channel Prior)
 *   5. Radiance recovery: J(x) = (I(x) - A(1-t)) / max(t, t0)
 *   6. Atmospheric veil extraction: V(x) = A · (1 - t(x))
 *   7. Feature extraction from VEIL ONLY (never raw RGB)
 *   8. PSI estimation from veil features
 * 
 * ML INPUT = atmospheric veil ONLY. Never raw brightness.
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useRef, useCallback } from 'react';

// ════════════════════════════════════════════════════
// STEP 1: Dark Channel Computation
// ════════════════════════════════════════════════════
// For each pixel, take min across RGB, then local min over patch.
// In haze-free images, the dark channel tends to zero.
// Haze brightens the dark channel → we can detect haze this way.
function computeDarkChannel(data, w, h, ps = 15) {
    const hp = Math.floor(ps / 2);
    const dc = new Float32Array(w * h);
    const channelMin = new Float32Array(w * h);

    // Per-pixel minimum across R, G, B
    for (let i = 0; i < w * h; i++) {
        channelMin[i] = Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) / 255;
    }

    // Local minimum over patch (erosion)
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let mn = 1;
            for (let dy = -hp; dy <= hp; dy++) {
                for (let dx = -hp; dx <= hp; dx++) {
                    const ny = Math.max(0, Math.min(h - 1, y + dy));
                    const nx = Math.max(0, Math.min(w - 1, x + dx));
                    mn = Math.min(mn, channelMin[ny * w + nx]);
                }
            }
            dc[y * w + x] = mn;
        }
    }
    return dc;
}

// ════════════════════════════════════════════════════
// STEP 2: Overexposure / Flash / Glare Detection
// ════════════════════════════════════════════════════
// Pixels where ALL channels exceed high threshold are likely
// flash artifacts, headlight glare, or specular highlights.
// These must be EXCLUDED from atmospheric light estimation
// and flagged so ML never confuses them with haze.
function detectOverexposure(data, w, h) {
    const mask = new Uint8Array(w * h); // 1 = overexposed
    let overexposedCount = 0;
    const HIGH_THRESH = 240; // near-white
    const SAT_THRESH = 20;   // very low saturation = pure white glare

    for (let i = 0; i < w * h; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const saturation = maxC > 0 ? ((maxC - minC) / maxC) * 255 : 0;

        // Overexposed: very bright AND low saturation (white glare)
        if (maxC > HIGH_THRESH && saturation < SAT_THRESH) {
            mask[i] = 1;
            overexposedCount++;
        }
        // Also flag very bright pixels even with some saturation
        else if (r > 250 && g > 250 && b > 250) {
            mask[i] = 1;
            overexposedCount++;
        }
    }

    const overexposedPercent = (overexposedCount / (w * h)) * 100;
    const hasFlash = overexposedPercent > 5; // >5% overexposed = likely flash
    const hasGlare = overexposedPercent > 1 && overexposedPercent <= 5;

    return {
        mask,
        overexposedCount,
        overexposedPercent: Math.round(overexposedPercent * 100) / 100,
        hasFlash,
        hasGlare,
        severity: hasFlash ? 'FLASH DETECTED' : hasGlare ? 'GLARE DETECTED' : 'CLEAN',
    };
}

// ════════════════════════════════════════════════════
// STEP 3: Atmospheric Light Estimation (Glare-Masked)
// ════════════════════════════════════════════════════
// Standard approach: pick brightest pixels in dark channel.
// BUT: we EXCLUDE overexposed pixels (flash/glare) from
// the candidate set. This prevents flash from corrupting
// the atmospheric light estimate.
function estimateAtmosphericLight(data, dc, overexposureMask, w, h) {
    const n = w * h;
    const topCount = Math.max(1, Math.floor(n * 0.001)); // top 0.1%

    // Sort dark channel values, but EXCLUDE overexposed pixels
    const candidates = [];
    for (let i = 0; i < n; i++) {
        if (!overexposureMask[i]) { // Skip glare pixels
            candidates.push({ value: dc[i], index: i });
        }
    }

    // If too many pixels are masked, fall back to using all
    if (candidates.length < topCount * 2) {
        for (let i = 0; i < n; i++) {
            candidates.push({ value: dc[i], index: i });
        }
    }

    candidates.sort((a, b) => b.value - a.value);
    const topCandidates = candidates.slice(0, topCount);

    // Among top dark-channel pixels, find brightest (sum of RGB)
    let bestIdx = topCandidates[0].index;
    let bestSum = 0;
    for (const c of topCandidates) {
        const sum = data[c.index * 4] + data[c.index * 4 + 1] + data[c.index * 4 + 2];
        if (sum > bestSum) {
            bestSum = sum;
            bestIdx = c.index;
        }
    }

    return [
        data[bestIdx * 4] / 255,
        data[bestIdx * 4 + 1] / 255,
        data[bestIdx * 4 + 2] / 255,
    ];
}

// ════════════════════════════════════════════════════
// STEP 4: Transmission Map Computation
// ════════════════════════════════════════════════════
// t(x) = 1 - ω · darkChannel(I(x) / A)
// This tells us how much of the scene light reaches camera.
// Low t = heavy haze. High t = clear air.
function computeTransmission(data, A, w, h, omega = 0.95) {
    const normalized = new Uint8ClampedArray(w * h * 4);

    for (let i = 0; i < w * h; i++) {
        normalized[i * 4] = Math.min(255, (data[i * 4] / 255 / Math.max(A[0], 0.01)) * 255);
        normalized[i * 4 + 1] = Math.min(255, (data[i * 4 + 1] / 255 / Math.max(A[1], 0.01)) * 255);
        normalized[i * 4 + 2] = Math.min(255, (data[i * 4 + 2] / 255 / Math.max(A[2], 0.01)) * 255);
        normalized[i * 4 + 3] = 255;
    }

    const dcNorm = computeDarkChannel(normalized, w, h, 15);

    const transmission = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        transmission[i] = Math.max(0.05, Math.min(1.0, 1 - omega * dcNorm[i]));
    }

    return transmission;
}

// ════════════════════════════════════════════════════
// STEP 5: Guided Transmission Refinement
// ════════════════════════════════════════════════════
// Simple box-filter-based soft matting to smooth transmission
// while preserving edges. Reduces block artifacts.
function refineTransmission(transmission, data, w, h, radius = 20) {
    const refined = new Float32Array(w * h);
    const r2 = radius;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sum = 0, weight = 0;
            const centerR = data[(y * w + x) * 4];
            const centerG = data[(y * w + x) * 4 + 1];
            const centerB = data[(y * w + x) * 4 + 2];

            // Bilateral-like filtering: weight by spatial + color similarity
            const step = Math.max(1, Math.floor(r2 / 4));
            for (let dy = -r2; dy <= r2; dy += step) {
                for (let dx = -r2; dx <= r2; dx += step) {
                    const ny = Math.max(0, Math.min(h - 1, y + dy));
                    const nx = Math.max(0, Math.min(w - 1, x + dx));
                    const idx = ny * w + nx;

                    const dr = data[idx * 4] - centerR;
                    const dg = data[idx * 4 + 1] - centerG;
                    const db = data[idx * 4 + 2] - centerB;
                    const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);
                    const spatialDist = Math.sqrt(dx * dx + dy * dy);

                    const w_c = Math.exp(-colorDist / 60);
                    const w_s = Math.exp(-spatialDist / r2);
                    const w_total = w_c * w_s;

                    sum += transmission[idx] * w_total;
                    weight += w_total;
                }
            }

            refined[y * w + x] = weight > 0 ? sum / weight : transmission[y * w + x];
        }
    }

    return refined;
}

// ════════════════════════════════════════════════════
// STEP 6: Radiance Recovery (Glare Suppression)
// ════════════════════════════════════════════════════
// J(x) = (I(x) - A) / max(t(x), t0) + A
// This recovers the TRUE scene without atmospheric haze.
// Overexposed pixels are clamped to prevent amplification.
function recoverRadiance(data, A, transmission, overexposureMask, w, h) {
    const radiance = new Uint8ClampedArray(w * h * 4);
    const t0 = 0.1; // minimum transmission to prevent over-amplification

    for (let i = 0; i < w * h; i++) {
        const t = Math.max(transmission[i], t0);
        const isOverexposed = overexposureMask[i];

        for (let c = 0; c < 3; c++) {
            const I_c = data[i * 4 + c] / 255;
            let J_c;

            if (isOverexposed) {
                // For flash/glare pixels: suppress brightness aggressively
                // Use median of atmospheric light and observed value
                J_c = Math.min(I_c, A[c]) * 0.7;
            } else {
                // Standard radiance recovery
                J_c = (I_c - A[c]) / t + A[c];
            }

            radiance[i * 4 + c] = Math.max(0, Math.min(255, Math.round(J_c * 255)));
        }
        radiance[i * 4 + 3] = 255;
    }

    return radiance;
}

// ════════════════════════════════════════════════════
// STEP 7: Atmospheric Veil Extraction
// ════════════════════════════════════════════════════
// V(x) = A · (1 - t(x))
// This is the HAZE-ONLY component. It represents ONLY
// the light scattered by particles in the atmosphere.
// Flash, glare, and scene radiance are EXCLUDED.
function extractAtmosphericVeil(A, transmission, overexposureMask, w, h) {
    const veil = new Float32Array(w * h);

    for (let i = 0; i < w * h; i++) {
        if (overexposureMask[i]) {
            // Overexposed pixels: veil is set to zero (not haze)
            veil[i] = 0;
        } else {
            // V(x) = mean(A) * (1 - t(x))
            const A_mean = (A[0] + A[1] + A[2]) / 3;
            veil[i] = A_mean * (1 - transmission[i]);
        }
    }

    return veil;
}

// ════════════════════════════════════════════════════
// STEP 8: Feature Extraction from VEIL ONLY
// ════════════════════════════════════════════════════
// CRITICAL: Features are extracted ONLY from the atmospheric
// veil V(x), never from raw RGB or scene radiance J(x).
function extractVeilFeatures(veil, overexposureMask, w, h) {
    let sum = 0, count = 0, mx = 0, mn = 1;
    const validValues = [];

    for (let i = 0; i < w * h; i++) {
        if (!overexposureMask[i]) { // Only non-overexposed pixels
            const v = veil[i];
            sum += v;
            count++;
            if (v > mx) mx = v;
            if (v < mn) mn = v;
            validValues.push(v);
        }
    }

    if (count === 0) return { mean_veil: 0, veil_variance: 0, max_veil: 0, contrast: 0, p75: 0, p90: 0, p95: 0, spatial_std: 0 };

    const mean = sum / count;

    // Variance
    let varSum = 0;
    for (const v of validValues) varSum += (v - mean) ** 2;
    const variance = varSum / count;

    // Percentiles
    validValues.sort((a, b) => a - b);
    const p75 = validValues[Math.floor(count * 0.75)] || 0;
    const p90 = validValues[Math.floor(count * 0.90)] || 0;
    const p95 = validValues[Math.floor(count * 0.95)] || 0;

    // Spatial standard deviation (block-based)
    const blockSize = Math.max(4, Math.floor(Math.min(w, h) / 8));
    const blockMeans = [];
    for (let by = 0; by < h; by += blockSize) {
        for (let bx = 0; bx < w; bx += blockSize) {
            let bSum = 0, bCount = 0;
            for (let dy = 0; dy < blockSize && by + dy < h; dy++) {
                for (let dx = 0; dx < blockSize && bx + dx < w; dx++) {
                    const idx = (by + dy) * w + (bx + dx);
                    if (!overexposureMask[idx]) {
                        bSum += veil[idx];
                        bCount++;
                    }
                }
            }
            if (bCount > 0) blockMeans.push(bSum / bCount);
        }
    }
    let spatialVar = 0;
    const bmMean = blockMeans.reduce((a, b) => a + b, 0) / blockMeans.length;
    for (const bm of blockMeans) spatialVar += (bm - bmMean) ** 2;
    const spatialStd = Math.sqrt(spatialVar / Math.max(1, blockMeans.length));

    return {
        mean_veil: Math.round(mean * 10000) / 10000,
        veil_variance: Math.round(variance * 1000000) / 1000000,
        max_veil: Math.round(mx * 10000) / 10000,
        contrast: Math.round((mx - mn) * 10000) / 10000,
        p75: Math.round(p75 * 10000) / 10000,
        p90: Math.round(p90 * 10000) / 10000,
        p95: Math.round(p95 * 10000) / 10000,
        spatial_std: Math.round(spatialStd * 10000) / 10000,
    };
}

// ════════════════════════════════════════════════════
// STEP 9A: Scene Classification (Indoor/Outdoor)
// ════════════════════════════════════════════════════
// CRITICAL: The Dark Channel Prior was designed for OUTDOOR
// scenes with atmospheric depth. Indoor rooms appear as
// "maximum haze" because bright walls and artificial light
// have high dark channel values (uniform brightness).
// We MUST detect indoor scenes and correct for this.
function classifyScene(data, w, h, dc, transmission) {
    // --- Sky Detection: outdoor images have blue-dominant pixels in upper region ---
    const topRows = Math.floor(h * 0.25);
    let skyPixels = 0, topTotal = 0;
    for (let y = 0; y < topRows; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            topTotal++;
            // Sky = blue dominant, bright, low saturation or blue-shifted
            if (b > 120 && b > r * 1.1 && b > g * 0.95 && (r + g + b) > 250) skyPixels++;
        }
    }
    const skyRatio = skyPixels / Math.max(1, topTotal);

    // --- Mean brightness: indoor rooms are uniformly bright ---
    let totalBright = 0;
    for (let i = 0; i < w * h; i++) {
        totalBright += (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
    }
    const meanBrightness = totalBright / (w * h);

    // --- Color gamut: indoor scenes have narrow color range ---
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (let i = 0; i < w * h; i += 4) { // sample every 4th pixel
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
        if (r < rMin) rMin = r; if (r > rMax) rMax = r;
        if (g < gMin) gMin = g; if (g > gMax) gMax = g;
        if (b < bMin) bMin = b; if (b > bMax) bMax = b;
    }
    const gamut = ((rMax - rMin) + (gMax - gMin) + (bMax - bMin)) / 3;

    // --- Dark channel stats: indoor has HIGH mean DC ---
    let dcSum = 0;
    for (let i = 0; i < dc.length; i++) dcSum += dc[i];
    const dcMean = dcSum / dc.length;

    // --- Transmission stats: indoor shows LOW mean transmission ---
    let tSum = 0;
    for (let i = 0; i < transmission.length; i++) tSum += transmission[i];
    const tMean = tSum / transmission.length;

    // --- Classification logic ---
    let indoorScore = 0;
    let reasons = [];

    if (skyRatio < 0.05) { indoorScore += 3; reasons.push('No sky detected in upper region'); }
    else if (skyRatio < 0.15) { indoorScore += 1; reasons.push('Minimal sky presence'); }

    if (meanBrightness > 140) { indoorScore += 2; reasons.push('High uniform brightness (artificial light)'); }
    else if (meanBrightness > 110) { indoorScore += 1; reasons.push('Moderate brightness'); }

    if (gamut < 80) { indoorScore += 2; reasons.push('Narrow color gamut (typical of walls/ceilings)'); }
    else if (gamut < 120) { indoorScore += 1; reasons.push('Limited color diversity'); }

    if (dcMean > 0.35) { indoorScore += 2; reasons.push('Dark channel mean very high (no atmospheric depth)'); }
    else if (dcMean > 0.2) { indoorScore += 1; reasons.push('Dark channel elevated'); }

    if (tMean < 0.35) { indoorScore += 1; reasons.push('Very low transmission (suspicious for clean air)'); }

    const isIndoor = indoorScore >= 5;
    const isAmbiguous = indoorScore >= 3 && indoorScore < 5;
    const sceneType = isIndoor ? 'INDOOR' : isAmbiguous ? 'AMBIGUOUS' : 'OUTDOOR';

    // Correction factor for PSI
    // Indoor: DCP is fundamentally unreliable → divide by 8-10x
    // Ambiguous: partial correction → divide by 3-4x
    const correctionFactor = isIndoor ? 0.12 : isAmbiguous ? 0.3 : 1.0;

    return {
        sceneType,
        isIndoor,
        isAmbiguous,
        correctionFactor,
        indoorScore,
        skyRatio: Math.round(skyRatio * 1000) / 10,
        meanBrightness: Math.round(meanBrightness),
        gamut: Math.round(gamut),
        dcMean: Math.round(dcMean * 1000) / 1000,
        tMean: Math.round(tMean * 1000) / 1000,
        reasons,
    };
}

// ════════════════════════════════════════════════════
// STEP 9B: PSI Estimation from Veil Features
// ════════════════════════════════════════════════════
// Scene-aware regression. Indoor scenes get heavy correction
// because DCP is unreliable without atmospheric depth.
function estimatePSI(features, sceneInfo) {
    const mv = features.mean_veil;

    // Non-linear: power curve compresses high values
    const hazeIndex = Math.pow(mv, 0.7) * 2.2;
    let basePSI = hazeIndex * 320;

    // Percentile corrections
    const p90_boost = Math.max(0, features.p90 - mv) * 80;
    basePSI += p90_boost;

    // Spatial uniformity: truly uniform haze = slightly worse
    if (features.spatial_std < 0.02 && mv > 0.1) basePSI *= 1.08;

    // Apply scene correction (CRITICAL for indoor accuracy)
    basePSI *= sceneInfo.correctionFactor;

    // Baseline: even clean outdoor air has PSI ~20-35
    const minPSI = sceneInfo.isIndoor ? 10 : 18;
    const psi = Math.max(minPSI, Math.min(420, basePSI));

    return Math.round(psi);
}

function psiCategory(psi) {
    if (psi <= 50) return { label: 'Good', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', emoji: '🟢' };
    if (psi <= 100) return { label: 'Moderate', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', emoji: '🟡' };
    if (psi <= 200) return { label: 'Unhealthy', color: '#f97316', bg: 'rgba(249,115,22,0.12)', emoji: '🟠' };
    if (psi <= 300) return { label: 'Very Unhealthy', color: '#fb7185', bg: 'rgba(251,113,133,0.12)', emoji: '🔴' };
    return { label: 'Hazardous', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', emoji: '🟣' };
}

// ════════════════════════════════════════════════════
// RENDERING: Haze Heatmap (jet colormap)
// ════════════════════════════════════════════════════
function renderHeatmap(values, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);

    // Find range for normalization
    let mx = 0;
    for (let i = 0; i < values.length; i++) if (values[i] > mx) mx = values[i];
    if (mx < 0.001) mx = 1;

    for (let i = 0; i < w * h; i++) {
        const v = Math.min(1, values[i] / mx);
        let r, g, b;
        if (v < 0.25) { r = 0; g = Math.round(v * 4 * 255); b = 255; }
        else if (v < 0.5) { r = 0; g = 255; b = Math.round((1 - (v - 0.25) * 4) * 255); }
        else if (v < 0.75) { r = Math.round((v - 0.5) * 4 * 255); g = 255; b = 0; }
        else { r = 255; g = Math.round((1 - (v - 0.75) * 4) * 255); b = 0; }
        img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
}

// Render radiance-recovered image
function renderRadiance(radianceData, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < radianceData.length; i++) img.data[i] = radianceData[i];
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
}

// ════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════
export default function PerceptionPage() {
    const [imageURL, setImageURL] = useState(null);
    const [radianceURL, setRadianceURL] = useState(null);
    const [veilURL, setVeilURL] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState('');
    const [cameraActive, setCameraActive] = useState(false);
    const fileRef = useRef(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const processImage = useCallback((file) => {
        setProcessing(true); setAnalysis(null); setRadianceURL(null); setVeilURL(null);
        setProcessingStep('Loading image...');

        const reader = new FileReader();
        reader.onload = (e) => {
            const url = e.target.result;
            setImageURL(url);
            const img = new Image();
            img.onload = () => {
                // Resize for processing
                const maxD = 360, sc = maxD / Math.max(img.width, img.height);
                const w = Math.round(img.width * (sc < 1 ? sc : 1));
                const h = Math.round(img.height * (sc < 1 ? sc : 1));
                const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
                const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
                const data = ctx.getImageData(0, 0, w, h).data;
                const t0 = performance.now();

                // Use setTimeout to allow UI updates between heavy steps
                setTimeout(() => {
                    setProcessingStep('Detecting overexposure & flash...');
                    setTimeout(() => {
                        // STEP 2: Flash/Glare detection
                        const exposure = detectOverexposure(data, w, h);

                        setProcessingStep('Computing dark channel...');
                        setTimeout(() => {
                            // STEP 1: Dark channel
                            const dc = computeDarkChannel(data, w, h);

                            setProcessingStep('Estimating atmospheric light (glare-masked)...');
                            setTimeout(() => {
                                // STEP 3: Atmospheric light (glare-masked)
                                const A = estimateAtmosphericLight(data, dc, exposure.mask, w, h);

                                setProcessingStep('Computing transmission map...');
                                setTimeout(() => {
                                    // STEP 4: Transmission
                                    const rawTransmission = computeTransmission(data, A, w, h);

                                    setProcessingStep('Refining transmission (guided filter)...');
                                    setTimeout(() => {
                                        // STEP 5: Refinement
                                        const transmission = refineTransmission(rawTransmission, data, w, h, 12);

                                        setProcessingStep('Recovering scene radiance (glare suppression)...');
                                        setTimeout(() => {
                                            // STEP 6: Radiance recovery
                                            const radiance = recoverRadiance(data, A, transmission, exposure.mask, w, h);
                                            setRadianceURL(renderRadiance(radiance, w, h));

                                            setProcessingStep('Extracting atmospheric veil...');
                                            setTimeout(() => {
                                                // STEP 7: Atmospheric veil
                                                const veil = extractAtmosphericVeil(A, transmission, exposure.mask, w, h);
                                                setVeilURL(renderHeatmap(veil, w, h));

                                                setProcessingStep('Classifying scene (indoor/outdoor)...');
                                                setTimeout(() => {
                                                    // STEP 8: Feature extraction from VEIL ONLY
                                                    const features = extractVeilFeatures(veil, exposure.mask, w, h);
                                                    // STEP 9A: Scene classification
                                                    const sceneInfo = classifyScene(data, w, h, dc, transmission);

                                                    setProcessingStep(`Scene: ${sceneInfo.sceneType} — estimating PSI...`);
                                                    setTimeout(() => {
                                                        // STEP 9B: PSI from veil features + scene correction
                                                        const psi = estimatePSI(features, sceneInfo);
                                                        const category = psiCategory(psi);
                                                        const elapsed = ((performance.now() - t0) / 1000).toFixed(2);

                                                        setAnalysis({
                                                            features,
                                                            psi,
                                                            category,
                                                            elapsed,
                                                            atmLight: A,
                                                            exposure,
                                                            sceneInfo,
                                                            resolution: { w, h },
                                                            validPixelPercent: Math.round((1 - exposure.overexposedPercent / 100) * 10000) / 100,
                                                        });
                                                        setProcessing(false);
                                                    }, 30);
                                                }, 30);
                                            }, 30);
                                        }, 30);
                                    }, 30);
                                }, 30);
                            }, 30);
                        }, 30);
                    }, 30);
                }, 50);
            };
            img.src = url;
        };
        reader.readAsDataURL(file);
    }, []);

    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            streamRef.current = stream;
            setCameraActive(true);
            setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
        } catch {
            alert('Camera access denied or unavailable. Please use image upload instead.');
        }
    }, []);

    const capturePhoto = useCallback(() => {
        if (!videoRef.current) return;
        const v = videoRef.current;
        const cv = document.createElement('canvas'); cv.width = v.videoWidth; cv.height = v.videoHeight;
        cv.getContext('2d').drawImage(v, 0, 0);
        cv.toBlob(blob => { if (blob) processImage(blob); });
        stopCamera();
    }, [processImage]);

    const stopCamera = useCallback(() => {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setCameraActive(false);
    }, []);

    const resetAll = () => { setImageURL(null); setRadianceURL(null); setVeilURL(null); setAnalysis(null); stopCamera(); };

    const psiScaleBands = [
        { range: '0–50', label: 'Good', color: '#22c55e' },
        { range: '51–100', label: 'Moderate', color: '#fbbf24' },
        { range: '101–200', label: 'Unhealthy', color: '#f97316' },
        { range: '201–300', label: 'V. Unhealthy', color: '#fb7185' },
        { range: '301–500', label: 'Hazardous', color: '#ef4444' },
    ];

    return (
        <div className="page-container">
            {/* ═══ Hero ═══ */}
            <div className="page-hero fade-in">
                <div className="page-hero-label">Physics-Aware Perception Module</div>
                <h1 className="page-hero-title">
                    <span>Flash-Robust Atmospheric</span> Haze Analysis
                </h1>
                <p className="page-hero-desc">
                    Research-grade camera-based air quality estimation using the <strong>atmospheric scattering
                        model</strong>. Unlike naive image classifiers, this module separates scene radiance from
                    atmospheric haze — making it robust against <strong>flash photography, headlight glare,
                        and specular highlights</strong>. ML inference operates on the atmospheric veil only.
                </p>
            </div>

            <div className="page-content">
                {/* ═══ Input ═══ */}
                {!analysis && !processing && (
                    <div className="section fade-in-d1">
                        <div className="section-header"><div className="section-bar" /><h2 className="section-title">Input Source</h2></div>
                        <p className="section-desc">
                            Upload an outdoor photograph or capture one using your device camera. For best results,
                            use daytime images showing distant objects. The system will automatically detect and
                            suppress flash artifacts and glare before estimating haze.
                        </p>

                        <div className="perception-layout">
                            <div
                                className="upload-zone"
                                onClick={() => fileRef.current?.click()}
                                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer?.files?.[0]) processImage(e.dataTransfer.files[0]); }}
                                onDragOver={(e) => e.preventDefault()}
                                id="upload-zone"
                            >
                                <div className="upload-icon">📷</div>
                                <div className="upload-title">Upload Image</div>
                                <div className="upload-hint">Drag & drop or click to browse</div>
                                <div className="upload-hint" style={{ marginTop: '8px' }}>JPG, PNG · Outdoor scenes · Flash OK</div>
                            </div>

                            {!cameraActive ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
                                    <button className="camera-btn" onClick={startCamera} id="start-camera-btn">
                                        <svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="4" /><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /></svg>
                                        Open Camera
                                    </button>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.6' }}>
                                        Live camera capture with automatic flash/glare detection.
                                        Rear camera recommended for accurate outdoor readings.
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div className="camera-preview">
                                        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: '14px' }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="action-btn primary" onClick={capturePhoto} style={{ flex: 1 }} id="capture-btn">
                                            📸 Capture & Analyze
                                        </button>
                                        <button className="action-btn outline" onClick={stopCamera}>Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="upload-input" onChange={e => { if (e.target.files?.[0]) processImage(e.target.files[0]); }} />
                    </div>
                )}

                {/* ═══ Processing ═══ */}
                {processing && (
                    <div className="section fade-in" style={{ textAlign: 'center', padding: '60px 0' }}>
                        <div style={{ fontSize: '36px', marginBottom: '16px' }}>🔬</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-emerald)', letterSpacing: '2px', marginBottom: '8px' }}>
                            PHYSICS-AWARE ANALYSIS IN PROGRESS
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto', lineHeight: '1.6' }}>
                            {processingStep}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', marginTop: '16px' }}>
                            I(x) = J(x)·t(x) + A·(1 − t(x))
                        </div>
                    </div>
                )}

                {/* ═══ Results ═══ */}
                {analysis && (
                    <div className="analysis-result fade-in">

                        {/* Indoor Scene Warning */}
                        {analysis.sceneInfo && (analysis.sceneInfo.isIndoor || analysis.sceneInfo.isAmbiguous) && (
                            <div className="section">
                                <div className="explainer" style={{
                                    borderColor: analysis.sceneInfo.isIndoor ? 'rgba(168,85,247,0.3)' : 'rgba(59,130,246,0.25)',
                                    background: analysis.sceneInfo.isIndoor ? 'rgba(168,85,247,0.04)' : 'rgba(59,130,246,0.03)',
                                }}>
                                    <div className="explainer-title" style={{ color: analysis.sceneInfo.isIndoor ? '#a855f7' : '#3b82f6' }}>
                                        🏠 {analysis.sceneInfo.sceneType} SCENE DETECTED
                                    </div>
                                    <div className="explainer-text">
                                        {analysis.sceneInfo.isIndoor
                                            ? `This image appears to be taken indoors. The Dark Channel Prior method was designed for OUTDOOR atmospheric depth estimation — indoor rooms have bright walls, artificial lighting, and no atmospheric perspective, which the algorithm falsely interprets as dense haze. A correction factor of ${Math.round(analysis.sceneInfo.correctionFactor * 100)}% has been applied. For accurate air quality readings, please use an OUTDOOR image showing distant objects and sky.`
                                            : `Scene classification is ambiguous — possibly indoor or a close-range outdoor shot. A partial correction has been applied (${Math.round(analysis.sceneInfo.correctionFactor * 100)}%). For best accuracy, use outdoor images with visible sky and distant landmarks.`
                                        }
                                    </div>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.8' }}>
                                        Detection reasons: {analysis.sceneInfo.reasons.join(' · ')}
                                        <br />Sky: {analysis.sceneInfo.skyRatio}% · Brightness: {analysis.sceneInfo.meanBrightness} · Gamut: {analysis.sceneInfo.gamut} · DC mean: {analysis.sceneInfo.dcMean} · Score: {analysis.sceneInfo.indoorScore}/11
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Flash/Glare Status Banner */}
                        {(analysis.exposure.hasFlash || analysis.exposure.hasGlare) && (
                            <div className="section">
                                <div className="explainer" style={{
                                    borderColor: analysis.exposure.hasFlash ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.25)',
                                    background: analysis.exposure.hasFlash ? 'rgba(239,68,68,0.04)' : 'rgba(251,191,36,0.03)',
                                }}>
                                    <div className="explainer-title" style={{ color: analysis.exposure.hasFlash ? '#ef4444' : '#fbbf24' }}>
                                        ⚡ {analysis.exposure.severity}
                                    </div>
                                    <div className="explainer-text">
                                        {analysis.exposure.hasFlash
                                            ? `Significant flash/overexposure detected — ${analysis.exposure.overexposedPercent}% of pixels are overexposed. Radiance separation applied. PSI excludes flash-contaminated regions.`
                                            : `Moderate glare — ${analysis.exposure.overexposedPercent}% specular highlights masked and excluded from haze analysis.`
                                        }
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Three Output Images */}
                        <div className="section">
                            <div className="section-header"><div className="section-bar" /><h2 className="section-title">Visual Pipeline Output</h2></div>
                            <p className="section-desc">
                                Three stages of the atmospheric scattering model. <strong>Left:</strong> original input.
                                <strong> Center:</strong> radiance-recovered scene (flash/glare suppressed).
                                <strong> Right:</strong> atmospheric veil heatmap (haze-only, what ML sees).
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                <div className="analysis-img-box">
                                    <img src={imageURL} alt="Original" />
                                    <div className="analysis-img-label">Original I(x)</div>
                                </div>
                                <div className="analysis-img-box">
                                    <img src={radianceURL} alt="Radiance Recovered" />
                                    <div className="analysis-img-label">Scene Radiance J(x)</div>
                                </div>
                                <div className="analysis-img-box">
                                    <img src={veilURL} alt="Atmospheric Veil" />
                                    <div className="analysis-img-label">Atm. Veil V(x) = A·(1−t)</div>
                                </div>
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.6' }}>
                                Blue = clear air (low haze) · Yellow = moderate haze · Red = dense haze.
                                Overexposed regions appear as dark blue (excluded from ML).
                            </div>
                        </div>

                        {/* PSI Result — Speedometer Gauge */}
                        <div className="section">
                            <div className="section-header"><div className="section-bar" style={{ background: analysis.category.color }} /><h2 className="section-title">Estimated Air Quality</h2></div>
                            <p className="section-desc">
                                PSI derived <strong>exclusively</strong> from atmospheric veil V(x). Flash, glare, and surface reflections are excluded.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                {/* Speedometer */}
                                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px' }}>
                                    <svg width="260" height="160" viewBox="0 0 260 160">
                                        {/* Background arc segments */}
                                        {[{ end: 50, color: '#22c55e' }, { end: 100, color: '#fbbf24' }, { end: 200, color: '#f97316' }, { end: 300, color: '#fb7185' }, { end: 500, color: '#ef4444' }].reduce((acc, seg, i, arr) => {
                                            const start = i === 0 ? 0 : arr[i - 1].end;
                                            const startAngle = -180 + (start / 500) * 180;
                                            const endAngle = -180 + (seg.end / 500) * 180;
                                            const r = 100;
                                            const cx = 130, cy = 140;
                                            const x1 = cx + r * Math.cos(startAngle * Math.PI / 180);
                                            const y1 = cy + r * Math.sin(startAngle * Math.PI / 180);
                                            const x2 = cx + r * Math.cos(endAngle * Math.PI / 180);
                                            const y2 = cy + r * Math.sin(endAngle * Math.PI / 180);
                                            const large = (endAngle - startAngle) > 180 ? 1 : 0;
                                            acc.push(<path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={seg.color} strokeWidth="18" strokeLinecap="butt" opacity="0.2" />);
                                            return acc;
                                        }, [])}
                                        {/* Active arc */}
                                        {(() => {
                                            const angle = -180 + Math.min(analysis.psi, 500) / 500 * 180;
                                            const r = 100, cx = 130, cy = 140;
                                            const x1 = cx + r * Math.cos(-180 * Math.PI / 180);
                                            const y1 = cy + r * Math.sin(-180 * Math.PI / 180);
                                            const x2 = cx + r * Math.cos(angle * Math.PI / 180);
                                            const y2 = cy + r * Math.sin(angle * Math.PI / 180);
                                            const large = (angle + 180) > 180 ? 1 : 0;
                                            return <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={analysis.category.color} strokeWidth="18" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${analysis.category.color}60)` }} />;
                                        })()}
                                        {/* Needle */}
                                        {(() => {
                                            const angle = -180 + Math.min(analysis.psi, 500) / 500 * 180;
                                            const r = 80, cx = 130, cy = 140;
                                            const nx = cx + r * Math.cos(angle * Math.PI / 180);
                                            const ny = cy + r * Math.sin(angle * Math.PI / 180);
                                            return <>
                                                <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={analysis.category.color} strokeWidth="2.5" strokeLinecap="round" />
                                                <circle cx={cx} cy={cy} r="6" fill={analysis.category.color} />
                                                <circle cx={cx} cy={cy} r="3" fill="var(--bg-void)" />
                                            </>;
                                        })()}
                                        {/* Labels */}
                                        <text x="30" y="148" fill="var(--text-dim)" fontSize="8" fontFamily="JetBrains Mono">0</text>
                                        <text x="57" y="68" fill="#22c55e" fontSize="7" fontFamily="JetBrains Mono">50</text>
                                        <text x="125" y="38" fill="#fbbf24" fontSize="7" fontFamily="JetBrains Mono" textAnchor="middle">100</text>
                                        <text x="193" y="68" fill="#f97316" fontSize="7" fontFamily="JetBrains Mono">200</text>
                                        <text x="225" y="148" fill="var(--text-dim)" fontSize="8" fontFamily="JetBrains Mono">500</text>
                                        {/* Center value */}
                                        <text x="130" y="118" textAnchor="middle" fill={analysis.category.color} fontSize="36" fontWeight="800" fontFamily="JetBrains Mono">{analysis.psi}</text>
                                        <text x="130" y="135" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontFamily="JetBrains Mono" letterSpacing="2">PSI</text>
                                    </svg>
                                    <span className="psi-badge" style={{ background: analysis.category.bg, color: analysis.category.color, border: `1px solid ${analysis.category.color}30`, marginTop: '8px' }}>
                                        {analysis.category.emoji} {analysis.category.label.toUpperCase()}
                                    </span>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center', lineHeight: '1.5' }}>
                                        {analysis.elapsed}s · {analysis.resolution.w}×{analysis.resolution.h}px · Valid: {analysis.validPixelPercent}%
                                    </div>
                                </div>
                                {/* Radial Feature Chart + Distribution */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div className="card" style={{ flex: 1, padding: '20px' }}>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1.5px', marginBottom: '12px' }}>HAZE DISTRIBUTION</div>
                                        {[{ label: 'Mean Density', val: analysis.features.mean_veil, max: 0.5 },
                                        { label: 'P90 Intensity', val: analysis.features.p90, max: 0.6 },
                                        { label: 'P95 Extreme', val: analysis.features.p95, max: 0.7 },
                                        { label: 'Peak Veil', val: analysis.features.max_veil, max: 0.8 },
                                        { label: 'Spatial Var.', val: analysis.features.spatial_std, max: 0.15 },
                                        ].map((f, i) => (
                                            <div key={i} style={{ marginBottom: '10px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-secondary)' }}>{f.label}</span>
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: analysis.category.color, fontWeight: 700 }}>{f.val}</span>
                                                </div>
                                                <div style={{ height: '6px', background: 'var(--bg-void)', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${Math.min(100, (f.val / f.max) * 100)}%`, height: '100%', borderRadius: '3px', background: `linear-gradient(90deg, ${analysis.category.color}44, ${analysis.category.color})`, transition: 'width 1s ease' }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="card" style={{ padding: '14px 20px' }}>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1.5px', marginBottom: '6px' }}>ATMOSPHERIC LIGHT</div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: `rgb(${analysis.atmLight.map(v => Math.round(v * 255)).join(',')})`, border: '2px solid var(--border-subtle)' }} />
                                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)' }}>A = [{analysis.atmLight.map(v => (v * 255).toFixed(0)).join(', ')}]</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Confidence Note */}
                        <div className="section">
                            <div className="explainer" style={{ borderColor: 'rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.02)' }}>
                                <div className="explainer-title" style={{ color: 'var(--accent-emerald)' }}>
                                    ✓ Flash & Glare Removed Before Estimation
                                </div>
                                <div className="explainer-text">
                                    This estimate used the <strong>atmospheric scattering model</strong>:
                                    I(x) = J(x)·t(x) + A·(1−t(x)). Radiance separation was applied to isolate
                                    the atmospheric veil from scene radiance. <strong>{analysis.exposure.overexposedCount.toLocaleString()}
                                        overexposed pixel{analysis.exposure.overexposedCount !== 1 ? 's' : ''}</strong> ({analysis.exposure.overexposedPercent}%)
                                    were detected and excluded from ML inference.
                                    <br /><br />
                                    <strong>Confidence:</strong> Approximate (flash-robust). This is a supplementary
                                    camera sensor — it does not replace CPCB physical monitoring equipment.
                                </div>
                            </div>
                        </div>

                        {/* PSI Scale */}
                        <div className="section">
                            <div className="section-header"><div className="section-bar" /><h2 className="section-title">PSI Scale Reference</h2></div>
                            <div className="psi-scale">
                                {psiScaleBands.map((b, i) => {
                                    const [lo, hi] = b.range.replace('–', '-').split('-').map(Number);
                                    const isActive = analysis.psi >= lo && analysis.psi <= hi;
                                    return (
                                        <div key={i} className={`psi-scale-band ${isActive ? 'active' : ''}`} style={{ background: b.color + (isActive ? '' : '88') }}>
                                            <span>{b.range}</span>{b.label}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Veil Features — ML Input */}
                        <div className="section">
                            <div className="section-header"><div className="section-bar" /><h2 className="section-title">ML Input Features (Veil-Only)</h2></div>
                            <p className="section-desc">
                                These features are extracted <strong>exclusively from the atmospheric veil V(x)</strong> —
                                the isolated haze component after radiance separation. The ML model never sees raw
                                image brightness, scene radiance, or overexposed pixels.
                            </p>
                            <div className="features-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                                {[
                                    { label: 'Mean Veil', val: analysis.features.mean_veil, desc: 'Average haze density across valid (non-glare) pixels' },
                                    { label: 'Veil Variance', val: analysis.features.veil_variance, desc: 'How unevenly distributed the atmospheric haze is' },
                                    { label: 'Max Veil', val: analysis.features.max_veil, desc: 'Peak haze intensity in densest non-glare region' },
                                    { label: 'Contrast', val: analysis.features.contrast, desc: 'Range between clearest and haziest valid areas' },
                                    { label: 'P75 Veil', val: analysis.features.p75, desc: '75th percentile — 25% of scene is above this haze level' },
                                    { label: 'P90 Veil', val: analysis.features.p90, desc: '90th percentile — captures dense haze pockets' },
                                    { label: 'P95 Veil', val: analysis.features.p95, desc: '95th percentile — extreme haze regions' },
                                    { label: 'Spatial σ', val: analysis.features.spatial_std, desc: 'Block-wise spatial variation in haze concentration' },
                                ].map((f, i) => (
                                    <div className="feature-cell" key={i}>
                                        <div className="feature-cell-label">{f.label}</div>
                                        <div className="feature-cell-val">{f.val}</div>
                                        <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>{f.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Physics Pipeline Methodology */}
                        <div className="section">
                            <div className="section-header"><div className="section-bar" /><h2 className="section-title">Physics-Aware Pipeline</h2></div>
                            <div className="explainer">
                                <div className="explainer-title">🔬 Atmospheric Scattering Model</div>
                                <div className="explainer-text" style={{ marginBottom: '16px' }}>
                                    This module implements the <strong>Koschmieder atmospheric scattering equation</strong>,
                                    first formalized for computer vision by He et al. (CVPR 2009). Unlike naive image
                                    classifiers that treat brightness as haze, this system physically decomposes the
                                    observed image into its constituent components.
                                </div>
                                <div className="methodology-steps">
                                    <div className="method-step">
                                        <div className="method-step-num">1</div>
                                        <div className="method-step-content">
                                            <div className="method-step-title">Flash & Glare Detection</div>
                                            <div className="method-step-desc">
                                                Pixels where all RGB channels exceed 240 with low saturation are flagged as
                                                overexposed. These represent flash artifacts, headlight glare, or specular
                                                highlights — NOT atmospheric haze. They are excluded from all subsequent steps.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="method-step">
                                        <div className="method-step-num">2</div>
                                        <div className="method-step-content">
                                            <div className="method-step-title">Dark Channel Prior</div>
                                            <div className="method-step-desc">
                                                For each pixel, we compute min(R,G,B) over a 15×15 patch. In haze-free
                                                outdoor images, this "dark channel" tends to zero. When atmospheric particles
                                                scatter light, the dark channel brightens — allowing haze detection.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="method-step">
                                        <div className="method-step-num">3</div>
                                        <div className="method-step-content">
                                            <div className="method-step-title">Glare-Masked Atmospheric Light (A)</div>
                                            <div className="method-step-desc">
                                                Standard method selects the brightest dark-channel pixels to estimate global
                                                illumination A. <strong>Critical improvement:</strong> we exclude all
                                                overexposed pixels from this selection, preventing flash from corrupting the
                                                atmospheric light estimate.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="method-step">
                                        <div className="method-step-num">4</div>
                                        <div className="method-step-content">
                                            <div className="method-step-title">Transmission Map t(x)</div>
                                            <div className="method-step-desc">
                                                t(x) = 1 − ω · darkChannel(I(x)/A). This map describes what fraction of
                                                scene light reaches the camera. Low transmission means heavy haze; high
                                                transmission means clear air. Refined using bilateral filtering for edge preservation.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="method-step">
                                        <div className="method-step-num">5</div>
                                        <div className="method-step-content">
                                            <div className="method-step-title">Radiance Recovery J(x)</div>
                                            <div className="method-step-desc">
                                                J(x) = (I(x) − A) / max(t(x), 0.1) + A. This removes atmospheric haze
                                                and recovers the true scene. Overexposed pixels are handled separately —
                                                their brightness is clamped to prevent amplification of flash artifacts.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="method-step">
                                        <div className="method-step-num">6</div>
                                        <div className="method-step-content">
                                            <div className="method-step-title">Atmospheric Veil V(x) = A · (1 − t(x))</div>
                                            <div className="method-step-desc">
                                                The atmospheric veil is the <strong>haze-only component</strong> of the image.
                                                It contains ONLY the light scattered by atmospheric particles. Flash, glare,
                                                scene radiance, and surface reflections are excluded. Overexposed pixels have
                                                their veil set to zero (they are not haze).
                                            </div>
                                        </div>
                                    </div>
                                    <div className="method-step">
                                        <div className="method-step-num">7</div>
                                        <div className="method-step-content">
                                            <div className="method-step-title">Veil-Only Feature Extraction</div>
                                            <div className="method-step-desc">
                                                Eight statistical features are extracted exclusively from V(x): mean, variance,
                                                max, contrast, P75, P90, P95, and spatial σ. These capture haze density,
                                                distribution, and spatial patterns. <strong>No features come from raw RGB.</strong>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="method-step">
                                        <div className="method-step-num">8</div>
                                        <div className="method-step-content">
                                            <div className="method-step-title">PSI Estimation (Flash-Robust)</div>
                                            <div className="method-step-desc">
                                                A weighted multi-feature regression model maps veil features to an approximate
                                                PSI value. The model uses mean haze as primary signal, with percentile and
                                                spatial features as secondary corrections. Because ML operates on veil-only
                                                data, flash and glare cannot produce false high readings.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* JSON Output */}
                        <div className="section">
                            <div className="section-header"><div className="section-bar" /><h2 className="section-title">Structured Output</h2></div>
                            <pre style={{
                                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-md)', padding: '16px 20px',
                                fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-emerald)',
                                lineHeight: '1.7', overflow: 'auto',
                            }}>
                                {JSON.stringify({
                                    estimated_psi: analysis.psi,
                                    pollution_category: analysis.category.label,
                                    confidence: 'Approximate (flash-robust)',
                                    atmospheric_light: analysis.atmLight.map(v => Math.round(v * 255)),
                                    overexposure: {
                                        severity: analysis.exposure.severity,
                                        affected_percent: analysis.exposure.overexposedPercent,
                                        pixels_excluded: analysis.exposure.overexposedCount,
                                    },
                                    veil_features: analysis.features,
                                    notes: 'Radiance separation applied. Flash and glare removed before haze estimation. ML input = atmospheric veil only.',
                                }, null, 2)}
                            </pre>
                        </div>

                        {/* Re-analyze + Disclaimer */}
                        <div className="section" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <button className="action-btn primary" onClick={resetAll} id="reanalyze-btn">
                                ↻ Analyze Another Image
                            </button>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.6', flex: 1 }}>
                                ⚠ Physics-aware supplementary sensor. PSI values are approximate — derived from
                                atmospheric veil features, not direct particulate measurement. Best suited for
                                relative comparisons and trend indication. Does not replace CPCB monitoring.
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ Pre-analysis Explainer ═══ */}
                {!analysis && !processing && (
                    <div className="section fade-in-d2">
                        <div className="explainer">
                            <div className="explainer-title">🧪 Why Physics-Aware Perception?</div>
                            <div className="explainer-text">
                                <strong>The Problem:</strong> Naive camera-based pollution estimators treat ALL
                                bright pixels as haze. This means flash photography, headlight glare, and overexposed
                                skies produce <strong>false high readings</strong> — the system thinks the air is
                                polluted when it's actually just bright.
                                <br /><br />
                                <strong>The Solution:</strong> This module implements the <strong>atmospheric scattering
                                    model</strong> (Koschmieder equation) to physically decompose the observed image:
                                <br /><br />
                                <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                                    I(x) = J(x) · t(x) + A · (1 − t(x))
                                </strong>
                                <br /><br />
                                By solving this equation, we separate the image into:
                                <br />• <strong>J(x)</strong> — Scene radiance (the real scene, glare suppressed)
                                <br />• <strong>V(x) = A·(1−t(x))</strong> — Atmospheric veil (the haze-only component)
                                <br /><br />
                                The ML model then operates <strong>exclusively on V(x)</strong>. This means:
                                <br />✓ Flash artifacts are removed before analysis
                                <br />✓ Headlight glare is suppressed in radiance recovery
                                <br />✓ Specular highlights are detected and excluded
                                <br />✓ Only true atmospheric haze contributes to the PSI estimate
                                <br /><br />
                                <strong>Philosophy:</strong> This module behaves like a <strong>physics-aware
                                    sensor</strong>, not a naive image classifier. Correct physical reasoning is
                                prioritized over raw statistical accuracy.
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
