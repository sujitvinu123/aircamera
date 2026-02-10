/**
 * ═══════════════════════════════════════════════════════════════
 * AIRSSP — Simulation Data Engine
 * ═══════════════════════════════════════════════════════════════
 * Reuses logic from:
 *   - generate_aqi_data.py (station network, pollution correlations)
 *   - prediction_engine.py (future AQI forecasting)
 *   - simulation_engine.py (policy impact simulation)
 *   - policy_engine.py (intervention recommendations)
 *   - haze_estimation.py (perception trust model)
 * 
 * All numeric logic distilled from the Python backends into
 * a live JavaScript simulation engine.
 * ═══════════════════════════════════════════════════════════════
 */

// ── Chennai Station Network (from generate_aqi_data.py) ──
export const STATIONS = [
    { id: 'ST001', name: 'T Nagar', lat: 13.0418, lng: 80.2341, type: 'government' },
    { id: 'ST002', name: 'Adyar', lat: 13.0012, lng: 80.2565, type: 'government' },
    { id: 'ST003', name: 'Velachery', lat: 12.9815, lng: 80.2180, type: 'iot' },
    { id: 'ST004', name: 'Anna Nagar', lat: 13.0850, lng: 80.2101, type: 'government' },
    { id: 'ST005', name: 'Guindy', lat: 13.0067, lng: 80.2206, type: 'iot' },
    { id: 'ST006', name: 'Tambaram', lat: 12.9229, lng: 80.1275, type: 'camera' },
    { id: 'ST007', name: 'Porur', lat: 13.0382, lng: 80.1565, type: 'iot' },
    { id: 'ST008', name: 'OMR', lat: 12.9716, lng: 80.2518, type: 'camera' },
    { id: 'ST009', name: 'Perungudi', lat: 12.9654, lng: 80.2461, type: 'iot' },
    { id: 'ST010', name: 'Nungambakkam', lat: 13.0626, lng: 80.2295, type: 'government' },
];

// ── PSI Category Logic (from psi_model.py) ──
export function psiCategory(psi) {
    if (psi <= 50) return 'Good';
    if (psi <= 100) return 'Moderate';
    if (psi <= 200) return 'Unhealthy';
    if (psi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
}

// ── Risk Level (from prediction_engine.py) ──
export function riskLevel(aqi) {
    if (aqi > 300) return 'SEVERE';
    if (aqi > 200) return 'HIGH';
    if (aqi > 100) return 'MODERATE';
    return 'LOW';
}

// ── Trust Score by Source Type ──
// Government stations: high trust, stable
// IoT sensors: variable trust, fluctuates
// Camera perception: moderate trust, translucent
export function computeTrust(type, timeOffset = 0) {
    const noise = Math.sin(Date.now() / 1000 + timeOffset) * 0.1;
    switch (type) {
        case 'government': return Math.min(0.98, 0.92 + noise * 0.3);
        case 'iot': return Math.min(0.95, 0.65 + Math.sin(Date.now() / 500 + timeOffset) * 0.15);
        case 'camera': return Math.min(0.85, 0.55 + noise * 0.5);
        default: return 0.5;
    }
}

// ── Pollution Simulation (from generate_aqi_data.py correlations) ──
function generateBasePollution(hour) {
    // Traffic-correlated: rush hours 8-11, 17-20
    let trafficFactor = 1.0;
    if ((hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 20)) {
        trafficFactor = 1.4 + Math.random() * 0.4;
    } else if ((hour >= 12 && hour <= 16)) {
        trafficFactor = 1.1 + Math.random() * 0.2;
    } else {
        trafficFactor = 0.6 + Math.random() * 0.3;
    }

    const windSpeed = 0.5 + Math.random() * 5.5;
    let windFactor = 1.0;
    if (windSpeed > 3.0) windFactor = 0.6 + Math.random() * 0.2;
    else if (windSpeed < 1.0) windFactor = 1.1 + Math.random() * 0.2;

    const pm25 = Math.max(10, Math.min(300, (10 + Math.random() * 140) * trafficFactor * windFactor));
    const pm10 = Math.max(20, Math.min(400, (20 + Math.random() * 180) * trafficFactor * windFactor));

    const aqi = Math.max(30, Math.min(400, Math.max(pm25 * 1.3, pm10) + (Math.random() - 0.5) * 20));

    return {
        pm25: Math.round(pm25 * 100) / 100,
        pm10: Math.round(pm10 * 100) / 100,
        no2: Math.round((5 + Math.random() * 75) * trafficFactor * windFactor * 100) / 100,
        so2: Math.round((2 + Math.random() * 38) * windFactor * 100) / 100,
        co: Math.round((0.3 + Math.random() * 4.7) * trafficFactor * windFactor * 0.8 * 100) / 100,
        o3: Math.round((5 + Math.random() * 95) * 100) / 100,
        aqi: Math.round(aqi),
        temperature: Math.round((24 + Math.random() * 16) * 10) / 10,
        humidity: Math.round((40 + Math.random() * 50) * 10) / 10,
        windSpeed: Math.round(windSpeed * 10) / 10,
        trafficLevel: trafficFactor > 1.3 ? 'High' : trafficFactor > 1.0 ? 'Moderate' : 'Low',
    };
}

// ── Policy Recommendations (from policy_engine.py + future_policy_engine.py) ──
export function generatePolicies(aqi, trafficLevel, windSpeed) {
    const policies = [];

    if (aqi > 300) {
        policies.push({ text: 'Emergency pollution control activation', severity: 'critical', icon: '🚨' });
        policies.push({ text: 'Suspend heavy vehicle traffic immediately', severity: 'critical', icon: '🚫' });
        policies.push({ text: 'Temporary industrial shutdown within 5km', severity: 'critical', icon: '🏭' });
        policies.push({ text: 'Issue public emergency health advisory', severity: 'critical', icon: '⚠️' });
    } else if (aqi > 200) {
        policies.push({ text: 'Restrict heavy vehicle entry during peak hours', severity: 'high', icon: '🚛' });
        policies.push({ text: 'Activate traffic diversion routes', severity: 'high', icon: '🔀' });
        policies.push({ text: 'Promote public transport usage', severity: 'moderate', icon: '🚌' });
        policies.push({ text: 'Issue early public health advisory', severity: 'high', icon: '📢' });
    } else if (aqi > 150) {
        policies.push({ text: 'Encourage public transport usage', severity: 'moderate', icon: '🚇' });
        policies.push({ text: 'Monitor pollution closely', severity: 'moderate', icon: '📡' });
        policies.push({ text: 'Prepare traffic control readiness', severity: 'low', icon: '🔧' });
    } else {
        policies.push({ text: 'Continue routine monitoring', severity: 'low', icon: '✅' });
    }

    if (aqi > 200 && windSpeed < 2) {
        policies.push({ text: 'Activate artificial air circulation', severity: 'high', icon: '💨' });
        policies.push({ text: 'Deploy dust suppression measures', severity: 'high', icon: '🌊' });
    }

    return policies;
}

// ── Simulation Impact (from simulation_engine.py) ──
export function simulateIntervention(pollution) {
    const { aqi, pm25, pm10, trafficLevel } = pollution;

    let reducedPM25 = pm25;
    let reducedPM10 = pm10;

    if (trafficLevel === 'High') {
        reducedPM25 *= 0.80;
        reducedPM10 *= 0.85;
    }

    const windReduction = pollution.windSpeed < 2 ? 0.90 : 1.0;

    const origAvg = (pm25 + pm10) / 2 || 1;
    const newAvg = (reducedPM25 + reducedPM10) / 2;
    const ratio = newAvg / origAvg;

    const predictedAqi = Math.min(aqi * ratio * windReduction, aqi);
    const reduction = ((aqi - predictedAqi) / aqi) * 100;

    return {
        originalAqi: Math.round(aqi),
        predictedAqi: Math.round(predictedAqi),
        reductionPercent: Math.round(reduction * 10) / 10,
    };
}

// ── Full Station State Generator ──
export function generateStationState(station, temporalOffset = 0) {
    const now = new Date();
    const adjustedHour = (now.getHours() + Math.floor(temporalOffset)) % 24;

    const pollution = generateBasePollution(adjustedHour);
    const trust = computeTrust(station.type, station.lat * 100);
    const category = psiCategory(pollution.aqi);
    const risk = riskLevel(pollution.aqi);
    const policies = generatePolicies(pollution.aqi, pollution.trafficLevel, pollution.windSpeed);
    const intervention = simulateIntervention(pollution);

    // Source alignment/coherence — how well this source agrees with neighbors
    const coherence = 0.5 + trust * 0.3 + (Math.sin(Date.now() / 2000 + station.lng * 10) * 0.2);

    // Determine if source is "rejected" (trust too low + outlier reading)
    const rejected = trust < 0.35 && Math.random() > 0.7;

    return {
        ...station,
        ...pollution,
        trust: Math.round(trust * 100) / 100,
        category,
        risk,
        policies,
        intervention,
        coherence: Math.min(1, Math.max(0, coherence)),
        rejected,
        timestamp: now.toISOString(),
        temporalOffset,
    };
}

// ── Live System State ──
export function generateSystemState(temporalOffset = 0) {
    const stations = STATIONS.map(s => generateStationState(s, temporalOffset));

    const avgAqi = Math.round(stations.reduce((a, s) => a + s.aqi, 0) / stations.length);
    const maxAqi = Math.max(...stations.map(s => s.aqi));
    const avgTrust = Math.round(stations.reduce((a, s) => a + s.trust, 0) / stations.length * 100) / 100;
    const avgCoherence = Math.round(stations.reduce((a, s) => a + s.coherence, 0) / stations.length * 100) / 100;

    const activeAlerts = stations.filter(s => s.aqi > 200).length;
    const rejectedSources = stations.filter(s => s.rejected).length;

    const systemRisk = riskLevel(avgAqi);
    const systemCategory = psiCategory(avgAqi);

    return {
        stations,
        avgAqi,
        maxAqi,
        avgTrust,
        avgCoherence,
        activeAlerts,
        rejectedSources,
        systemRisk,
        systemCategory,
        timestamp: new Date().toISOString(),
        temporalOffset,
    };
}
