/**
 * AIRSSP — System Header (Emerald palette)
 */
import React, { useState, useEffect } from 'react';

export default function SystemHeader({ systemState }) {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fmt = (d) => d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fmtDate = (d) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase();
    const risk = systemState?.systemRisk || 'LOW';
    const dotClass = risk === 'SEVERE' || risk === 'HIGH' ? 'danger' : risk === 'MODERATE' ? 'warn' : 'online';

    return (
        <header className="system-header" id="system-header">
            <div className="system-identity">
                <div className="system-logo">AI</div>
                <div>
                    <div className="system-name">AIRSSP</div>
                    <div className="system-subtitle">Environmental Intelligence Command</div>
                </div>
            </div>
            <div className="system-status">
                <div className="status-indicator">
                    <span className={`status-dot ${dotClass}`} />
                    <span>SYS {risk}</span>
                </div>
                <div className="status-indicator">
                    <span className="status-dot online" />
                    <span>{systemState?.stations?.length || 0} SOURCES</span>
                </div>
                <div className="status-indicator" style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
                    {fmt(time)}
                </div>
                <div className="status-indicator">{fmtDate(time)}</div>
            </div>
        </header>
    );
}
