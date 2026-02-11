/**
 * ═══════════════════════════════════════════════════════════════
 * AIRSSP — Advanced Simulation Alert Engine
 * ═══════════════════════════════════════════════════════════════
 *
 * Adaptive, trend-aware environmental risk signaling engine.
 * NOT threshold-only — implements multi-level, state-aware alerting.
 *
 * Features:
 *   - AQI simulation with realistic patterns (normal, gradual rise,
 *     sudden spike, sustained high, recovery)
 *   - 4-level alert system (Safe / Advisory / Health Warning / Severe)
 *   - Anti-spam: cooldown, deduplication, persistence checks
 *   - Recovery notifications with exposure duration
 *   - Twilio SMS + WhatsApp delivery
 *   - Full decision log with reasoning
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════
const STATION_NAME = 'Perungudi Station';
const CYCLE_INTERVAL = 10000; // 10 seconds
const COOLDOWN_MS = 120000;   // 2 minutes cooldown between alerts
const ESCALATION_PERSISTENCE = 2;  // consecutive cycles above threshold to escalate
const DEESCALATION_PERSISTENCE = 3; // consecutive cycles below threshold to de-escalate
const RAPID_RISE_THRESHOLD = 40;    // AQI rise in 20s (2 cycles) triggers immediate escalation
const MAX_LOG_ENTRIES = 100;
const MAX_HISTORY = 60;

// AQI severity bands
const BANDS = [
    { level: 0, label: 'Safe', min: 0, max: 50, color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
    { level: 1, label: 'Advisory', min: 51, max: 100, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
    { level: 2, label: 'Health Warning', min: 101, max: 200, color: '#f97316', bg: 'rgba(249,115,22,0.08)' },
    { level: 3, label: 'Severe Exposure', min: 201, max: 500, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
];

function getBand(aqi) {
    return BANDS.find(b => aqi >= b.min && aqi <= b.max) || BANDS[3];
}

function trendLabel(delta) {
    if (delta > 3) return '↑ Rising';
    if (delta < -3) return '↓ Falling';
    return '→ Stable';
}

function trendColor(delta) {
    if (delta > 3) return '#ef4444';
    if (delta < -3) return '#22c55e';
    return '#fbbf24';
}

function formatTime(d) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}m ${rem}s`;
}

// ═══════════════════════════════════════════════════
// AQI SIMULATION ENGINE — Enhanced Realistic Model
// ═══════════════════════════════════════════════════
//
// The 'realistic' scenario uses mean-reversion with random events:
//   - Base AQI gravitates around 55 (safe zone)
//   - Natural drift ±8 per cycle (wind, traffic fluctuation)
//   - ~6% chance per cycle of a "pollution event" (industrial
//     discharge, traffic jam, burning) that adds 120-220 AQI
//   - After a spike, AQI decays back naturally at 8-15% per cycle
//   - Occasionally drifts into advisory (100+) zone naturally
//   - Above 200 is RARE but happens — exactly for alert testing
//
const _spikeActive = { value: false, magnitude: 0, decayRate: 0 };

function simulateAQI(prev, cycle, scenario) {
    const noise = () => (Math.random() - 0.5) * 10;
    const smallNoise = () => (Math.random() - 0.5) * 6;

    switch (scenario) {
        case 'normal':
            // Gentle fluctuation in safe zone, mean-revert to 45
            return Math.max(15, Math.min(80, prev + (45 - prev) * 0.05 + smallNoise()));

        case 'gradual_rise':
            // Slow, steady climb simulating worsening conditions
            return Math.max(15, Math.min(380, prev + 2.5 + smallNoise() * 0.4));

        case 'sudden_spike':
            // Mostly calm, but every ~5 cycles a sharp spike
            if (cycle % 5 === 0) return Math.min(420, prev + 100 + Math.random() * 60);
            // Between spikes, slow decay
            return Math.max(15, prev * 0.92 + smallNoise());

        case 'sustained_high':
            // Hovers in unhealthy zone (180-280) with small wobble
            return Math.max(160, Math.min(310, 230 + (Math.random() - 0.5) * 30));

        case 'recovery':
            // Steady decline back to safe
            return Math.max(15, prev * 0.88 + smallNoise());

        case 'realistic': {
            // ═══ REALISTIC MODEL ═══
            // This is the primary scenario — behaves like a real city's AQI.
            //
            // 1. Mean-reversion: AQI naturally drifts toward baseline (~55)
            // 2. Random walk: ±8 noise simulates wind/traffic changes
            // 3. Rare pollution events: ~6% chance of spike (adds 120-220)
            // 4. Post-spike decay: exponential decay back to baseline
            // 5. Moderate drift: ~15% chance of drifting into advisory (80-120)

            const baseline = 55;
            const meanReversionStrength = 0.06; // How fast it returns to baseline
            let next = prev;

            // Check if we're in a spike decay phase
            if (_spikeActive.value) {
                // Decay the spike — AQI drops by 8-15% per cycle
                const decay = next * _spikeActive.decayRate;
                next = next - decay + smallNoise();

                // End spike when we're back near baseline + some margin
                if (next < baseline + 30) {
                    _spikeActive.value = false;
                    _spikeActive.magnitude = 0;
                }
            } else {
                // Normal state: mean-revert with random walk
                const pull = (baseline - next) * meanReversionStrength;
                const walk = (Math.random() - 0.48) * 16; // slightly positive bias for realism
                next = next + pull + walk;

                // ~6% chance of a sudden pollution event (spike above 200)
                if (Math.random() < 0.06) {
                    const spikeMag = 130 + Math.random() * 100; // adds 130-230
                    next = next + spikeMag;
                    _spikeActive.value = true;
                    _spikeActive.magnitude = spikeMag;
                    _spikeActive.decayRate = 0.08 + Math.random() * 0.07; // 8-15% decay per cycle
                }

                // ~15% chance of moderate drift upward (advisory zone)
                if (!_spikeActive.value && Math.random() < 0.15) {
                    next = next + 15 + Math.random() * 20; // push toward 80-120
                }
            }

            return Math.max(15, Math.min(450, Math.round(next)));
        }

        default:
            return Math.max(15, Math.min(350, prev + noise()));
    }
}

// ═══════════════════════════════════════════════════
// ALERT MESSAGE GENERATOR
// ═══════════════════════════════════════════════════
function generateAlertMessage(level, aqi, trend, band, timestamp, exposureDuration) {
    const ts = formatTime(timestamp);
    const trendStr = trendLabel(trend);
    const base = `🏭 ${STATION_NAME}\n📅 ${ts}\n📊 AQI: ${Math.round(aqi)} (${band.label})\n📈 Trend: ${trendStr}`;

    if (level === 0 && exposureDuration) {
        return `${base}\n\n✅ AIR QUALITY RECOVERED\n\nAir quality has returned to safe levels after ${formatDuration(exposureDuration)} of elevated pollution.\n\n🫁 Health Note: Resume normal outdoor activities. Stay hydrated.\n🔔 Alert Level: SAFE — Monitoring continues.`;
    }
    if (level === 1) {
        return `${base}\n\n⚠️ ADVISORY ALERT\n\nAir quality is worsening and approaching unhealthy levels. Sensitive groups should take precaution.\n\n🫁 Health Advice: Reduce prolonged outdoor exertion. Close windows if possible.\n🔔 Alert Level: 1 (Advisory)`;
    }
    if (level === 2) {
        return `${base}\n\n🟠 HEALTH WARNING\n\nAir quality is unhealthy. Sustained exposure may cause respiratory irritation.\n\n🫁 Protective Steps:\n• Avoid outdoor exercise\n• Use N95 mask if going outside\n• Keep indoor air purifier running\n🔔 Alert Level: 2 (Health Warning)`;
    }
    if (level === 3) {
        return `${base}\n\n🔴 SEVERE EXPOSURE WARNING\n\nAir quality is VERY UNSAFE. Immediate protective action required for all individuals.\n\n🫁 URGENT STEPS:\n• Stay indoors immediately\n• Seal windows and doors\n• Use wet cloth over nose if no mask\n• Avoid ALL outdoor activity\n• Seek medical help if breathing difficulty\n🔔 Alert Level: 3 (SEVERE)`;
    }
    return base;
}

// ═══════════════════════════════════════════════════
// SPEEDOMETER GAUGE (reused pattern)
// ═══════════════════════════════════════════════════
function AQIGauge({ value, size = 220 }) {
    const band = getBand(value);
    const hSize = size / 2;
    const vSize = Math.round(size * 0.62);
    const r = Math.round(size * 0.38);
    const cx = hSize, cy = Math.round(size * 0.56);
    const segments = [
        { end: 50, color: '#22c55e' }, { end: 100, color: '#fbbf24' },
        { end: 200, color: '#f97316' }, { end: 300, color: '#fb7185' }, { end: 500, color: '#ef4444' },
    ];
    return (
        <svg width={size} height={vSize} viewBox={`0 0 ${size} ${vSize}`}>
            {segments.reduce((acc, seg, i, arr) => {
                const start = i === 0 ? 0 : arr[i - 1].end;
                const sa = -180 + (start / 500) * 180, ea = -180 + (seg.end / 500) * 180;
                const x1 = cx + r * Math.cos(sa * Math.PI / 180), y1 = cy + r * Math.sin(sa * Math.PI / 180);
                const x2 = cx + r * Math.cos(ea * Math.PI / 180), y2 = cy + r * Math.sin(ea * Math.PI / 180);
                acc.push(<path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} fill="none" stroke={seg.color} strokeWidth={size * 0.065} opacity="0.15" />);
                return acc;
            }, [])}
            {(() => {
                const angle = -180 + Math.min(value, 500) / 500 * 180;
                const x1 = cx + r * Math.cos(-Math.PI), y1 = cy + r * Math.sin(-Math.PI);
                const x2 = cx + r * Math.cos(angle * Math.PI / 180), y2 = cy + r * Math.sin(angle * Math.PI / 180);
                const large = (angle + 180) > 180 ? 1 : 0;
                return <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={band.color} strokeWidth={size * 0.065} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${band.color}60)`, transition: 'all 1.5s ease' }} />;
            })()}
            {(() => {
                const angle = -180 + Math.min(value, 500) / 500 * 180;
                const nr = r * 0.72;
                const nx = cx + nr * Math.cos(angle * Math.PI / 180), ny = cy + nr * Math.sin(angle * Math.PI / 180);
                return <>
                    <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={band.color} strokeWidth="2" strokeLinecap="round" style={{ transition: 'all 1.5s ease' }} />
                    <circle cx={cx} cy={cy} r={size * 0.025} fill={band.color} />
                    <circle cx={cx} cy={cy} r={size * 0.012} fill="var(--bg-void)" />
                </>;
            })()}
            <text x={cx} y={cy - size * 0.05} textAnchor="middle" fill={band.color} fontSize={size * 0.16} fontWeight="800" fontFamily="JetBrains Mono" style={{ transition: 'all 1s ease' }}>{Math.round(value)}</text>
            <text x={cx} y={cy + size * 0.06} textAnchor="middle" fill="var(--text-muted)" fontSize={size * 0.045} fontFamily="JetBrains Mono" letterSpacing="2">AQI</text>
        </svg>
    );
}

// ═══════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════
export default function AlertEnginePage() {
    // ── UI Display State (only for triggering re-renders) ──
    const [running, setRunning] = useState(false);
    const [cycle, setCycle] = useState(0);
    const [scenario, setScenario] = useState('realistic');
    const [aqi, setAqi] = useState(42);
    const [prevAqi, setPrevAqi] = useState(42);
    const [trend, setTrend] = useState(0);
    const [history, setHistory] = useState([42]);
    const [alertLevel, setAlertLevel] = useState(0);
    const [prevAlertLevel, setPrevAlertLevel] = useState(0);
    const [persistAbove, setPersistAbove] = useState(0);
    const [persistBelow, setPersistBelow] = useState(0);
    const [lastAlertTime, setLastAlertTime] = useState(null);
    const [exposureStart, setExposureStart] = useState(null);
    const [alertsSent, setAlertsSent] = useState(0);
    const [alertsBlocked, setAlertsBlocked] = useState(0);
    const [decisionLog, setDecisionLog] = useState([]);
    const [alertHistory, setAlertHistory] = useState([]);

    // ── Twilio Config (loaded from environment variables) ──
    const [twilioSid, setTwilioSid] = useState(import.meta.env.VITE_TWILIO_SID || '');
    const [twilioAuth, setTwilioAuth] = useState(import.meta.env.VITE_TWILIO_AUTH || '');
    const [twilioFrom, setTwilioFrom] = useState(import.meta.env.VITE_TWILIO_SMS_FROM || '');
    const [whatsappFrom, setWhatsappFrom] = useState(import.meta.env.VITE_TWILIO_WHATSAPP_FROM || '');
    const [userPhone, setUserPhone] = useState(import.meta.env.VITE_USER_PHONE || '');
    const [twilioEnabled, setTwilioEnabled] = useState(true);
    const [twilioStatus, setTwilioStatus] = useState('');

    // ═══════════════════════════════════════════════════
    // ENGINE REFS — synchronous read/write for tick logic
    // ═══════════════════════════════════════════════════
    // The critical fix: all engine state lives in refs so the tick
    // function can read and write them synchronously without
    // React's setState batching breaking the logic.
    const engineState = useRef({
        aqi: 42,
        prevAqi: 42,
        cycle: 0,
        alertLevel: 0,
        persistAbove: 0,
        persistBelow: 0,
        lastAlertTime: null,
        exposureStart: null,
        alertsSent: 0,
        alertsBlocked: 0,
        aqiTwoCyclesAgo: 42,
        history: [42],
    });

    const intervalRef = useRef(null);
    const logEndRef = useRef(null);
    const startTimeRef = useRef(null);
    const scenarioRef = useRef('realistic');

    // Keep scenario ref in sync
    useEffect(() => { scenarioRef.current = scenario; }, [scenario]);

    // ── Twilio refs (so tick can read latest values) ──
    const twilioRef = useRef({
        enabled: true,
        sid: import.meta.env.VITE_TWILIO_SID || '',
        auth: import.meta.env.VITE_TWILIO_AUTH || '',
        smsFrom: import.meta.env.VITE_TWILIO_SMS_FROM || '',
        waFrom: import.meta.env.VITE_TWILIO_WHATSAPP_FROM || '',
        phone: import.meta.env.VITE_USER_PHONE || '',
    });

    // Keep twilio refs in sync with state
    useEffect(() => {
        twilioRef.current = {
            enabled: twilioEnabled,
            sid: twilioSid,
            auth: twilioAuth,
            smsFrom: twilioFrom,
            waFrom: whatsappFrom,
            phone: userPhone,
        };
    }, [twilioEnabled, twilioSid, twilioAuth, twilioFrom, whatsappFrom, userPhone]);

    // ── Twilio Send Function (uses refs) ──
    const sendTwilioAlert = useCallback(async (message, channel = 'sms') => {
        const tw = twilioRef.current;
        if (!tw.enabled || !tw.sid || !tw.auth || !tw.smsFrom || !tw.phone) {
            setDecisionLog(prev => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), {
                time: new Date(), msg: `[TWILIO] Skipped — credentials not configured`, type: 'info',
            }]);
            return false;
        }
        try {
            const to = channel === 'whatsapp' ? `whatsapp:${tw.phone}` : tw.phone;
            const from = channel === 'whatsapp' ? `whatsapp:${tw.waFrom}` : tw.smsFrom;

            const body = new URLSearchParams({ To: to, From: from, Body: message });
            const res = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${tw.sid}/Messages.json`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + btoa(`${tw.sid}:${tw.auth}`),
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: body.toString(),
                }
            );
            if (res.ok) {
                setDecisionLog(prev => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), {
                    time: new Date(), msg: `[TWILIO] ${channel.toUpperCase()} sent successfully ✓`, type: 'alert',
                }]);
                setTwilioStatus(`✓ ${channel.toUpperCase()} sent at ${formatTime(new Date())}`);
                return true;
            } else {
                const err = await res.text();
                setDecisionLog(prev => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), {
                    time: new Date(), msg: `[TWILIO] ${channel.toUpperCase()} failed: ${err.substring(0, 100)}`, type: 'error',
                }]);
                setTwilioStatus(`✗ Failed — check credentials`);
                return false;
            }
        } catch (e) {
            setDecisionLog(prev => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), {
                time: new Date(), msg: `[TWILIO] ${channel.toUpperCase()} error: ${e.message}`, type: 'error',
            }]);
            setTwilioStatus(`✗ Error — ${e.message.substring(0, 50)}`);
            return false;
        }
    }, []);

    // ═══════════════════════════════════════════════════
    // CORE ENGINE TICK — All ref-based, fully synchronous
    // ═══════════════════════════════════════════════════
    const engineTick = useCallback(() => {
        const s = engineState.current;
        const now = new Date();

        // ── Simulate new AQI ──
        s.cycle += 1;
        const newCycle = s.cycle;
        const currentAqi = s.aqi;
        const newAqi = Math.round(simulateAQI(currentAqi, newCycle, scenarioRef.current));
        const delta = newAqi - currentAqi;
        const twoCycleDelta = newAqi - s.aqiTwoCyclesAgo;
        const currentBand = getBand(newAqi);
        const targetLevel = currentBand.level;

        // Update AQI history
        s.prevAqi = currentAqi;
        s.aqiTwoCyclesAgo = currentAqi;
        s.aqi = newAqi;
        s.history = [...s.history.slice(-(MAX_HISTORY - 1)), newAqi];

        // ── Alert Decision Engine (fully synchronous) ──
        const currentLevel = s.alertLevel;
        let newLevel = currentLevel;
        let decision = '';
        let decisionType = 'info';
        let shouldSendAlert = false;

        // Rapid rise detection: > 40 AQI in 2 cycles (20s)
        const rapidRise = twoCycleDelta > RAPID_RISE_THRESHOLD;

        if (targetLevel > currentLevel) {
            // ── Potential ESCALATION ──
            s.persistBelow = 0;
            s.persistAbove += 1;

            if (rapidRise) {
                // Immediate escalation on rapid rise
                newLevel = targetLevel;
                shouldSendAlert = true;
                decision = `⚡ RAPID RISE DETECTED (+${twoCycleDelta} in 20s) → Immediate escalation to Level ${targetLevel}`;
                decisionType = 'escalate';
            } else if (s.persistAbove >= ESCALATION_PERSISTENCE) {
                // Sustained above threshold
                newLevel = Math.min(currentLevel + 1, 3);
                shouldSendAlert = true;
                decision = `📈 ESCALATION: ${ESCALATION_PERSISTENCE} consecutive cycles above L${targetLevel} band → Level ${currentLevel} → ${newLevel}`;
                decisionType = 'escalate';
                s.persistAbove = 0;
            } else {
                decision = `⏳ AQI ${newAqi} in L${targetLevel} band (${s.persistAbove}/${ESCALATION_PERSISTENCE} cycles for escalation)`;
            }
        } else if (targetLevel < currentLevel) {
            // ── Potential DE-ESCALATION ──
            s.persistAbove = 0;
            s.persistBelow += 1;

            if (s.persistBelow >= DEESCALATION_PERSISTENCE) {
                newLevel = Math.max(currentLevel - 1, 0);
                shouldSendAlert = true;

                if (newLevel === 0 && currentLevel > 0) {
                    decisionType = 'recovery';
                    decision = `✅ RECOVERY: ${DEESCALATION_PERSISTENCE} consecutive cycles below threshold → Level ${currentLevel} → ${newLevel}`;
                } else {
                    decisionType = 'deescalate';
                    decision = `📉 DE-ESCALATION: ${DEESCALATION_PERSISTENCE} cycles below band → Level ${currentLevel} → ${newLevel}`;
                }
                s.persistBelow = 0;
            } else {
                decision = `⏳ AQI ${newAqi} dropping (${s.persistBelow}/${DEESCALATION_PERSISTENCE} cycles for de-escalation)`;
            }
        } else {
            // Same level band
            s.persistAbove = 0;
            s.persistBelow = 0;
            decision = `── AQI ${newAqi} | L${currentLevel} ${currentBand.label} | Trend: ${trendLabel(delta)} (${delta > 0 ? '+' : ''}${delta})`;
        }

        // ── Anti-spam check ──
        if (shouldSendAlert) {
            const cooldownOk = !s.lastAlertTime || (now.getTime() - s.lastAlertTime.getTime() >= COOLDOWN_MS);
            const levelChanged = newLevel !== currentLevel;

            if (!levelChanged) {
                decision += ' | BLOCKED: Same level (no change)';
                decisionType = 'blocked';
                shouldSendAlert = false;
                s.alertsBlocked += 1;
            } else if (!cooldownOk) {
                const remaining = Math.ceil((COOLDOWN_MS - (now.getTime() - s.lastAlertTime.getTime())) / 1000);
                decision += ` | BLOCKED: Cooldown active (${remaining}s remaining)`;
                decisionType = 'blocked';
                shouldSendAlert = false;
                s.alertsBlocked += 1;
            }
        }

        // ── Send alert if qualified ──
        if (shouldSendAlert) {
            let exposureDuration = null;
            if (decisionType === 'recovery' && s.exposureStart) {
                exposureDuration = now.getTime() - s.exposureStart.getTime();
                s.exposureStart = null;
            }
            if (newLevel > 0 && !s.exposureStart) {
                s.exposureStart = now;
            }

            const msg = generateAlertMessage(newLevel, newAqi, delta, getBand(newAqi), now, exposureDuration);

            setAlertHistory(prev => [{
                time: now,
                level: newLevel,
                prevLevel: currentLevel,
                aqi: newAqi,
                trend: delta,
                band: getBand(newAqi),
                message: msg,
                type: decisionType,
                exposureDuration,
            }, ...prev.slice(0, 49)]);

            s.lastAlertTime = now;
            s.alertsSent += 1;
            s.alertLevel = newLevel;

            // Send via Twilio (async, fire-and-forget)
            sendTwilioAlert(msg, 'sms');
            sendTwilioAlert(msg, 'whatsapp');
        } else {
            s.alertLevel = newLevel;
        }

        // ── Decision log entry ──
        const logEntry = { time: now, msg: `[C${newCycle}] ${decision}`, type: decisionType };

        // ── Sync all refs → useState for UI re-render ──
        setCycle(newCycle);
        setAqi(newAqi);
        setPrevAqi(currentAqi);
        setTrend(delta);
        setHistory([...s.history]);
        setAlertLevel(s.alertLevel);
        setPrevAlertLevel(currentLevel);
        setPersistAbove(s.persistAbove);
        setPersistBelow(s.persistBelow);
        setLastAlertTime(s.lastAlertTime);
        setExposureStart(s.exposureStart);
        setAlertsSent(s.alertsSent);
        setAlertsBlocked(s.alertsBlocked);
        setDecisionLog(prev => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), logEntry]);
    }, [sendTwilioAlert]);

    // ── Start/Stop Engine ──
    const startEngine = useCallback(() => {
        if (intervalRef.current) return;
        setRunning(true);
        startTimeRef.current = new Date();
        setDecisionLog(prev => [...prev, { time: new Date(), msg: '🚀 Alert Engine STARTED — Monitoring ' + STATION_NAME, type: 'info' }]);
        intervalRef.current = setInterval(engineTick, CYCLE_INTERVAL);
    }, [engineTick]);

    const stopEngine = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setRunning(false);
        setDecisionLog(prev => [...prev, { time: new Date(), msg: '⏹ Alert Engine STOPPED', type: 'info' }]);
    }, []);

    const resetEngine = useCallback(() => {
        stopEngine();
        // Reset all refs
        engineState.current = {
            aqi: 42, prevAqi: 42, cycle: 0, alertLevel: 0,
            persistAbove: 0, persistBelow: 0, lastAlertTime: null,
            exposureStart: null, alertsSent: 0, alertsBlocked: 0,
            aqiTwoCyclesAgo: 42, history: [42],
        };
        // Reset spike state
        _spikeActive.value = false;
        _spikeActive.magnitude = 0;
        _spikeActive.decayRate = 0;
        // Reset all UI state
        setCycle(0);
        setAqi(42);
        setPrevAqi(42);
        setTrend(0);
        setHistory([42]);
        setAlertLevel(0);
        setPrevAlertLevel(0);
        setPersistAbove(0);
        setPersistBelow(0);
        setLastAlertTime(null);
        setExposureStart(null);
        setAlertsSent(0);
        setAlertsBlocked(0);
        setDecisionLog([]);
        setAlertHistory([]);
        setDecisionLog([{ time: new Date(), msg: '🔄 Engine RESET — All state cleared', type: 'info' }]);
    }, [stopEngine]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // Auto scroll log
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [decisionLog]);

    const currentBand = getBand(aqi);
    const uptime = startTimeRef.current ? formatDuration(Date.now() - startTimeRef.current.getTime()) : '0s';
    const cooldownRemaining = lastAlertTime ? Math.max(0, Math.ceil((COOLDOWN_MS - (Date.now() - lastAlertTime.getTime())) / 1000)) : 0;

    const scenarios = [
        { id: 'realistic', label: 'Realistic (Auto-Cycle)' },
        { id: 'normal', label: 'Normal Fluctuation' },
        { id: 'gradual_rise', label: 'Gradual Rise' },
        { id: 'sudden_spike', label: 'Sudden Spike' },
        { id: 'sustained_high', label: 'Sustained High' },
        { id: 'recovery', label: 'Recovery Phase' },
    ];

    const logColors = {
        info: 'var(--text-secondary)',
        alert: '#38bdf8',
        escalate: '#ef4444',
        deescalate: '#22c55e',
        blocked: '#fbbf24',
        recovery: '#34d399',
        error: '#fb7185',
    };

    return (
        <div className="page-container">
            {/* ═══ Hero ═══ */}
            <div className="page-hero fade-in">
                <div className="page-hero-label">Adaptive Risk Intelligence</div>
                <h1 className="page-hero-title">
                    <span>Alert Engine</span> — Simulation Command
                </h1>
                <p className="page-hero-desc">
                    Multi-level, trend-aware environmental alert system for {STATION_NAME}.
                    Escalates intelligently, avoids spam, de-escalates responsibly, and delivers alerts via SMS & WhatsApp.
                </p>
            </div>

            <div className="page-content">

                {/* ═══ Engine Status Bar ═══ */}
                <div className="section fade-in" style={{ padding: '8px 0' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '11px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: running ? '#22c55e' : '#ef4444', boxShadow: running ? '0 0 6px #22c55e' : 'none', animation: running ? 'pulse 2s infinite' : 'none' }} />
                            <span style={{ color: running ? '#22c55e' : '#ef4444', letterSpacing: '1.5px' }}>{running ? 'ENGINE RUNNING' : 'ENGINE STOPPED'}</span>
                        </span>
                        <span style={{ color: 'var(--text-dim)' }}>│</span>
                        <span style={{ color: 'var(--text-muted)' }}>Cycle: <span style={{ color: 'var(--text-secondary)' }}>{cycle}</span></span>
                        <span style={{ color: 'var(--text-dim)' }}>│</span>
                        <span style={{ color: 'var(--text-muted)' }}>Uptime: <span style={{ color: 'var(--text-secondary)' }}>{uptime}</span></span>
                        <span style={{ color: 'var(--text-dim)' }}>│</span>
                        <span style={{ color: 'var(--text-muted)' }}>Alerts: <span style={{ color: '#38bdf8' }}>{alertsSent}</span> sent / <span style={{ color: '#fbbf24' }}>{alertsBlocked}</span> blocked</span>
                        <span style={{ color: 'var(--text-dim)' }}>│</span>
                        <span style={{ color: 'var(--text-muted)' }}>Cooldown: <span style={{ color: cooldownRemaining > 0 ? '#fbbf24' : '#22c55e' }}>{cooldownRemaining > 0 ? `${cooldownRemaining}s` : 'Ready'}</span></span>
                    </div>
                </div>

                {/* ═══ CONTROLS ═══ */}
                <div className="section fade-in-d1">
                    <div className="section-header"><div className="section-bar" style={{ background: '#a78bfa' }} /><h2 className="section-title">Engine Controls</h2></div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {!running ? (
                            <button onClick={startEngine} style={{ background: 'linear-gradient(135deg, #22c55e, #34d399)', color: '#060a11', border: 'none', borderRadius: '10px', padding: '10px 24px', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', cursor: 'pointer', textTransform: 'uppercase' }}>
                                ▶ Start Engine
                            </button>
                        ) : (
                            <button onClick={stopEngine} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px 24px', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', cursor: 'pointer', textTransform: 'uppercase' }}>
                                ⏹ Stop Engine
                            </button>
                        )}
                        <button onClick={resetEngine} style={{ background: 'rgba(251,191,36,0.06)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '10px', padding: '10px 24px', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', cursor: 'pointer', textTransform: 'uppercase' }}>
                            🔄 Reset
                        </button>
                        <span style={{ color: 'var(--text-dim)' }}>│</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>Scenario:</span>
                        <select
                            value={scenario}
                            onChange={e => setScenario(e.target.value)}
                            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', cursor: 'pointer', outline: 'none' }}
                        >
                            {scenarios.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                    </div>
                </div>

                {/* ═══ CURRENT STATE ═══ */}
                <div className="section fade-in-d2">
                    <div className="section-header"><div className="section-bar" style={{ background: currentBand.color }} /><h2 className="section-title">Current State</h2></div>

                    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px' }}>
                        {/* Gauge */}
                        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
                            <AQIGauge value={aqi} size={240} />
                            <span style={{ display: 'inline-block', padding: '6px 18px', borderRadius: '20px', background: currentBand.bg, color: currentBand.color, border: `1px solid ${currentBand.color}30`, fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, marginTop: '8px', letterSpacing: '1px' }}>
                                {currentBand.label.toUpperCase()}
                            </span>
                        </div>

                        {/* Metrics Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                            {/* Alert Level */}
                            <div className="card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '8px' }}>ALERT LEVEL</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '36px', fontWeight: 800, color: BANDS[alertLevel].color, transition: 'all 0.8s ease' }}>{alertLevel}</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: BANDS[alertLevel].color, marginTop: '4px' }}>{BANDS[alertLevel].label}</div>
                            </div>

                            {/* Trend */}
                            <div className="card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '8px' }}>TREND</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 800, color: trendColor(trend), transition: 'all 0.8s ease' }}>{trend > 0 ? '+' : ''}{trend}</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: trendColor(trend), marginTop: '4px' }}>{trendLabel(trend)}</div>
                            </div>

                            {/* Persistence */}
                            <div className="card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '8px' }}>PERSISTENCE</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', transition: 'all 0.8s ease' }}>{persistAbove || persistBelow}</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{persistAbove > 0 ? '↑ Above' : persistBelow > 0 ? '↓ Below' : 'Stable'}</div>
                            </div>

                            {/* Exposure */}
                            <div className="card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '8px' }}>EXPOSURE</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 800, color: exposureStart ? '#ef4444' : '#22c55e', transition: 'all 0.8s ease' }}>
                                    {exposureStart ? formatDuration(Date.now() - exposureStart.getTime()) : 'None'}
                                </div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{exposureStart ? 'Active' : 'Safe'}</div>
                            </div>

                            {/* Cooldown */}
                            <div className="card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '8px' }}>COOLDOWN</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 800, color: cooldownRemaining > 0 ? '#fbbf24' : '#22c55e' }}>
                                    {cooldownRemaining > 0 ? `${cooldownRemaining}s` : 'Ready'}
                                </div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Anti-Spam</div>
                            </div>

                            {/* Station */}
                            <div className="card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '8px' }}>STATION</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--accent-emerald)' }}>Perungudi</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Chennai</div>
                            </div>
                        </div>
                    </div>

                    {/* AQI History Sparkline */}
                    {history.length > 3 && (
                        <div className="card" style={{ marginTop: '12px', padding: '14px 20px' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1.5px', marginBottom: '8px' }}>AQI HISTORY ({history.length} samples)</div>
                            <svg width="100%" height="60" viewBox="0 0 400 60" preserveAspectRatio="none">
                                {/* Threshold lines */}
                                <line x1="0" y1={60 - (50 / 350) * 60} x2="400" y2={60 - (50 / 350) * 60} stroke="#22c55e" strokeWidth="0.5" opacity="0.3" strokeDasharray="4" />
                                <line x1="0" y1={60 - (100 / 350) * 60} x2="400" y2={60 - (100 / 350) * 60} stroke="#fbbf24" strokeWidth="0.5" opacity="0.3" strokeDasharray="4" />
                                <line x1="0" y1={60 - (200 / 350) * 60} x2="400" y2={60 - (200 / 350) * 60} stroke="#f97316" strokeWidth="0.5" opacity="0.3" strokeDasharray="4" />
                                {/* AQI line */}
                                <polyline
                                    fill="none" stroke={currentBand.color} strokeWidth="2" opacity="0.9"
                                    points={history.map((v, i) => `${(i / Math.max(1, history.length - 1)) * 400},${60 - (Math.min(v, 350) / 350) * 60}`).join(' ')}
                                    style={{ transition: 'all 0.5s ease' }}
                                />
                                {/* Current point */}
                                {history.length > 0 && (
                                    <circle
                                        cx={400}
                                        cy={60 - (Math.min(history[history.length - 1], 350) / 350) * 60}
                                        r="3" fill={currentBand.color}
                                        style={{ filter: `drop-shadow(0 0 4px ${currentBand.color})` }}
                                    />
                                )}
                            </svg>
                            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
                                <span style={{ color: '#22c55e' }}>── 50 (Safe)</span>
                                <span style={{ color: '#fbbf24' }}>── 100 (Advisory)</span>
                                <span style={{ color: '#f97316' }}>── 200 (Warning)</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ DECISION LOG ═══ */}
                <div className="section fade-in-d3">
                    <div className="section-header"><div className="section-bar" style={{ background: '#38bdf8' }} /><h2 className="section-title">Decision Log</h2></div>
                    <p className="section-desc">Every cycle's reasoning — escalation, de-escalation, anti-spam blocks, and alert decisions.</p>

                    <div className="card" style={{ padding: '16px', maxHeight: '280px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: '1.8' }}>
                        {decisionLog.length === 0 ? (
                            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '24px' }}>
                                Start the engine to see decision logs...
                            </div>
                        ) : (
                            decisionLog.map((entry, i) => (
                                <div key={i} style={{ color: logColors[entry.type] || 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', padding: '3px 0' }}>
                                    <span style={{ color: 'var(--text-dim)', marginRight: '8px' }}>{formatTime(entry.time)}</span>
                                    {entry.msg}
                                </div>
                            ))
                        )}
                        <div ref={logEndRef} />
                    </div>
                </div>

                {/* ═══ ALERT HISTORY ═══ */}
                <div className="section fade-in-d3">
                    <div className="section-header"><div className="section-bar" style={{ background: '#fb7185' }} /><h2 className="section-title">Alert History</h2></div>
                    <p className="section-desc">Alerts that were actually sent (passed anti-spam filters). Each includes the full message delivered via SMS/WhatsApp.</p>

                    {alertHistory.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                            No alerts sent yet. Engine will send alerts on level changes.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {alertHistory.map((alert, i) => (
                                <div key={i} className="card" style={{ padding: '16px', borderColor: `${alert.band.color}30` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '12px', background: alert.band.bg, color: alert.band.color, border: `1px solid ${alert.band.color}30`, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>
                                                {alert.type === 'recovery' ? '✅ RECOVERY' : `LEVEL ${alert.level}`}
                                            </span>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                                                L{alert.prevLevel} → L{alert.level}
                                            </span>
                                        </div>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>{formatTime(alert.time)}</span>
                                    </div>
                                    <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.6', background: 'var(--bg-void)', padding: '12px 16px', borderRadius: '8px', margin: 0 }}>
                                        {alert.message}
                                    </pre>
                                    {alert.exposureDuration && (
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#34d399', marginTop: '8px' }}>
                                            🕐 Total exposure duration: {formatDuration(alert.exposureDuration)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ═══ TWILIO CONFIGURATION ═══ */}
                <div className="section fade-in-d3">
                    <div className="section-header"><div className="section-bar" style={{ background: '#c084fc' }} /><h2 className="section-title">Twilio SMS & WhatsApp Configuration</h2></div>
                    <p className="section-desc">
                        Connect your Twilio account to send real SMS and WhatsApp alerts when the alert level changes.
                        Alerts are sent automatically — no manual action needed.
                    </p>

                    <div className="card" style={{ padding: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>ACCOUNT SID</label>
                                <input type="text" value={twilioSid} onChange={e => setTwilioSid(e.target.value)} placeholder="ACxxxxxxxxx"
                                    style={{ width: '100%', background: 'var(--bg-void)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', outline: 'none' }} />
                            </div>
                            <div>
                                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>AUTH TOKEN</label>
                                <input type="password" value={twilioAuth} onChange={e => setTwilioAuth(e.target.value)} placeholder="••••••••••"
                                    style={{ width: '100%', background: 'var(--bg-void)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', outline: 'none' }} />
                            </div>
                            <div>
                                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>SMS FROM NUMBER</label>
                                <input type="text" value={twilioFrom} onChange={e => setTwilioFrom(e.target.value)} placeholder="+1234567890"
                                    style={{ width: '100%', background: 'var(--bg-void)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', outline: 'none' }} />
                            </div>
                            <div>
                                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>WHATSAPP FROM NUMBER</label>
                                <input type="text" value={whatsappFrom} onChange={e => setWhatsappFrom(e.target.value)} placeholder="+14155238886"
                                    style={{ width: '100%', background: 'var(--bg-void)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', outline: 'none' }} />
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px' }}>Twilio WhatsApp Sandbox: +14155238886</div>
                            </div>
                            <div>
                                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>YOUR PHONE (To)</label>
                                <input type="text" value={userPhone} onChange={e => setUserPhone(e.target.value)} placeholder="+91xxxxxxxxxx"
                                    style={{ width: '100%', background: 'var(--bg-void)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', outline: 'none' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                            <button
                                onClick={() => setTwilioEnabled(!twilioEnabled)}
                                style={{
                                    background: twilioEnabled ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.06)',
                                    color: twilioEnabled ? '#22c55e' : '#ef4444',
                                    border: `1px solid ${twilioEnabled ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
                                    borderRadius: '10px', padding: '10px 24px',
                                    fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
                                    letterSpacing: '1.5px', cursor: 'pointer', textTransform: 'uppercase',
                                }}
                            >
                                {twilioEnabled ? '✓ Twilio ENABLED' : '✗ Twilio DISABLED'}
                            </button>
                            {twilioStatus && (
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: twilioStatus.startsWith('✓') ? '#22c55e' : '#ef4444' }}>
                                    {twilioStatus}
                                </span>
                            )}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', marginTop: '12px', lineHeight: '1.6' }}>
                            ⚠ Twilio credentials are stored in browser memory only. For WhatsApp, use the Twilio Sandbox number.
                            Alerts are sent on level change — never on every cycle.
                        </div>
                    </div>
                </div>

                {/* ═══ HOW IT WORKS ═══ */}
                <div className="section fade-in-d3">
                    <div className="section-header"><div className="section-bar" style={{ background: '#34d399' }} /><h2 className="section-title">How the Alert Engine Works</h2></div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="card" style={{ padding: '20px' }}>
                            <div style={{ fontSize: '20px', marginBottom: '8px' }}>📈</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '6px' }}>Escalation Rules</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                                AQI must persist above a severity band for <strong>{ESCALATION_PERSISTENCE} consecutive cycles</strong> ({ESCALATION_PERSISTENCE * 10}s) before escalating.
                                Exception: a <strong>rapid rise &gt; {RAPID_RISE_THRESHOLD} AQI in 20s</strong> triggers immediate escalation.
                            </div>
                        </div>
                        <div className="card" style={{ padding: '20px' }}>
                            <div style={{ fontSize: '20px', marginBottom: '8px' }}>📉</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '6px' }}>De-escalation Rules</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                                AQI must drop below the current band for <strong>{DEESCALATION_PERSISTENCE} consecutive cycles</strong> ({DEESCALATION_PERSISTENCE * 10}s).
                                When returning to Safe (L0), a <strong>recovery notification</strong> is sent with total exposure duration.
                            </div>
                        </div>
                        <div className="card" style={{ padding: '20px' }}>
                            <div style={{ fontSize: '20px', marginBottom: '8px' }}>🚫</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '6px' }}>Anti-Spam Protection</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                                Alerts only fire on <strong>level change</strong>. Duplicate severity alerts are blocked.
                                A <strong>{COOLDOWN_MS / 1000}s cooldown</strong> prevents spam even during rapid fluctuations.
                            </div>
                        </div>
                        <div className="card" style={{ padding: '20px' }}>
                            <div style={{ fontSize: '20px', marginBottom: '8px' }}>📱</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '6px' }}>Delivery Channels</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                                Each qualified alert is sent via both <strong>SMS and WhatsApp</strong> using Twilio API.
                                Message tone and urgency vary by alert level — Advisory is calm, Severe is urgent.
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
