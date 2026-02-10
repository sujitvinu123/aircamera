/**
 * AIRSSP — Dashboard Page (Command Center)
 * Central map with left data sources panel and right intelligence panel
 */
import React, { useState, useEffect, useCallback } from 'react';
import AirspaceMap from '../components/AirspaceMap';
import { generateSystemState } from '../engine/SimulationEngine';

// ── Source Node ──
function SourceNode({ station }) {
    const beaconClass = station.rejected ? 'rejected' : station.type;
    const trustWidth = `${Math.round(station.trust * 100)}%`;
    const trustColor = station.trust > 0.8 ? 'var(--fn-success)' : station.trust > 0.5 ? 'var(--fn-warn)' : 'var(--fn-danger)';
    return (
        <div className="source-node" id={`source-${station.id}`}>
            <div className={`source-beacon ${beaconClass}`} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div className="source-name">
                    {station.name}
                    {station.rejected && <span style={{ color: 'var(--fn-danger)', fontSize: '8px', marginLeft: '4px' }}>REJECTED</span>}
                </div>
                <div className="source-type">
                    {station.type === 'government' ? '⬢ GOV STATION' : station.type === 'iot' ? '◈ IOT SENSOR' : '◉ CAMERA'}
                </div>
                <div style={{ width: '100%', height: '2px', background: 'var(--bg-void)', borderRadius: '1px', marginTop: '3px', overflow: 'hidden' }}>
                    <div style={{ width: trustWidth, height: '100%', background: trustColor, borderRadius: '1px', transition: 'width 1s', boxShadow: `0 0 3px ${trustColor}` }} />
                </div>
            </div>
        </div>
    );
}

// ── Coherence Wave ──
function CoherenceWave({ coherence }) {
    const pts = [];
    for (let i = 0; i <= 50; i++) {
        const x = (i / 50) * 100;
        const chaos = (1 - coherence) * 12;
        const y = 18 + Math.sin(i * 0.3 + Date.now() / 500) * (4 + chaos) + (Math.random() - 0.5) * chaos;
        pts.push(`${x},${y}`);
    }
    const color = coherence > 0.7 ? '#22c55e' : coherence > 0.4 ? '#fbbf24' : '#ef4444';
    const label = coherence > 0.7 ? 'ALIGNED' : coherence > 0.4 ? 'TENSION' : 'CONFLICT';
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '4px' }}>
                <span>SOURCE COHERENCE</span>
                <span style={{ color }}>{label}</span>
            </div>
            <div className="coherence-visual">
                <svg width="100%" height="36" viewBox="0 0 100 36" preserveAspectRatio="none">
                    <path d={`M ${pts.join(' L ')}`} fill="none" stroke={color} strokeWidth="1.5" opacity="0.6" />
                </svg>
            </div>
        </div>
    );
}

// ── Intelligence Right Panel Sections ──
function EnvState({ systemState }) {
    if (!systemState?.stations?.length) return null;
    const avg = (k) => Math.round(systemState.stations.reduce((a, s) => a + s[k], 0) / systemState.stations.length * 10) / 10;
    const aqi = systemState.avgAqi;
    const aqiColor = aqi > 300 ? '#ef4444' : aqi > 200 ? '#fb7185' : aqi > 100 ? '#f97316' : aqi > 50 ? '#fbbf24' : '#22c55e';
    const aqiLabel = aqi > 300 ? 'HAZARDOUS' : aqi > 200 ? 'V.UNHEALTHY' : aqi > 100 ? 'UNHEALTHY' : aqi > 50 ? 'MODERATE' : 'GOOD';
    const metrics = [
        { label: 'TEMPERATURE', value: avg('temperature'), max: 45, color: '#fbbf24' },
        { label: 'HUMIDITY', value: avg('humidity'), max: 100, color: '#38bdf8' },
        { label: 'WIND SPEED', value: avg('windSpeed'), max: 6, color: '#34d399' },
    ];
    return <div>
        {/* Mini Speedometer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px' }}>
            <svg width="180" height="100" viewBox="0 0 180 100">
                {[{ end: 50, color: '#22c55e' }, { end: 100, color: '#fbbf24' }, { end: 200, color: '#f97316' }, { end: 300, color: '#fb7185' }, { end: 500, color: '#ef4444' }].reduce((acc, seg, i, arr) => {
                    const start = i === 0 ? 0 : arr[i - 1].end;
                    const sa = -180 + (start / 500) * 180, ea = -180 + (seg.end / 500) * 180;
                    const r = 65, cx = 90, cy = 90;
                    const x1 = cx + r * Math.cos(sa * Math.PI / 180), y1 = cy + r * Math.sin(sa * Math.PI / 180);
                    const x2 = cx + r * Math.cos(ea * Math.PI / 180), y2 = cy + r * Math.sin(ea * Math.PI / 180);
                    acc.push(<path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} fill="none" stroke={seg.color} strokeWidth="12" opacity="0.15" />);
                    return acc;
                }, [])}
                {(() => {
                    const angle = -180 + Math.min(aqi, 500) / 500 * 180;
                    const r = 65, cx = 90, cy = 90;
                    const x1 = cx + r * Math.cos(-Math.PI), y1 = cy + r * Math.sin(-Math.PI);
                    const x2 = cx + r * Math.cos(angle * Math.PI / 180), y2 = cy + r * Math.sin(angle * Math.PI / 180);
                    const large = (angle + 180) > 180 ? 1 : 0;
                    return <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={aqiColor} strokeWidth="12" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${aqiColor}50)` }} />;
                })()}
                {(() => {
                    const angle = -180 + Math.min(aqi, 500) / 500 * 180;
                    const r = 50, cx = 90, cy = 90;
                    const nx = cx + r * Math.cos(angle * Math.PI / 180), ny = cy + r * Math.sin(angle * Math.PI / 180);
                    return <>
                        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={aqiColor} strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx={cx} cy={cy} r="4" fill={aqiColor} /><circle cx={cx} cy={cy} r="2" fill="var(--bg-void)" />
                    </>;
                })()}
                <text x="90" y="78" textAnchor="middle" fill={aqiColor} fontSize="22" fontWeight="800" fontFamily="JetBrains Mono">{aqi}</text>
                <text x="90" y="92" textAnchor="middle" fill="var(--text-muted)" fontSize="7" fontFamily="JetBrains Mono" letterSpacing="1.5">{aqiLabel}</text>
            </svg>
        </div>
        {metrics.map(m => (
            <div className="env-metric" key={m.label}>
                <span className="env-metric-label">{m.label}</span>
                <div className="env-metric-bar"><div className="env-metric-fill" style={{ width: `${Math.min(100, (m.value / m.max) * 100)}%`, background: m.color, boxShadow: `0 0 4px ${m.color}` }} /></div>
            </div>
        ))}</div>;
}

function Policies({ systemState }) {
    if (!systemState?.stations?.length) return null;
    const worst = systemState.stations.reduce((a, b) => a.aqi > b.aqi ? a : b);
    const severityBorder = { critical: 'rgba(239,68,68,0.3)', high: 'rgba(251,191,36,0.3)', moderate: 'rgba(52,211,153,0.15)', low: 'rgba(52,211,153,0.1)' };
    const severityBg = { critical: 'rgba(239,68,68,0.04)', high: 'rgba(251,191,36,0.04)', moderate: 'rgba(52,211,153,0.03)', low: 'transparent' };
    return (
        <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '6px' }}>
                HIGHEST RISK: <span style={{ color: 'var(--accent-emerald)' }}>{worst.name.toUpperCase()}</span>
            </div>
            {worst.policies.slice(0, 5).map((p, i) => (
                <div className="intervention-item" key={i} style={{ borderColor: severityBorder[p.severity], background: severityBg[p.severity] }}>
                    <span style={{ fontSize: '13px' }}>{p.icon}</span><span>{p.text}</span>
                </div>
            ))}
        </div>
    );
}

function CFBars({ systemState }) {
    if (!systemState?.stations?.length) return null;
    const worst = systemState.stations.reduce((a, b) => a.aqi > b.aqi ? a : b);
    const { originalAqi, predictedAqi, reductionPercent } = worst.intervention;
    return (
        <div className="cf-bars">
            <div className="cf-bar-block" style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.03)' }}>
                <div className="cf-bar-label" style={{ color: '#fb7185' }}>NO ACTION</div>
                <div className="cf-bar-track"><div className="cf-bar-fill" style={{ width: `${Math.min(100, (originalAqi / 400) * 100)}%`, background: 'linear-gradient(90deg,#fb7185,#ef4444)' }} /></div>
            </div>
            <div className="cf-bar-block" style={{ border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.03)' }}>
                <div className="cf-bar-label" style={{ color: '#22c55e' }}>WITH ACTION</div>
                <div className="cf-bar-track"><div className="cf-bar-fill" style={{ width: `${Math.min(100, (predictedAqi / 400) * 100)}%`, background: 'linear-gradient(90deg,#22c55e,#16a34a)' }} /></div>
                {reductionPercent > 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#22c55e', marginTop: '3px' }}>▼ {reductionPercent}%</div>}
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
    return <div>{lines.map((l, i) => <div className="reasoning-line" key={i}><span className="reasoning-idx">{String(i + 1).padStart(2, '0')}.</span>{l}</div>)}</div>;
}

export default function DashboardPage() {
    const [systemState, setSystemState] = useState(null);
    const [temporalOffset, setTemporalOffset] = useState(0);
    const [showCF, setShowCF] = useState(false);

    useEffect(() => { setSystemState(generateSystemState(temporalOffset)); }, [temporalOffset]);
    useEffect(() => { const iv = setInterval(() => setSystemState(generateSystemState(temporalOffset)), 10000); return () => clearInterval(iv); }, [temporalOffset]);

    if (!systemState) return null;
    const { stations, avgCoherence } = systemState;
    const gov = stations.filter(s => s.type === 'government');
    const iot = stations.filter(s => s.type === 'iot');
    const cam = stations.filter(s => s.type === 'camera');

    const tH = Math.round(temporalOffset);
    let tLabel = 'NOW', tCol = 'var(--accent-emerald)';
    if (tH < 0) { tLabel = `${Math.abs(tH)}H AGO`; tCol = 'var(--accent-violet)'; }
    else if (tH > 0) { tLabel = `+${tH}H`; tCol = 'var(--accent-amber)'; }
    const tZone = tH < -6 ? 'DEEP PAST' : tH < 0 ? 'RECENT PAST' : tH === 0 ? 'PRESENT' : tH < 6 ? 'NEAR FUTURE' : 'PROJECTED';

    return (
        <div className="dashboard-layout">
            {/* Left Panel */}
            <div className="dash-left">
                <div className="panel-section"><div className="panel-title">System Coherence</div><CoherenceWave coherence={avgCoherence} /></div>
                <div className="panel-section"><div className="panel-title">Government Stations</div>{gov.map(s => <SourceNode key={s.id} station={s} />)}</div>
                <div className="panel-section"><div className="panel-title">IoT Network</div>{iot.map(s => <SourceNode key={s.id} station={s} />)}</div>
                <div className="panel-section"><div className="panel-title">Camera Feeds</div>{cam.map(s => <SourceNode key={s.id} station={s} />)}</div>
            </div>

            {/* Center — Map */}
            <div className="dash-center">
                <AirspaceMap systemState={systemState} showIntervention={showCF} />
                {/* Temporal bar overlay */}
                <div className="dash-footer">
                    <div className="temporal-strip">
                        <div className="temporal-label">TEMPORAL</div>
                        <input type="range" className="temporal-slider" min={-12} max={24} step={1} value={temporalOffset} onChange={e => setTemporalOffset(Number(e.target.value))} />
                        <div className="temporal-value" style={{ color: tCol }}>{tLabel}</div>
                        <div className="temporal-zone">{tZone}</div>
                    </div>
                    <div className="bottom-status">
                        <span className="classified-tag">CLASSIFIED</span>
                        <span>VALID: {stations.length - (systemState.rejectedSources || 0)}/{stations.length}</span>
                        <span>ALERTS: {systemState.activeAlerts}</span>
                    </div>
                </div>
            </div>

            {/* Right Panel */}
            <div className="dash-right">
                <div className="panel-section"><div className="panel-title">Atmospheric State</div><EnvState systemState={systemState} /></div>
                <div className="panel-section">
                    <div className="panel-title">Counterfactual Analysis</div>
                    <div className={`cf-toggle ${showCF ? 'active' : ''}`} onClick={() => setShowCF(p => !p)}>
                        <div className={`toggle-pill ${showCF ? 'active' : ''}`} />
                        <span>{showCF ? 'INTERVENTION ACTIVE' : 'SIMULATE INTERVENTION'}</span>
                    </div>
                    <CFBars systemState={systemState} />
                </div>
                <div className="panel-section"><div className="panel-title">Active Interventions</div><Policies systemState={systemState} /></div>
                <div className="panel-section"><div className="panel-title">System Reasoning</div><Reasoning systemState={systemState} /></div>
            </div>
        </div>
    );
}
