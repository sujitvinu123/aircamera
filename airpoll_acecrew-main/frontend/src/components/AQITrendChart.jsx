import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const AQITrendChart = ({ data }) => {
    // Process data for chart (simplified for now, can be improved)
    const chartData = data.slice(0, 50).map((d, i) => ({
        time: i, // Placeholder if timestamp processing is complex
        AQI: d.AQI,
        Station: d.station_name
    }));

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 30, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 12 }}
                    label={{ value: "Time", position: "insideBottom", offset: -5, style: { fontSize: 14, fill: "var(--text-primary)" } }}
                />
                <YAxis
                    stroke="#555"
                    fontSize={12}
                    label={{ value: "Air Quality Index (AQI)", angle: -90, position: "insideLeft", style: { fontSize: 14, fill: "var(--text-primary)" } }}
                />
                <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }}
                    itemStyle={{ color: '#1a1a1a' }}
                />
                <Legend />
                <Line type="monotone" dataKey="AQI" stroke="#2c3e50" dot={false} strokeWidth={2} />
            </LineChart>
        </ResponsiveContainer>
    );
};

export default AQITrendChart;
