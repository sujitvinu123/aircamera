import React, { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const PollutionMap = ({ data }) => {
    // Get unique stations with latest data
    const mapStations = useMemo(() => {
        const unique = new Map();
        data.forEach(p => {
            if (!unique.has(p.station_name) || new Date(p.timestamp) > new Date(unique.get(p.station_name).timestamp)) {
                unique.set(p.station_name, p);
            }
        });
        return Array.from(unique.values());
    }, [data]);

    const center = mapStations.length > 0
        ? [mapStations[0].latitude, mapStations[0].longitude]
        : [28.6139, 77.2090];

    const getRiskColor = (aqi) => {
        if (aqi <= 100) return '#27ae60'; // Low
        if (aqi <= 200) return '#f1c40f'; // Moderate
        if (aqi <= 300) return '#e67e22'; // High
        return '#c0392b'; // Severe
    };

    return (
        <MapContainer center={center} zoom={11} className="w-full h-full z-0">
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            {mapStations.map((station, idx) => (
                <CircleMarker
                    key={idx}
                    center={[station.latitude, station.longitude]}
                    radius={10}
                    fillColor={getRiskColor(station.AQI)}
                    color="#fff"
                    weight={1}
                    fillOpacity={0.8}
                >
                    <Popup>
                        <div className="text-text-primary">
                            <h3 className="font-bold border-b border-gray-200 pb-1 mb-1">{station.station_name}</h3>
                            <p className="text-sm">AQI: <strong>{station.AQI}</strong></p>
                            <p className="text-xs text-text-secondary">PM2.5: {station['PM2.5']} | PM10: {station['PM10']}</p>
                        </div>
                    </Popup>
                </CircleMarker>
            ))}
        </MapContainer>
    );
};

export default PollutionMap;
