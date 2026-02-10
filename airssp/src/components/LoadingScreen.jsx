/**
 * AIRSSP — Loading Screen
 */
import React, { useState, useEffect } from 'react';

export default function LoadingScreen({ onComplete }) {
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('INITIALIZING CORE SYSTEMS...');
    const [opacity, setOpacity] = useState(1);

    useEffect(() => {
        const steps = [
            { at: 8, text: 'CONNECTING OPENSTREETMAP TILES...' },
            { at: 18, text: 'LOADING STATION NETWORK...' },
            { at: 30, text: 'INITIALIZING CAMERA PERCEPTION MODULE...' },
            { at: 42, text: 'LOADING DARK CHANNEL PRIOR ENGINE...' },
            { at: 55, text: 'CALIBRATING TRUST ENGINE...' },
            { at: 65, text: 'BUILDING FORECAST MODELS...' },
            { at: 75, text: 'SYNCING TEMPORAL INTELLIGENCE...' },
            { at: 85, text: 'ACTIVATING COUNTERFACTUAL ENGINE...' },
            { at: 95, text: 'SYSTEM READY' },
        ];
        let c = 0;
        const iv = setInterval(() => {
            c += 2;
            setProgress(Math.min(c, 100));
            const step = steps.find(s => s.at <= c && s.at > c - 3);
            if (step) setStatus(step.text);
            if (c >= 100) {
                clearInterval(iv);
                setTimeout(() => { setOpacity(0); setTimeout(onComplete, 500); }, 300);
            }
        }, 30);
        return () => clearInterval(iv);
    }, [onComplete]);

    return (
        <div className="loading-screen" style={{ opacity, transition: 'opacity 0.6s' }}>
            {/* SVG Logo Icon */}
            <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: 'linear-gradient(135deg, #34d399, #2dd4bf)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 40px rgba(52,211,153,0.3)', marginBottom: '20px',
            }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#060a11" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C6.48 2 2 6 2 10.5c0 3.5 3 7 5 8.5l2 2c1 1 2 1 3 1s2 0 3-1l2-2c2-1.5 5-5 5-8.5C22 6 17.52 2 12 2z" />
                    <circle cx="12" cy="10" r="3" />
                    <path d="M12 7v-3M9 10H5M19 10h-4M12 13v3" />
                </svg>
            </div>
            <div className="loading-logo">AIRSSP</div>
            <div className="loading-sub">Advanced Intelligence & Response System for Smart Pollution Prevention</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '14px', minHeight: '14px' }}>
                {status}
            </div>
            <div className="loading-bar" style={{ width: '240px' }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg, #34d399, #2dd4bf)', borderRadius: '1px', transition: 'width 0.15s', width: `${progress}%` }} />
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', marginTop: '8px' }}>{progress}%</div>
        </div>
    );
}
