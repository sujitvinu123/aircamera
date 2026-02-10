import React from 'react';

const SimulationPanel = () => {
    // Static simulation impact metrics as per original design/mockup context
    // In a real app complexity, these could be props based on active policies
    return (
        <div className="bg-card-bg p-6 rounded-lg shadow-card">
            <h3 className="text-xl font-bold mb-6 border-b border-gray-300 pb-2">Simulation Impact Analysis</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center bg-white p-6 rounded-lg border border-gray-100">
                <div className="p-4">
                    <p className="text-text-secondary text-sm uppercase tracking-wider font-semibold mb-2">Projected AQI Reduction</p>
                    <div className="text-4xl font-bold text-green-600">-15%</div>
                    <p className="text-xs text-text-secondary mt-1">Based on current policies</p>
                </div>

                <div className="p-4 border-l border-r border-gray-100">
                    <p className="text-text-secondary text-sm uppercase tracking-wider font-semibold mb-2">Traffic Congestion Impact</p>
                    <div className="text-4xl font-bold text-orange-500">+5%</div>
                    <p className="text-xs text-text-secondary mt-1">Slight increase in delays</p>
                </div>

                <div className="p-4">
                    <p className="text-text-secondary text-sm uppercase tracking-wider font-semibold mb-2">Public Health Improvement</p>
                    <div className="text-4xl font-bold text-blue-600">High</div>
                    <p className="text-xs text-text-secondary mt-1">Reduced respiratory risks</p>
                </div>
            </div>
        </div>
    );
};

export default SimulationPanel;
