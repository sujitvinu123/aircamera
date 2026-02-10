import React, { useState, useEffect, useMemo } from 'react';
// Navbar removed
import SummaryCard from './SummaryCard';
import PolicyPanel from './PolicyPanel';
import SimulationPanel from './SimulationPanel';
import PollutionMap from './PollutionMap';
import AQITrendChart from './AQITrendChart';
import HotspotChart from './HotspotChart';

const Dashboard = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/api/data');
                if (!response.ok) throw new Error('Data fetch failed');
                const result = await response.json();
                setData(result);
                setLoading(false);
            } catch (err) {
                console.error("Fetch error:", err);
                setError("Failed to load data. Ensure backend is running.");
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Derived Metrics for Summary Cards
    const metrics = useMemo(() => {
        if (data.length === 0) return { avgAQI: 0, highRiskZones: 0, severeRiskZones: 0, projection: '-12%' };

        const avgAQI = Math.round(data.reduce((acc, curr) => acc + (curr.AQI || 0), 0) / data.length);
        const highRiskZones = data.filter(d => d.AQI > 200 && d.AQI <= 300).length;
        const severeRiskZones = data.filter(d => d.AQI > 300).length;

        return { avgAQI, highRiskZones, severeRiskZones, projection: '-12%' };
    }, [data]);

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-bg-color">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-text-primary"></div>
        </div>
    );

    if (error) return (
        <div className="flex items-center justify-center h-screen bg-bg-color text-red-600">
            {error}
        </div>
    );

    return (
        <div className="min-h-screen bg-bg-color pb-12 font-sans">
            {/* Navbar handled in App.jsx */}

            <main className="max-w-7xl mx-auto px-6 space-y-8">
                {/* 1. Summary Cards Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <SummaryCard title="City-wide Average AQI" value={metrics.avgAQI} />
                    <SummaryCard title="High Risk Zones" value={metrics.highRiskZones} />
                    <SummaryCard title="Severe Risk Zones" value={metrics.severeRiskZones} />
                    <SummaryCard title="Projected AQI Reduction" value={metrics.projection} />
                </div>

                {/* 2. Map & Policy Panel Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
                    <div className="lg:col-span-2 bg-white rounded-lg shadow-card border border-gray-100 overflow-hidden">
                        <PollutionMap data={data} />
                    </div>
                    <div className="lg:col-span-1 h-full policy-panel-wrapper">
                        <PolicyPanel data={data} />
                    </div>
                </div>

                {/* 3. Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-card-bg p-6 rounded-lg shadow-card h-[400px]">
                        <h3 className="text-lg font-bold mb-4 font-serif">AQI Trend Analysis</h3>
                        <AQITrendChart data={data} />
                    </div>
                    <div className="bg-card-bg p-6 rounded-lg shadow-card h-[400px]">
                        <h3 className="text-lg font-bold mb-4 font-serif">Critical Hotspots</h3>
                        <HotspotChart data={data} />
                    </div>
                </div>

                {/* 4. Simulation Impact Panel */}
                <div>
                    <SimulationPanel />
                </div>

            </main>
        </div>
    );
};

export default Dashboard;
