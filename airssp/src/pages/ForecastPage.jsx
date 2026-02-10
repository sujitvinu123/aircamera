/**
 * ═══════════════════════════════════════════════════════════════
 * AIRSSP — Forecast Page (Future Analysis)
 * ═══════════════════════════════════════════════════════════════
 * Detailed future analysis with:
 *   - 24-hour AQI predictions per station
 *   - Policy simulations (with vs without intervention)
 *   - Risk evolution timeline
 *   - Thorough explanations of prediction methodology
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useMemo } from 'react';
import { generateSystemState, STATIONS, psiCategory, riskLevel, generatePolicies, simulateIntervention } from '../engine/SimulationEngine';

function aqiColor(aqi) {
    if (aqi <= 50) return '#22c55e';
    if (aqi <= 100) return '#34d399';
    if (aqi <= 150) return '#fbbf24';
    if (aqi <= 200) return '#f97316';
    if (aqi <= 300) return '#fb7185';
    return '#ef4444';
}

export default function ForecastPage() {
    const [selectedStation, setSelectedStation] = useState(STATIONS[0].id);

    // Generate 24-hour forecast for all stations
    const forecast = useMemo(() => {
        const data = [];
        for (let h = 0; h <= 24; h++) {
            const state = generateSystemState(h);
            data.push({ hour: h, ...state });
        }
        return data;
    }, [selectedStation]);

    // Station-specific forecast
    const stationForecast = useMemo(() => {
        return forecast.map(f => {
            const st = f.stations.find(s => s.id === selectedStation) || f.stations[0];
            return { hour: f.hour, aqi: st.aqi, pm25: st.pm25, pm10: st.pm10, temperature: st.temperature, windSpeed: st.windSpeed, risk: riskLevel(st.aqi), category: psiCategory(st.aqi), policies: st.policies, intervention: st.intervention, name: st.name };
        });
    }, [forecast, selectedStation]);

    // Summary stats
    const peakAqi = Math.max(...stationForecast.map(f => f.aqi));
    const peakHour = stationForecast.find(f => f.aqi === peakAqi)?.hour || 0;
    const avgAqi = Math.round(stationForecast.reduce((a, f) => a + f.aqi, 0) / stationForecast.length);
    const highRiskHours = stationForecast.filter(f => f.aqi > 200).length;
    const safestHour = stationForecast.reduce((a, b) => a.aqi < b.aqi ? a : b).hour;

    // Most critical interventions from highest AQI hour
    const worstHourData = stationForecast.find(f => f.hour === peakHour);

    return (
        <div className="page-container">
            {/* Hero */}
            <div className="page-hero fade-in">
                <div className="page-hero-label">Predictive Intelligence Module</div>
                <h1 className="page-hero-title">
                    <span>24-Hour Future</span> Forecast
                </h1>
                <p className="page-hero-desc">
                    The prediction engine uses historical patterns, traffic correlations, and meteorological
                    data to project air quality for the next 24 hours. Each station generates an independent
                    forecast, incorporating rush-hour traffic effects, wind-based pollutant dispersion, and
                    time-of-day atmospheric behavior.
                </p>
            </div>

            <div className="page-content">
                {/* Station Selector */}
                <div className="section fade-in-d1">
                    <div className="section-header"><div className="section-bar" /><h2 className="section-title">Select Monitoring Station</h2></div>
                    <p className="section-desc">
                        Choose a station to view its detailed 24-hour forecast. Each station reflects its
                        unique geographic and traffic conditions. Government stations (emerald) provide the
                        highest-confidence data, while IoT sensors (amber) and camera feeds (violet) contribute
                        supplementary intelligence.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {STATIONS.map(st => (
                            <button
                                key={st.id}
                                onClick={() => setSelectedStation(st.id)}
                                className={selectedStation === st.id ? 'action-btn primary' : 'action-btn outline'}
                                style={{ fontSize: '9px', padding: '6px 14px' }}
                            >
                                <span style={{
                                    width: '6px', height: '6px', borderRadius: '50%', display: 'inline-block',
                                    background: st.type === 'government' ? '#34d399' : st.type === 'iot' ? '#fbbf24' : '#c084fc',
                                    boxShadow: `0 0 4px ${st.type === 'government' ? '#34d399' : st.type === 'iot' ? '#fbbf24' : '#c084fc'}`,
                                }} />
                                {st.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="section fade-in-d2">
                    <div className="section-header"><div className="section-bar" /><h2 className="section-title">Forecast Summary</h2></div>
                    <p className="section-desc">
                        Key metrics derived from the 24-hour prediction model for <strong>{STATIONS.find(s => s.id === selectedStation)?.name}</strong>.
                        Peak AQI indicates when conditions will be worst, while average AQI reflects overall atmospheric quality.
                    </p>
                    <div className="card-grid-4">
                        <div className="card">
                            <div className="card-label">Peak AQI</div>
                            <div className="card-value" style={{ color: aqiColor(peakAqi) }}>{peakAqi}</div>
                            <div className="card-sub">at hour +{peakHour}</div>
                        </div>
                        <div className="card">
                            <div className="card-label">Avg AQI</div>
                            <div className="card-value" style={{ color: aqiColor(avgAqi) }}>{avgAqi}</div>
                            <div className="card-sub">{psiCategory(avgAqi)}</div>
                        </div>
                        <div className="card">
                            <div className="card-label">High Risk Hours</div>
                            <div className="card-value" style={{ color: highRiskHours > 0 ? '#fb7185' : '#22c55e' }}>{highRiskHours}</div>
                            <div className="card-sub">of 24 total</div>
                        </div>
                        <div className="card">
                            <div className="card-label">Best Hour</div>
                            <div className="card-value" style={{ color: '#22c55e' }}>+{safestHour}H</div>
                            <div className="card-sub">lowest predicted AQI</div>
                        </div>
                    </div>
                </div>

                {/* Forecast Chart */}
                <div className="section fade-in-d3">
                    <div className="section-header"><div className="section-bar" /><h2 className="section-title">Hourly AQI Projection</h2></div>
                    <p className="section-desc">
                        Each bar represents the predicted AQI for one hour into the future. Color indicates
                        severity — green (safe), amber (moderate), orange (unhealthy), rose (very unhealthy),
                        red (hazardous). Taller bars indicate worse air quality conditions.
                    </p>
                    <div className="forecast-chart-area">
                        <div className="forecast-bar-container">
                            {stationForecast.map((f, i) => {
                                const maxH = Math.max(...stationForecast.map(x => x.aqi), 100);
                                const pct = (f.aqi / maxH) * 100;
                                return (
                                    <div className="forecast-bar-wrapper" key={i}>
                                        <div className="forecast-bar-val">{f.aqi}</div>
                                        <div className="forecast-bar" style={{ height: `${pct}%`, background: aqiColor(f.aqi), opacity: 0.85 }} />
                                        <div className="forecast-hour">{f.hour === 0 ? 'NOW' : `+${f.hour}`}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Counterfactual — What happens with vs without intervention */}
                <div className="section">
                    <div className="section-header"><div className="section-bar" style={{ background: 'var(--accent-amber)' }} /><h2 className="section-title">Counterfactual Simulation</h2></div>
                    <p className="section-desc">
                        This simulation compares two futures: one where <strong>no action is taken</strong>
                        (current trajectory) versus one where <strong>policy interventions are applied</strong>
                        (traffic restrictions, industrial controls, dust suppression). The difference shows the
                        potential impact of timely action.
                    </p>
                    <div className="card-grid-2">
                        <div className="card" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#fb7185', letterSpacing: '1px', marginBottom: '8px' }}>
                                ❌ NO INTERVENTION SCENARIO
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                                If no policy actions are taken, the peak AQI at <strong style={{ color: 'var(--text-primary)' }}>{worstHourData?.name}</strong> station
                                is projected to reach <strong style={{ color: '#ef4444' }}>{worstHourData?.intervention?.originalAqi || peakAqi}</strong>.
                                <br /><br />
                                This corresponds to a <strong style={{ color: aqiColor(peakAqi) }}>{psiCategory(peakAqi)}</strong> classification,
                                which may trigger health advisories for sensitive groups and general population.
                            </div>
                        </div>
                        <div className="card" style={{ borderColor: 'rgba(34,197,94,0.2)' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#22c55e', letterSpacing: '1px', marginBottom: '8px' }}>
                                ✓ WITH INTERVENTION SCENARIO
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                                With traffic restrictions and dust suppression deployed, the predicted AQI drops to
                                <strong style={{ color: '#22c55e' }}> {worstHourData?.intervention?.predictedAqi || Math.round(peakAqi * 0.8)}</strong> —
                                a reduction of approximately <strong style={{ color: '#22c55e' }}>{worstHourData?.intervention?.reductionPercent || 15}%</strong>.
                                <br /><br />
                                This demonstrates the tangible impact of early, data-driven policy action on public
                                health outcomes.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Peak Hour Policies */}
                <div className="section">
                    <div className="section-header"><div className="section-bar" style={{ background: 'var(--accent-rose)' }} /><h2 className="section-title">Recommended Interventions at Peak Hour</h2></div>
                    <p className="section-desc">
                        Based on the predicted conditions at hour +{peakHour}, the following policy interventions
                        are recommended. These are generated by the <strong>Policy Engine</strong>, which considers
                        AQI levels, traffic conditions, and wind speed to determine appropriate response actions.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '600px' }}>
                        {(worstHourData?.policies || []).map((p, i) => {
                            const sColor = p.severity === 'critical' ? '#ef4444' : p.severity === 'high' ? '#fbbf24' : '#34d399';
                            return (
                                <div key={i} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderLeft: `3px solid ${sColor}` }}>
                                    <span style={{ fontSize: '18px' }}>{p.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '12px', fontWeight: 600 }}>{p.text}</div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: sColor, letterSpacing: '1px', textTransform: 'uppercase', marginTop: '2px' }}>
                                            {p.severity} PRIORITY
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Detailed Hourly Table */}
                <div className="section">
                    <div className="section-header"><div className="section-bar" /><h2 className="section-title">Detailed Hourly Breakdown</h2></div>
                    <p className="section-desc">
                        Complete hour-by-hour environmental data including AQI, PM2.5, PM10, temperature,
                        wind speed, and risk classification. Scroll horizontally to view all hours.
                    </p>
                    <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-elevated)' }}>
                                    {['HOUR', 'AQI', 'PM2.5', 'PM10', 'TEMP', 'WIND', 'RISK', 'CATEGORY'].map(h => (
                                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '8px', letterSpacing: '1.5px', borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {stationForecast.map((f, i) => (
                                    <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'transparent', borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{f.hour === 0 ? 'NOW' : `+${f.hour}H`}</td>
                                        <td style={{ padding: '8px 12px', color: aqiColor(f.aqi), fontWeight: 700 }}>{f.aqi}</td>
                                        <td style={{ padding: '8px 12px' }}>{f.pm25}</td>
                                        <td style={{ padding: '8px 12px' }}>{f.pm10}</td>
                                        <td style={{ padding: '8px 12px' }}>{f.temperature}°C</td>
                                        <td style={{ padding: '8px 12px' }}>{f.windSpeed} km/h</td>
                                        <td style={{ padding: '8px 12px' }}>
                                            <span style={{
                                                padding: '2px 6px', borderRadius: '4px', fontSize: '8px', fontWeight: 700,
                                                background: f.risk === 'SEVERE' ? 'rgba(239,68,68,0.12)' : f.risk === 'HIGH' ? 'rgba(251,191,36,0.12)' : f.risk === 'MODERATE' ? 'rgba(52,211,153,0.08)' : 'rgba(52,211,153,0.05)',
                                                color: f.risk === 'SEVERE' ? '#ef4444' : f.risk === 'HIGH' ? '#fbbf24' : f.risk === 'MODERATE' ? '#34d399' : '#22c55e',
                                            }}>
                                                {f.risk}
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px 12px', color: aqiColor(f.aqi) }}>{f.category}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Methodology */}
                <div className="section">
                    <div className="section-header"><div className="section-bar" /><h2 className="section-title">Prediction Methodology</h2></div>
                    <div className="explainer">
                        <div className="explainer-title">🧠 How Predictions Are Generated</div>
                        <div className="explainer-text" style={{ marginBottom: '16px' }}>
                            The prediction engine combines multiple data signals to forecast future air quality:
                        </div>
                        <div className="methodology-steps">
                            <div className="method-step">
                                <div className="method-step-num">1</div>
                                <div className="method-step-content">
                                    <div className="method-step-title">Traffic Pattern Modeling</div>
                                    <div className="method-step-desc">Traffic volume follows predictable daily patterns — rush hours (8-11 AM, 5-8 PM) show 40-80% higher emissions. The model adjusts PM2.5 and PM10 projections based on expected traffic density for each future hour.</div>
                                </div>
                            </div>
                            <div className="method-step">
                                <div className="method-step-num">2</div>
                                <div className="method-step-content">
                                    <div className="method-step-title">Meteorological Influence</div>
                                    <div className="method-step-desc">Wind speed significantly affects pollutant dispersion. When wind exceeds 3 km/h, particulate concentrations can drop 30-40%. Temperature and humidity also affect how pollutants behave in the atmosphere.</div>
                                </div>
                            </div>
                            <div className="method-step">
                                <div className="method-step-num">3</div>
                                <div className="method-step-content">
                                    <div className="method-step-title">Historical Lag Analysis</div>
                                    <div className="method-step-desc">Current conditions influence near-future readings. The model uses temporal lag features — recent AQI values help predict the next few hours, with influence decaying over time.</div>
                                </div>
                            </div>
                            <div className="method-step">
                                <div className="method-step-num">4</div>
                                <div className="method-step-content">
                                    <div className="method-step-title">Policy Impact Simulation</div>
                                    <div className="method-step-desc">The counterfactual engine models what happens when policies are applied: traffic restrictions reduce particulates by 15-20%, dust suppression adds another 10%, and wind augmentation systems can improve dispersion by up to 10%.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Disclaimer */}
                <div className="section">
                    <div className="explainer" style={{ borderColor: 'rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.02)' }}>
                        <div className="explainer-title" style={{ color: 'var(--accent-amber)' }}>⚠ Important Disclaimers</div>
                        <div className="explainer-text">
                            • Predictions are based on simulated historical patterns and probabilistic models. Actual
                            conditions may differ due to unexpected events, weather shifts, or industrial activity.
                            <br /><br />
                            • The policy impact simulation uses estimated reduction factors. Real-world policy
                            effectiveness depends on enforcement, compliance, and local conditions.
                            <br /><br />
                            • This system is designed as a <strong>decision support tool</strong> for government
                            officials. It augments — but does not replace — human judgment and expertise.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
