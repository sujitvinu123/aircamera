/**
 * AIRSSP — Navbar with routing, live clock, proper icon
 */
import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

// Custom shield/atmosphere icon — NOT "AI" text
function LogoIcon() {
    return (
        <svg viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6 2 10.5c0 3.5 3 7 5 8.5l2 2c1 1 2 1 3 1s2 0 3-1l2-2c2-1.5 5-5 5-8.5C22 6 17.52 2 12 2z" />
            <circle cx="12" cy="10" r="3" />
            <path d="M12 7v-3M9 10H5M19 10h-4M12 13v3" />
        </svg>
    );
}

export default function Navbar() {
    const [time, setTime] = useState(new Date());
    useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

    return (
        <nav className="navbar" id="navbar">
            <div className="nav-brand">
                <div className="nav-logo"><LogoIcon /></div>
                <div>
                    <div className="nav-title">AIRSSP</div>
                    <div className="nav-desc">Environmental Intelligence Command</div>
                </div>
            </div>

            <div className="nav-links">
                <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                    Command
                </NavLink>
                <NavLink to="/perception" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /><circle cx="12" cy="10" r="3" /></svg>
                    Perception
                </NavLink>
                <NavLink to="/forecast" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                    Forecast
                </NavLink>
                <NavLink to="/policy" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                    Policy
                </NavLink>
            </div>

            <div className="nav-status">
                <div className="status-pill online">
                    <div className="status-dot-live" />
                    LIVE
                </div>
                <div className="nav-clock">
                    {time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
            </div>
        </nav>
    );
}
