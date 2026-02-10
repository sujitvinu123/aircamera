import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const HotspotChart = ({ data }) => {
    // Filter top 5 polluted stations
    const chartData = [...data]
        .sort((a, b) => b.AQI - a.AQI)
        .slice(0, 5)
        .map(d => ({
            name: d.station_name.substring(0, 10) + '...', // Truncate for display
            AQI: d.AQI
        }));

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 20, left: 30, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#eee" />
                <XAxis
                    type="number"
                    stroke="#555"
                    fontSize={12}
                    label={{ value: "Air Quality Index (AQI)", position: "insideBottom", offset: -5, style: { fontSize: 14, fill: "var(--text-primary)" } }}
                />
                <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#555"
                    fontSize={12}
                    width={100}
                    label={{ value: "Location", angle: -90, position: "insideLeft", style: { fontSize: 14, fill: "var(--text-primary)" } }}
                />
                <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }}
                    cursor={{ fill: '#f9f9f9' }}
                />
                <Bar dataKey="AQI" fill="#c0392b" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.AQI > 300 ? '#c0392b' : entry.AQI > 200 ? '#e67e22' : '#f1c40f'} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};

export default HotspotChart;
