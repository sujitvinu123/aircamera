/**
 * AIRSSP — Intelligence Panel (Right Side)
 */
import React from 'react';

function EnvironmentState({ systemState }) {
    if (!systemState?.stations?.length) return null;

    const avg = (key) => Math.round(
        systemState.stations.reduce((a, s) => a + s[key], 0) / systemState.stations.length * 10
    ) / 10;

    const metrics = [
        { label: 'TEMPERATURE', value: avg('temperature'), max: 45, color: '#fbbf24' },
        { label: 'HUMIDITY', value: avg('humidity'), max: 100, color: '#38bdf8' },
        { label: 'WIND SPEED', value: avg('windSpeed'), max: 6, color: '#34d399' },
        {
            label: 'PM2.5 AVG', value: systemState.avgAqi, max: 400,
            color: systemState.avgAqi > 200 ? '#ef4444' : systemState.avgAqi > 100 ? '#fbbf24' : '#22c55e'
        },
    ];

    return (
        <div>
            {metrics.map(m => (
                <div className="env-metric" key={m.label}>
                    <span className="env-metric-label">{m.label}</span>
                    <div className="env-metric-bar">
                        <div className="env-metric-fill" style={{
                            width: `${Math.min(100, (m.value / m.max) * 100)}%`,
                            background: m.color,
                            boxShadow: `0 0 4px ${m.color}`,
                        }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function Policies({ systemState }) {
    if (!systemState?.stations?.length) return null;
    const worst = systemState.stations.reduce((a, b) => a.aqi > b.aqi ? a : b);
    const policies = worst.policies || [];

    const severityBorder = { critical: 'rgba(239,68,68,0.3)', high: 'rgba(251,191,36,0.3)', moderate: 'rgba(52,211,153,0.15)', low: 'rgba(52,211,153,0.1)' };
    const severityBg = { critical: 'rgba(239,68,68,0.04)', high: 'rgba(251,191,36,0.04)', moderate: 'rgba(52,211,153,0.03)', low: 'transparent' };

    return (
        <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '6px' }}>
                HIGHEST RISK: <span style={{ color: 'var(--accent-emerald)' }}>{worst.name.toUpperCase()}</span>
            </div>
            {policies.slice(0, 5).map((p, i) => (
                <div className="intervention-item" key={i} style={{
                    borderColor: severityBorder[p.severity] || severityBorder.low,
                    background: severityBg[p.severity] || severityBg.low,
                }}>
                    <span className="intervention-icon">{p.icon}</span>
                    <span>{p.text}</span>
                </div>
            ))}
        </div>
    );
}

function CounterfactualBars({ systemState }) {
    if (!systemState?.stations?.length) return null;
    const worst = systemState.stations.reduce((a, b) => a.aqi > b.aqi ? a : b);
    const { originalAqi, predictedAqi, reductionPercent } = worst.intervention;

    return (
        <div className="cf-bars">
            <div className="cf-bar-block" style={{ border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', background: 'rgba(239,68,68,0.03)' }}>
                <div className="cf-bar-label" style={{ color: '#fb7185' }}>NO ACTION</div>
                <div className="cf-bar-track">
                    <div className="cf-bar-fill" style={{
                        width: `${Math.min(100, (originalAqi / 400) * 100)}%`,
                        background: 'linear-gradient(90deg, #fb7185, #ef4444)',
                    }} />
                </div>
            </div>
            <div className="cf-bar-block" style={{ border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', background: 'rgba(34,197,94,0.03)' }}>
                <div className="cf-bar-label" style={{ color: '#22c55e' }}>WITH ACTION</div>
                <div className="cf-bar-track">
                    <div className="cf-bar-fill" style={{
                        width: `${Math.min(100, (predictedAqi / 400) * 100)}%`,
                        background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                    }} />
                </div>
                {reductionPercent > 0 && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#22c55e', marginTop: '3px' }}>
                        ▼ {reductionPercent}%
                    </div>
                )}
            </div>
        </div>
    );
}

function Reasoning({ systemState }) {
    if (!systemState) return null;
    const { avgAqi, avgCoherence, rejectedSources, activeAlerts } = systemState;
    const lines = [];
    if (avgCoherence > 0.7) lines.push('All sources agree — high assessment confidence.');
    else if (avgCoherence > 0.4) lines.push('Partial disagreement — evaluating outliers.');
    else lines.push('⚠ Significant source conflict — trust review in progress.');
    if (rejectedSources > 0) lines.push(`${rejectedSources} source(s) rejected (low confidence).`);
    if (activeAlerts > 0) lines.push(`${activeAlerts} zone(s) above critical threshold.`);
    if (avgAqi > 200) lines.push('Immediate policy intervention recommended.');
    else if (avgAqi > 100) lines.push('Elevated levels — monitoring intensity increased.');
    else lines.push('Environment within acceptable parameters.');

    return (
        <div>
            {lines.map((l, i) => (
                <div className="reasoning-line" key={i}>
                    <span className="reasoning-idx">{String(i + 1).padStart(2, '0')}.</span>{l}
                </div>
            ))}
        </div>
    );
}

export default function IntelligencePanel({ systemState, showIntervention, onToggleIntervention }) {
    return (
        <div className="right-panel" id="intelligence-panel">
            <div className="panel-section">
                <div className="panel-title">Atmospheric State</div>
                <EnvironmentState systemState={systemState} />
            </div>

            <div className="panel-section">
                <div className="panel-title">Counterfactual Analysis</div>
                <div
                    className={`cf-toggle ${showIntervention ? 'active' : ''}`}
                    onClick={onToggleIntervention}
                    id="cf-toggle"
                >
                    <div className={`toggle-pill ${showIntervention ? 'active' : ''}`} />
                    <span>{showIntervention ? 'INTERVENTION ACTIVE' : 'SIMULATE INTERVENTION'}</span>
                </div>
                <CounterfactualBars systemState={systemState} />
            </div>

            <div className="panel-section">
                <div className="panel-title">Active Interventions</div>
                <Policies systemState={systemState} />
            </div>

            <div className="panel-section">
                <div className="panel-title">System Reasoning</div>
                <Reasoning systemState={systemState} />
            </div>
        </div>
    );
}
