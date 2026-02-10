/**
 * AIRSSP — Temporal Navigator + Bottom Bar (Combined)
 */
import React from 'react';

export function TemporalNavigator({ temporalOffset, onTemporalChange }) {
    const h = Math.round(temporalOffset);
    let label = 'NOW';
    let color = 'var(--accent-emerald)';
    if (h < 0) { label = `${Math.abs(h)}H AGO`; color = 'var(--accent-violet)'; }
    else if (h > 0) { label = `+${h}H FUTURE`; color = 'var(--accent-amber)'; }
    const zone = h < -6 ? 'DEEP PAST' : h < 0 ? 'RECENT PAST' : h === 0 ? 'PRESENT' : h < 6 ? 'NEAR FUTURE' : 'PROJECTED FUTURE';

    return (
        <div className="temporal-strip">
            <div className="temporal-label">TEMPORAL</div>
            <input
                type="range" className="temporal-slider" min={-12} max={24} step={1}
                value={temporalOffset} onChange={(e) => onTemporalChange(Number(e.target.value))}
                id="temporal-slider"
            />
            <div className="temporal-value" style={{ color }}>{label}</div>
            <div className="temporal-zone">{zone}</div>
        </div>
    );
}

export function BottomBar({ systemState }) {
    const c = systemState?.avgCoherence || 0;
    const bar = c > 0.7 ? '██████████' : c > 0.4 ? '██████░░░░' : '███░░░░░░░';
    return (
        <div className="bottom-bar" id="bottom-bar">
            <div>
                <span className="classified-tag">CLASSIFIED</span>
                <span style={{ marginLeft: '10px' }}>AIRSSP v1.0 — ENV INTELLIGENCE DIV</span>
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
                <span>COHERENCE: {bar}</span>
                <span>ALERTS: {systemState?.activeAlerts || 0}</span>
                <span>VALID: {(systemState?.stations?.length || 0) - (systemState?.rejectedSources || 0)}/{systemState?.stations?.length || 0}</span>
            </div>
        </div>
    );
}
