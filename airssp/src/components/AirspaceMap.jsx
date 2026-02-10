/**
 * ═══════════════════════════════════════════════════════════════
 * AIRSSP — Airspace Map (OpenStreetMap + Leaflet)
 * ═══════════════════════════════════════════════════════════════
 * Real geographic map centered on Chennai with:
 *   - Animated pollution halos around stations
 *   - Color-coded markers by AQI severity
 *   - Pulsing rings to show data activity
 *   - Trust-level opacity variations
 *   - Counterfactual overlay (intervention mode)
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// ── Color by AQI ──
function aqiColor(aqi) {
    if (aqi <= 50) return '#22c55e';  // Good — green
    if (aqi <= 100) return '#34d399';  // Moderate — emerald
    if (aqi <= 150) return '#fbbf24';  // Unhealthy-sensitive — amber
    if (aqi <= 200) return '#f97316';  // Unhealthy — orange
    if (aqi <= 300) return '#fb7185';  // Very Unhealthy — rose
    return '#ef4444';                   // Hazardous — red
}

// ── Source Type Icon ──
function sourceIcon(type) {
    switch (type) {
        case 'government': return '⬢';
        case 'iot': return '◈';
        case 'camera': return '◉';
        default: return '●';
    }
}

// ── Auto-fit Map Bounds ──
function MapBoundsUpdater({ stations }) {
    const map = useMap();

    useEffect(() => {
        if (stations.length > 0) {
            const bounds = stations.map(s => [s.lat, s.lng]);
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
        }
    }, []);

    return null;
}

// ── Station Marker ──
function StationMarker({ station, showIntervention }) {
    const aqi = showIntervention ? station.intervention.predictedAqi : station.aqi;
    const color = aqiColor(aqi);
    const hazeRadius = Math.max(300, (aqi / 400) * 1200);

    return (
        <>
            {/* Outer haze field — pollution density visualization */}
            <Circle
                center={[station.lat, station.lng]}
                radius={hazeRadius}
                pathOptions={{
                    color: 'transparent',
                    fillColor: color,
                    fillOpacity: station.rejected ? 0.02 : (aqi / 400) * 0.18,
                }}
            />

            {/* Mid ring — trust boundary */}
            <Circle
                center={[station.lat, station.lng]}
                radius={hazeRadius * 0.5}
                pathOptions={{
                    color: color,
                    weight: 1,
                    opacity: station.trust * 0.3,
                    fillColor: color,
                    fillOpacity: station.rejected ? 0.01 : (aqi / 400) * 0.08,
                    dashArray: station.type === 'camera' ? '4 4' : undefined,
                }}
            />

            {/* Core marker */}
            <CircleMarker
                center={[station.lat, station.lng]}
                radius={station.rejected ? 4 : 7}
                pathOptions={{
                    color: station.rejected ? '#ef4444' : color,
                    weight: station.type === 'government' ? 3 : 2,
                    opacity: station.rejected ? 0.3 : 0.9,
                    fillColor: color,
                    fillOpacity: station.rejected ? 0.1 : 0.85,
                }}
            >
                <Tooltip
                    direction="top"
                    offset={[0, -10]}
                    permanent={false}
                    className="custom-tooltip"
                >
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '10px',
                        color: '#e8ecf4',
                        lineHeight: '1.5',
                    }}>
                        <div style={{ fontWeight: 700, fontSize: '11px', marginBottom: '2px' }}>
                            {sourceIcon(station.type)} {station.name}
                        </div>
                        <div style={{ color: '#8b95a8', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                            {station.type === 'government' ? 'CPCB STATION' :
                                station.type === 'iot' ? 'IoT SENSOR' : 'CAMERA FEED'}
                            {station.rejected && ' — REJECTED'}
                        </div>
                    </div>
                </Tooltip>

                <Popup>
                    <div style={{
                        fontFamily: "'Inter', sans-serif",
                        padding: '4px',
                        minWidth: '180px',
                    }}>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            fontSize: '13px',
                            marginBottom: '8px',
                            color: '#e8ecf4',
                            borderBottom: '1px solid rgba(75,84,104,0.3)',
                            paddingBottom: '6px',
                        }}>
                            {sourceIcon(station.type)} {station.name}
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '6px',
                            marginBottom: '8px',
                        }}>
                            <div style={{ textAlign: 'center', padding: '6px', background: 'rgba(7,9,14,0.5)', borderRadius: '6px' }}>
                                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: '7px', color: '#4b5468', letterSpacing: '1px' }}>AQI</div>
                                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: '18px', fontWeight: 800, color }}>
                                    {showIntervention ? station.intervention.predictedAqi : station.aqi}
                                </div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '6px', background: 'rgba(7,9,14,0.5)', borderRadius: '6px' }}>
                                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: '7px', color: '#4b5468', letterSpacing: '1px' }}>CATEGORY</div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color, marginTop: '4px' }}>
                                    {station.category}
                                </div>
                            </div>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            gap: '4px',
                            fontSize: '9px',
                            fontFamily: "'JetBrains Mono'",
                        }}>
                            <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(7,9,14,0.5)', borderRadius: '4px' }}>
                                <div style={{ color: '#4b5468', fontSize: '7px' }}>PM2.5</div>
                                <div style={{ color: '#e8ecf4', fontWeight: 600 }}>{station.pm25}</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(7,9,14,0.5)', borderRadius: '4px' }}>
                                <div style={{ color: '#4b5468', fontSize: '7px' }}>PM10</div>
                                <div style={{ color: '#e8ecf4', fontWeight: 600 }}>{station.pm10}</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(7,9,14,0.5)', borderRadius: '4px' }}>
                                <div style={{ color: '#4b5468', fontSize: '7px' }}>WIND</div>
                                <div style={{ color: '#e8ecf4', fontWeight: 600 }}>{station.windSpeed}</div>
                            </div>
                        </div>

                        {station.type !== 'government' && (
                            <div style={{
                                marginTop: '8px',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                background: station.rejected ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.05)',
                                border: `1px solid ${station.rejected ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.15)'}`,
                                fontFamily: "'JetBrains Mono'",
                                fontSize: '8px',
                                color: station.rejected ? '#fb7185' : '#34d399',
                                letterSpacing: '1px',
                            }}>
                                TRUST: {station.rejected ? 'REJECTED' : `${Math.round(station.trust * 100)}%`}
                            </div>
                        )}
                    </div>
                </Popup>
            </CircleMarker>
        </>
    );
}

export default function AirspaceMap({ systemState, showIntervention }) {
    const stations = systemState?.stations || [];
    const center = [13.02, 80.22]; // Chennai center

    return (
        <div className="map-wrapper" id="airspace-map">
            <MapContainer
                center={center}
                zoom={12}
                zoomControl={false}
                style={{ width: '100%', height: '100%' }}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />

                <MapBoundsUpdater stations={stations} />

                {stations.map(station => (
                    <StationMarker
                        key={station.id}
                        station={station}
                        showIntervention={showIntervention}
                    />
                ))}
            </MapContainer>

            {/* Map Legend Overlay */}
            <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                zIndex: 1000,
                background: 'rgba(12, 16, 23, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(75, 84, 104, 0.2)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '8px',
                color: '#8b95a8',
                letterSpacing: '1px',
            }}>
                <div style={{ marginBottom: '6px', fontWeight: 600, color: '#4b5468' }}>DATA SOURCES</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399', display: 'inline-block' }} />
                        GOV STATION
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 6px #fbbf24', display: 'inline-block' }} />
                        IoT SENSOR
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c084fc', boxShadow: '0 0 6px #c084fc', display: 'inline-block' }} />
                        CAMERA FEED
                    </div>
                </div>
            </div>

            {/* AQI Scale Overlay */}
            <div style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                zIndex: 1000,
                background: 'rgba(12, 16, 23, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(75, 84, 104, 0.2)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '8px',
                color: '#8b95a8',
                letterSpacing: '0.5px',
            }}>
                <div style={{ marginBottom: '6px', fontWeight: 600, color: '#4b5468', letterSpacing: '1px' }}>POLLUTION DENSITY</div>
                <div style={{
                    width: '120px',
                    height: '6px',
                    borderRadius: '3px',
                    background: 'linear-gradient(90deg, #22c55e, #34d399, #fbbf24, #f97316, #fb7185, #ef4444)',
                    marginBottom: '4px',
                }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px' }}>
                    <span>GOOD</span>
                    <span>HAZARDOUS</span>
                </div>
            </div>
        </div>
    );
}
