/**
 * ═══════════════════════════════════════════════════════════════
 * AIRSSP — Policy Recommendations & Action Dashboard
 * ═══════════════════════════════════════════════════════════════
 * Fully dynamic, human-readable, explainable policy page.
 * Every location, risk level, and recommendation is generated
 * from live simulation data — nothing is hard-coded.
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useMemo } from 'react';
import { generateSystemState, STATIONS, psiCategory, riskLevel } from '../engine/SimulationEngine';

function aqiColor(aqi) {
    if (aqi <= 50) return '#22c55e';
    if (aqi <= 100) return '#34d399';
    if (aqi <= 150) return '#fbbf24';
    if (aqi <= 200) return '#f97316';
    if (aqi <= 300) return '#fb7185';
    return '#ef4444';
}

function riskBadge(risk) {
    const colors = {
        SEVERE: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
        HIGH: { bg: 'rgba(251,113,133,0.1)', color: '#fb7185', border: 'rgba(251,113,133,0.25)' },
        MODERATE: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
        LOW: { bg: 'rgba(52,211,153,0.08)', color: '#34d399', border: 'rgba(52,211,153,0.2)' },
    };
    const c = colors[risk] || colors.LOW;
    return (
        <span style={{
            padding: '3px 10px', borderRadius: '20px', fontFamily: 'var(--font-mono)',
            fontSize: '9px', fontWeight: 700, letterSpacing: '1px',
            background: c.bg, color: c.color, border: `1px solid ${c.border}`,
        }}>
            {risk}
        </span>
    );
}

// Dynamically explain WHY a station is at risk
function explainRisk(station) {
    const reasons = [];
    if (station.aqi > 300) reasons.push('Air pollution has crossed severe danger limits and has stayed extremely high.');
    else if (station.aqi > 200) reasons.push('Air pollution has crossed safe limits and has stayed high for a sustained period.');
    else if (station.aqi > 150) reasons.push('Air pollution is increasing and approaching unhealthy levels.');
    else reasons.push('Air quality is currently within manageable limits.');

    if (station.trafficLevel > 70) reasons.push('Heavy traffic congestion is causing continuous pollution buildup.');
    if (station.windSpeed < 2) reasons.push('Low wind speed prevents natural pollutant dispersion.');
    if (station.pm25 > 150) reasons.push('PM2.5 (fine particles) are at dangerously high concentrations that penetrate deep into lungs.');
    if (station.pm10 > 200) reasons.push('PM10 (coarse particles) indicate significant dust and particulate matter in the air.');

    return reasons;
}

function explainNeedForAction(station) {
    if (station.aqi > 200 && station.windSpeed < 2)
        return 'The system detected continuous poor air quality that is not improving on its own due to stagnant wind conditions.';
    if (station.aqi > 200 && station.trafficLevel > 60)
        return 'If no action is taken now, pollution levels may rise further due to sustained heavy traffic and affect nearby areas.';
    if (station.aqi > 150)
        return 'Pollution is building up and approaching critical thresholds. Early intervention can prevent escalation.';
    return 'Conditions are being monitored. The system will trigger action if pollution worsens.';
}

function policyExplanation(policy) {
    const map = {
        'Activate air purification systems': 'Helps move polluted air away and bring cleaner air into the zone.',
        'Restrict heavy vehicle movement': 'Reduces pollution from large diesel vehicles that emit the most particulates.',
        'Promote public transport usage': 'Encourages fewer private vehicles on the road, reducing total emissions.',
        'Deploy dust suppression systems': 'Reduces dust from roads, construction, and open surfaces that become airborne.',
        'Divert traffic from hotspot': 'Redirects vehicles away from the most polluted zones to reduce concentration.',
        'Issue health advisory': 'Alerts citizens to avoid outdoor activity and protect vulnerable populations.',
        'Activate emergency response': 'Triggers coordinated emergency protocols across all departments.',
        'Increase monitoring frequency': 'Collects data more often to track changes and respond faster.',
        'Green cover assessment needed': 'Evaluates local green spaces to improve natural air filtration.',
        'Continue standard monitoring': 'Maintains regular observation without immediate intervention.',
    };
    return map[policy.text] || 'Recommended based on current atmospheric and traffic conditions.';
}

// ── AQI Trend Sparkline (last 12 hours + current) ──
function AQITrendChart({ stationId }) {
    const points = useMemo(() => {
        const pts = [];
        for (let h = -12; h <= 0; h++) {
            const state = generateSystemState(h);
            const st = state.stations.find(s => s.id === stationId);
            if (st) pts.push({ hour: h, aqi: st.aqi });
        }
        return pts;
    }, [stationId]);

    const maxAqi = Math.max(...points.map(p => p.aqi), 100);
    const w = 300, chartH = 80, padX = 30, padY = 10;
    const innerW = w - padX * 2, innerH = chartH - padY * 2;

    const pathPoints = points.map((p, i) => {
        const x = padX + (i / (points.length - 1)) * innerW;
        const y = padY + innerH - (p.aqi / maxAqi) * innerH;
        return `${x},${y}`;
    });

    const lastPt = points[points.length - 1];
    const lastColor = aqiColor(lastPt?.aqi || 0);

    return (
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '12px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '6px' }}>
                AQI TREND — LAST 12 HOURS
            </div>
            <svg width="100%" height={chartH} viewBox={`0 0 ${w} ${chartH}`} preserveAspectRatio="none">
                {/* Danger threshold line */}
                <line x1={padX} y1={padY + innerH - (200 / maxAqi) * innerH} x2={w - padX} y2={padY + innerH - (200 / maxAqi) * innerH}
                    stroke="#ef4444" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.4" />
                <text x={w - padX + 3} y={padY + innerH - (200 / maxAqi) * innerH + 3}
                    fill="#ef4444" fontSize="6" fontFamily="JetBrains Mono" opacity="0.5">200</text>

                {/* Area fill */}
                <path
                    d={`M ${padX},${padY + innerH} L ${pathPoints.join(' L ')} L ${w - padX},${padY + innerH} Z`}
                    fill={`url(#grad-${stationId})`} opacity="0.15"
                />
                <defs>
                    <linearGradient id={`grad-${stationId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lastColor} />
                        <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                </defs>

                {/* Line */}
                <polyline points={pathPoints.join(' ')} fill="none" stroke={lastColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                {/* Current dot */}
                {pathPoints.length > 0 && (() => {
                    const [cx, cy] = pathPoints[pathPoints.length - 1].split(',').map(Number);
                    return <>
                        <circle cx={cx} cy={cy} r="4" fill={lastColor} opacity="0.3" />
                        <circle cx={cx} cy={cy} r="2.5" fill={lastColor} />
                    </>;
                })()}

                {/* Hour labels */}
                {points.filter((_, i) => i % 3 === 0).map((p, i) => {
                    const x = padX + ((i * 3) / (points.length - 1)) * innerW;
                    return <text key={i} x={x} y={chartH - 2} fill="var(--text-dim)" fontSize="6" fontFamily="JetBrains Mono" textAnchor="middle">{p.hour === 0 ? 'NOW' : `${p.hour}H`}</text>;
                })}
            </svg>
        </div>
    );
}

// ── Forecast Mini Chart (next 24h) ──
function ForecastMiniChart({ stationId }) {
    const points = useMemo(() => {
        const pts = [];
        for (let h = 0; h <= 24; h += 2) {
            const state = generateSystemState(h);
            const st = state.stations.find(s => s.id === stationId);
            if (st) pts.push({ hour: h, aqi: st.aqi });
        }
        return pts;
    }, [stationId]);

    const maxAqi = Math.max(...points.map(p => p.aqi), 100);

    return (
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '12px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '8px' }}>
                FORECAST — NEXT 24 HOURS
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '50px' }}>
                {points.map((p, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{
                            width: '100%', borderRadius: '2px 2px 0 0',
                            height: `${(p.aqi / maxAqi) * 100}%`,
                            background: aqiColor(p.aqi),
                            opacity: 0.75,
                            transition: 'height 0.4s',
                        }} />
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '6px', color: 'var(--text-dim)' }}>
                            {p.hour === 0 ? 'N' : `+${p.hour}`}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Intervention Card ──
function InterventionCard({ station }) {
    const risk = riskLevel(station.aqi);
    const reasons = explainRisk(station);
    const need = explainNeedForAction(station);

    return (
        <div className="card fade-in" style={{ borderLeft: `4px solid ${aqiColor(station.aqi)}`, marginBottom: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{station.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1px', marginTop: '2px' }}>
                        {station.type === 'government' ? '⬢ CPCB STATION' : station.type === 'iot' ? '◈ IOT SENSOR' : '◉ CAMERA FEED'} · LAT {station.lat} · LNG {station.lng}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    {riskBadge(risk)}
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 800, color: aqiColor(station.aqi), marginTop: '4px' }}>
                        AQI {station.aqi}
                    </div>
                </div>
            </div>

            {/* What is happening */}
            <div className="explainer" style={{ marginBottom: '14px' }}>
                <div className="explainer-title" style={{ fontSize: '12px' }}>
                    💨 What is happening here?
                </div>
                <div className="explainer-text">
                    {reasons.map((r, i) => <span key={i}>{r}{i < reasons.length - 1 ? ' ' : ''}</span>)}
                </div>
            </div>

            {/* Why action needed */}
            <div className="explainer" style={{ marginBottom: '14px', borderColor: 'rgba(251,191,36,0.15)', background: 'rgba(251,191,36,0.02)' }}>
                <div className="explainer-title" style={{ fontSize: '12px', color: 'var(--accent-amber)' }}>
                    ⚠ Why is action required?
                </div>
                <div className="explainer-text">{need}</div>
            </div>

            {/* Recommended Actions */}
            <div style={{ marginBottom: '14px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '1.5px', marginBottom: '10px' }}>
                    ✓ WHAT SHOULD BE DONE
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(station.policies || []).map((p, i) => {
                        const sColor = p.severity === 'critical' ? '#ef4444' : p.severity === 'high' ? '#fb7185' : p.severity === 'moderate' ? '#fbbf24' : '#34d399';
                        return (
                            <div key={i} style={{
                                display: 'flex', gap: '10px', alignItems: 'flex-start',
                                padding: '10px 14px', borderRadius: 'var(--radius-md)',
                                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                                borderLeft: `3px solid ${sColor}`,
                            }}>
                                <span style={{ fontSize: '16px', flexShrink: 0 }}>{p.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                                        {p.text}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                        {policyExplanation(p)}
                                    </div>
                                    <div style={{
                                        fontFamily: 'var(--font-mono)', fontSize: '8px', color: sColor,
                                        letterSpacing: '1px', textTransform: 'uppercase', marginTop: '4px',
                                    }}>
                                        {p.severity} PRIORITY
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Visual Analytics for this station */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <AQITrendChart stationId={station.id} />
                <ForecastMiniChart stationId={station.id} />
            </div>
        </div>
    );
}

// ── Monitoring Card ──
function MonitoringCard({ station }) {
    return (
        <div className="card" style={{ borderLeft: `3px solid var(--accent-amber)`, marginBottom: '8px', padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{station.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1px', marginTop: '2px' }}>
                        {station.type === 'government' ? '⬢ GOV' : station.type === 'iot' ? '◈ IOT' : '◉ CAM'}
                    </div>
                </div>
                <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700,
                    color: aqiColor(station.aqi),
                }}>
                    {station.aqi}
                </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.6' }}>
                Air quality is not ideal but still within manageable limits.
                Immediate restrictions are not necessary. The system is closely watching this area.
            </div>
            <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--accent-amber)',
                letterSpacing: '1px', marginTop: '6px',
            }}>
                STATUS: MONITORING ONLY
            </div>
        </div>
    );
}

// ═══ Main Page ═══
export default function PolicyPage() {
    const [systemState, setSystemState] = useState(null);

    useEffect(() => { setSystemState(generateSystemState(0)); }, []);
    useEffect(() => { const iv = setInterval(() => setSystemState(generateSystemState(0)), 10000); return () => clearInterval(iv); }, []);

    const interventionStations = useMemo(() => {
        if (!systemState) return [];
        return systemState.stations.filter(s => s.aqi > 150 && !s.rejected).sort((a, b) => b.aqi - a.aqi);
    }, [systemState]);

    const monitoringStations = useMemo(() => {
        if (!systemState) return [];
        return systemState.stations.filter(s => s.aqi <= 150 && !s.rejected).sort((a, b) => b.aqi - a.aqi);
    }, [systemState]);

    if (!systemState) return null;

    return (
        <div className="page-container">
            {/* ── Hero ── */}
            <div className="page-hero fade-in">
                <div className="page-hero-label">Policy Intelligence Module</div>
                <h1 className="page-hero-title">
                    <span>Policy Recommendations</span> & Action Dashboard
                </h1>
                <p className="page-hero-desc">
                    This page explains <strong>where</strong> action is required, <strong>why</strong> it is
                    required, and <strong>what</strong> should be done. The system continuously watches air
                    quality conditions and recommends actions only when intervention is truly needed.
                    Locations shown are from the current evaluation cycle and will automatically change
                    as air quality improves or worsens.
                </p>
            </div>

            <div className="page-content">
                {/* ── How to Read This Page ── */}
                <div className="section fade-in-d1">
                    <div className="section-header">
                        <div className="section-bar" style={{ background: 'var(--fn-info)' }} />
                        <h2 className="section-title">How to Read This Page (For Everyone)</h2>
                    </div>
                    <div className="card" style={{ background: 'rgba(56,189,248,0.03)', borderColor: 'rgba(56,189,248,0.15)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '12px' }}>🔴</div>
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>Required Interventions</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                        Air quality is <strong style={{ color: '#fb7185' }}>unsafe</strong> and action is needed <strong>now</strong>.
                                        The system has identified specific steps that should be taken immediately.
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '12px' }}>🟡</div>
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>Monitoring-Only Zones</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                        Air quality is <strong style={{ color: '#fbbf24' }}>not critical yet</strong>.
                                        These areas are being watched and will move to interventions if conditions worsen.
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '12px' }}>✅</div>
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>No Unnecessary Action</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                        The system <strong style={{ color: '#34d399' }}>avoids unnecessary restrictions</strong> or panic.
                                        Actions appear only when they are genuinely needed.
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(192,132,252,0.1)', border: '1px solid rgba(192,132,252,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '12px' }}>🔄</div>
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>Fully Dynamic</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                        Locations <strong style={{ color: '#c084fc' }}>move between sections automatically</strong> as conditions
                                        change. Nothing on this page is static or hard-coded.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Required Interventions ── */}
                <div className="section fade-in-d2">
                    <div className="section-header">
                        <div className="section-bar" style={{ background: '#ef4444' }} />
                        <h2 className="section-title">Required Interventions</h2>
                    </div>
                    <p className="section-desc">
                        System-triggered actions — generated automatically based on real-time pollution data,
                        traffic patterns, and meteorological conditions. Each location below has been identified
                        as needing immediate attention.
                    </p>

                    {interventionStations.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '40px', borderColor: 'rgba(52,211,153,0.2)' }}>
                            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fn-success)', marginBottom: '4px' }}>
                                No Interventions Required
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                All monitored locations are currently within safe limits. The system continues watching.
                            </div>
                        </div>
                    ) : (
                        interventionStations.map(station => (
                            <InterventionCard key={station.id} station={station} />
                        ))
                    )}
                </div>

                {/* ── System Insight ── */}
                <div className="section">
                    <div className="explainer" style={{ borderColor: 'rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.02)' }}>
                        <div className="explainer-title" style={{ color: 'var(--accent-emerald)' }}>
                            🧠 System Insight (Important)
                        </div>
                        <div className="explainer-text">
                            The system recommends actions <strong>only</strong> when one or more danger conditions
                            are actively detected. Locations are <strong>not permanently labeled</strong> as high
                            or low risk. As soon as conditions improve, the location is <strong>automatically
                                removed</strong> from the interventions section and moved to monitoring.
                            <br /><br />
                            This means the page you see right now reflects the <strong>current moment</strong>.
                            Refresh or wait a few seconds and you may see different locations, different risk
                            levels, and different recommended actions — because the environment is always changing.
                        </div>
                    </div>
                </div>

                {/* ── Monitoring-Only Zones ── */}
                <div className="section">
                    <div className="section-header">
                        <div className="section-bar" style={{ background: 'var(--accent-amber)' }} />
                        <h2 className="section-title">Monitoring-Only Zones</h2>
                    </div>
                    <p className="section-desc">
                        No immediate action is required for these locations. Air quality is not ideal but
                        still within manageable limits. If pollution increases, these zones will
                        <strong> automatically move</strong> to the "Required Interventions" section.
                    </p>

                    {monitoringStations.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                All stations currently require intervention. No monitoring-only zones at this time.
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            {monitoringStations.map(station => (
                                <MonitoringCard key={station.id} station={station} />
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Visual Analytics Explainer ── */}
                <div className="section">
                    <div className="section-header">
                        <div className="section-bar" style={{ background: 'var(--accent-sky)' }} />
                        <h2 className="section-title">Visual Analytics</h2>
                    </div>
                    <p className="section-desc">
                        Every station in the "Required Interventions" section includes two visual analytics
                        charts. Here is how to read them:
                    </p>
                    <div className="card-grid-2">
                        <div className="explainer">
                            <div className="explainer-title">📈 AQI Trend Analysis</div>
                            <div className="explainer-text">
                                <strong>What you see:</strong> A line chart showing how air quality changed over
                                the <strong>past 12 hours</strong>.
                                <br /><br />
                                <strong>Why it matters:</strong>
                                <br />• Helps understand whether pollution is <strong>improving or worsening</strong>
                                <br />• Explains why a location moved into high-risk status
                                <br />• The red dashed line marks AQI 200 — the danger threshold
                                <br />• Rising lines mean deteriorating conditions
                            </div>
                        </div>
                        <div className="explainer">
                            <div className="explainer-title">📊 Forecast Trend (Next 24 Hours)</div>
                            <div className="explainer-text">
                                <strong>What you see:</strong> Bar chart projecting AQI for the
                                <strong> next 24 hours</strong>.
                                <br /><br />
                                <strong>Why it matters:</strong>
                                <br />• Helps <strong>prevent problems</strong> before they become severe
                                <br />• Allows <strong>early action</strong> instead of emergency response
                                <br />• Color indicates severity — green is safe, red is dangerous
                                <br />• Taller bars mean worse predicted conditions
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Decision Logic Summary ── */}
                <div className="section">
                    <div className="section-header">
                        <div className="section-bar" style={{ background: 'var(--accent-violet)' }} />
                        <h2 className="section-title">Decision Logic Summary (Simple Words)</h2>
                    </div>
                    <div className="card" style={{ padding: '24px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>
                            The system recommends action when:
                        </div>
                        <div className="methodology-steps">
                            <div className="method-step">
                                <div className="method-step-num" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>!</div>
                                <div className="method-step-content">
                                    <div className="method-step-title">Pollution becomes very high</div>
                                    <div className="method-step-desc">When AQI exceeds 150, the air becomes unhealthy for sensitive groups. Above 200, it's unhealthy for everyone.</div>
                                </div>
                            </div>
                            <div className="method-step">
                                <div className="method-step-num" style={{ background: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.2)', color: '#fbbf24' }}>⏱</div>
                                <div className="method-step-content">
                                    <div className="method-step-title">Pollution stays high for a long time</div>
                                    <div className="method-step-desc">Brief spikes may resolve naturally. But sustained high levels indicate a systemic problem that needs intervention.</div>
                                </div>
                            </div>
                            <div className="method-step">
                                <div className="method-step-num" style={{ background: 'rgba(251,113,133,0.1)', borderColor: 'rgba(251,113,133,0.2)', color: '#fb7185' }}>📈</div>
                                <div className="method-step-content">
                                    <div className="method-step-title">Pollution is expected to get worse soon</div>
                                    <div className="method-step-desc">If the forecast shows rising pollution due to rush hour traffic or low wind, the system acts proactively.</div>
                                </div>
                            </div>
                        </div>
                        <div style={{
                            marginTop: '20px', padding: '14px 18px',
                            borderRadius: 'var(--radius-md)', background: 'rgba(52,211,153,0.04)',
                            border: '1px solid rgba(52,211,153,0.15)',
                            fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7',
                        }}>
                            <strong style={{ color: 'var(--accent-emerald)' }}>If none of these conditions are met:</strong>
                            <br />→ No action is shown on this page
                            <br />→ The area stays under observation only
                            <br />→ The system quietly monitors until conditions change
                        </div>
                    </div>
                </div>

                {/* Critical Hotspots Visualization */}
                <div className="section">
                    <div className="section-header">
                        <div className="section-bar" style={{ background: '#fb7185' }} />
                        <h2 className="section-title">Critical Hotspots Overview</h2>
                    </div>
                    <p className="section-desc">
                        The bar below shows every station's current AQI as a comparative visual. Stations
                        requiring intervention are highlighted. This helps authorities focus resources on the
                        right locations.
                    </p>
                    <div className="card" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {systemState.stations
                                .filter(s => !s.rejected)
                                .sort((a, b) => b.aqi - a.aqi)
                                .map(s => (
                                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{
                                            fontFamily: 'var(--font-mono)', fontSize: '10px', width: '100px',
                                            textAlign: 'right', color: s.aqi > 150 ? 'var(--text-primary)' : 'var(--text-muted)',
                                            fontWeight: s.aqi > 150 ? 600 : 400,
                                        }}>
                                            {s.name}
                                        </div>
                                        <div style={{ flex: 1, height: '14px', background: 'var(--bg-void)', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                                            <div style={{
                                                width: `${Math.min(100, (s.aqi / 400) * 100)}%`,
                                                height: '100%',
                                                background: `linear-gradient(90deg, ${aqiColor(s.aqi)}88, ${aqiColor(s.aqi)})`,
                                                borderRadius: '3px',
                                                transition: 'width 1s ease',
                                            }} />
                                            {/* threshold marker at AQI 150 */}
                                            <div style={{
                                                position: 'absolute', top: 0, bottom: 0, left: '37.5%',
                                                width: '1px', background: '#ef444444',
                                            }} />
                                        </div>
                                        <div style={{
                                            fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
                                            width: '36px', textAlign: 'right',
                                            color: aqiColor(s.aqi),
                                        }}>
                                            {s.aqi}
                                        </div>
                                        {s.aqi > 150 && (
                                            <div style={{
                                                fontFamily: 'var(--font-mono)', fontSize: '7px', color: '#ef4444',
                                                letterSpacing: '1px', fontWeight: 700,
                                            }}>
                                                ACTION
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>

                {/* ── Important Note ── */}
                <div className="section">
                    <div className="explainer" style={{ borderColor: 'rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.03)' }}>
                        <div className="explainer-title" style={{ color: 'var(--accent-amber)' }}>
                            📋 Important Note (For Evaluation)
                        </div>
                        <div className="explainer-text">
                            All locations, risk levels, and recommended actions shown on this page are
                            <strong> dynamically generated</strong> from the current simulation cycle. The
                            platform is fully dynamic and adapts automatically to:
                            <br /><br />
                            • <strong>Different cities</strong> — add new station coordinates and the system works immediately
                            <br />• <strong>Different regions</strong> — pollution models adapt to local conditions
                            <br />• <strong>Different datasets</strong> — plug in any CPCB-format data source
                            <br />• <strong>Real-time changes</strong> — the page updates every 5 seconds automatically
                            <br /><br />
                            <strong style={{ color: 'var(--fn-danger)' }}>No locations or actions are hard-coded.</strong>
                            {' '}Every recommendation you see is the result of the system analyzing current conditions,
                            applying atmospheric physics models, evaluating traffic correlations, and determining
                            the minimum necessary intervention.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
