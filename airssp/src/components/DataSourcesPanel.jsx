/**
 * AIRSSP — Data Sources Panel + Camera Perception (Left Panel)
 */
import React from 'react';
import CameraPerception from './CameraPerception';

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
                    {station.type === 'government' ? '⬢ GOV STATION' :
                        station.type === 'iot' ? '◈ IOT SENSOR' : '◉ CAMERA'}
                </div>
                <div style={{
                    width: '100%', height: '2px', background: 'var(--bg-void)', borderRadius: '1px', marginTop: '3px', overflow: 'hidden',
                }}>
                    <div style={{
                        width: trustWidth, height: '100%', background: trustColor, borderRadius: '1px',
                        transition: 'width 1s ease', boxShadow: `0 0 3px ${trustColor}`,
                    }} />
                </div>
            </div>
        </div>
    );
}

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
        <div style={{ marginBottom: '4px' }}>
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '4px',
            }}>
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

export default function DataSourcesPanel({ systemState }) {
    if (!systemState) return null;
    const { stations, avgCoherence } = systemState;
    const gov = stations.filter(s => s.type === 'government');
    const iot = stations.filter(s => s.type === 'iot');
    const cam = stations.filter(s => s.type === 'camera');

    return (
        <div className="left-panel" id="data-sources-panel">
            {/* Camera Perception — Image Upload */}
            <CameraPerception />

            {/* System Coherence */}
            <div className="panel-section">
                <div className="panel-title">System Coherence</div>
                <CoherenceWave coherence={avgCoherence} />
            </div>

            {/* Gov Stations */}
            <div className="panel-section">
                <div className="panel-title">Government Stations</div>
                {gov.map(s => <SourceNode key={s.id} station={s} />)}
            </div>

            {/* IoT */}
            <div className="panel-section">
                <div className="panel-title">IoT Network</div>
                {iot.map(s => <SourceNode key={s.id} station={s} />)}
            </div>

            {/* Cameras */}
            <div className="panel-section">
                <div className="panel-title">Camera Feeds</div>
                {cam.map(s => <SourceNode key={s.id} station={s} />)}
            </div>
        </div>
    );
}
