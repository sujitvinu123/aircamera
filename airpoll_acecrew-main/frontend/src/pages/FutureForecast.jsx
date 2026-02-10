import React, { useState, useEffect, useMemo } from 'react';
// Navbar removed
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import SummaryCard from '../components/SummaryCard';
import FuturePolicyPanel from '../components/FuturePolicyPanel';

const FutureForecast = () => {
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPredictions = async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/api/future-predictions?hours=24');
                if (!response.ok) throw new Error('Fetch failed');
                const data = await response.json();
                setPredictions(data.message ? [] : data);
                setLoading(false);
            } catch (err) {
                setError("Failed to load predictions.");
                setLoading(false);
            }
        };
        fetchPredictions();
    }, []);

    const processedData = useMemo(() => {
        if (predictions.length === 0) return {
            metrics: { avgAQI: 0, highRisk: 0, severeRisk: 0 },
            mapStations: [],
            chartData: []
        };

        const earliest = predictions[0].future_timestamp;
        const nextHour = [];
        const uniqueStations = new Map();

        // Single pass for metrics and map stations
        // We only need the *first* instance of each station for the map
        // And the *first hour* (earliest timestamp) for the metrics

        predictions.forEach(p => {
            if (p.future_timestamp === earliest) {
                nextHour.push(p);
            }
            if (!uniqueStations.has(p.station_name)) {
                uniqueStations.set(p.station_name, p);
            }
        });

        const metrics = {
            avgAQI: Math.round(nextHour.reduce((a, c) => a + c.predicted_AQI, 0) / (nextHour.length || 1)),
            highRisk: nextHour.filter(p => p.risk_level === 'High').length,
            severeRisk: nextHour.filter(p => p.risk_level === 'Severe').length
        };

        const mapStations = Array.from(uniqueStations.values());

        // Chart Data: efficiently filter for just one station (e.g., the first one in the map list)
        // This avoids iterating the whole array for every station if we only show one
        const targetStation = mapStations.length > 0 ? mapStations[0].station_name : "";
        const chartData = predictions
            .filter(p => p.station_name === targetStation)
            .map(p => ({
                time: new Date(p.future_timestamp).getHours() + ':00',
                AQI: p.predicted_AQI
            }));

        return { metrics, mapStations, chartData };
    }, [predictions]);

    const { metrics, mapStations, chartData } = processedData;


    if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;
    if (error) return <div className="text-center p-8 text-red-600">{error}</div>;

    const center = mapStations.length > 0 ? [mapStations[0].latitude, mapStations[0].longitude] : [28.6139, 77.2090];

    return (
        <div className="min-h-screen bg-bg-color font-sans pb-12">
            {/* Navbar handled in App.jsx */}
            <div className="max-w-7xl mx-auto px-6 space-y-8">
                <h2 className="text-2xl font-bold text-text-primary font-serif border-b border-gray-200 pb-2">24-Hour Future Forecast</h2>

                <div className="forecast-page">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <SummaryCard title="Predicted Avg AQI" value={metrics.avgAQI} />
                        <SummaryCard title="High Risk Zones" value={metrics.highRisk} />
                        <SummaryCard title="Severe Risk Zones" value={metrics.severeRisk} />
                    </div>

                    {/* Map and Policy Row */}
                    <div className="map-policy-row">
                        <div className="bg-white rounded-lg shadow-card border border-gray-100 overflow-hidden relative z-0 h-[500px]">
                            <div className="absolute top-2 left-2 z-[400] bg-white px-2 py-1 rounded text-xs font-bold shadow">Prediction Map</div>
                            <MapContainer center={center} zoom={10} className="w-full h-full z-0">
                                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                                {mapStations.map((s, i) => (
                                    <CircleMarker key={i} center={[s.latitude, s.longitude]} radius={8} fillColor={s.predicted_AQI > 200 ? '#e67e22' : '#27ae60'} color="#fff" fillOpacity={0.8}>
                                        <Popup>{s.station_name}: {s.predicted_AQI}</Popup>
                                    </CircleMarker>
                                ))}
                            </MapContainer>
                        </div>
                        <div className="h-[500px]">
                            <FuturePolicyPanel predictions={predictions} />
                        </div>
                    </div>

                    {/* Chart Row */}
                    <div className="forecast-chart-row">
                        <div className="forecast-chart-container">
                            <h3 className="text-lg font-bold mb-4 font-serif">Forecast Trend</h3>
                            <ResponsiveContainer width="100%" height={260}>
                                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 30 }}>
                                    <CartesianGrid stroke="#d6d0c7" strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="time"
                                        tick={{ fontSize: 12 }}
                                        label={{ value: "Time (Next 24 Hours)", position: "insideBottom", offset: -5, style: { fontSize: 14 } }}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12 }}
                                        label={{ value: "Predicted AQI", angle: -90, position: "insideLeft", style: { fontSize: 14 } }}
                                    />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="AQI" stroke="#2c3e50" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FutureForecast;
