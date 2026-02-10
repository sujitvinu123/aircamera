import React, { useMemo } from 'react';

const PolicyPanel = ({ data }) => {
    // Process data to filter out stations with no policies
    const stationsWithPolicies = useMemo(() => {
        if (!Array.isArray(data) || data.length === 0) return [];

        // Group by station name (taking the latest entry if duplicates exist)
        const stationMap = new Map();

        data.forEach(item => {
            let policies = [];
            // Handle string vs array policies
            if (typeof item.recommended_policies === 'string') {
                policies = item.recommended_policies.split(',').map(p => p.trim()).filter(p => p && p !== "No specific restrictions");
            } else if (Array.isArray(item.recommended_policies)) {
                policies = item.recommended_policies.filter(p => p && p !== "No specific restrictions");
            }

            if (policies.length > 0) {
                // Create a clean object for the panel
                stationMap.set(item.station_name, {
                    station_name: item.station_name,
                    risk_level: item.risk_level,
                    policies: policies
                });
            }
        });

        return Array.from(stationMap.values());
    }, [data]);

    if (!stationsWithPolicies || stationsWithPolicies.length === 0) {
        return (
            <div className="policy-panel-container flex flex-col items-center justify-center text-center">
                <h3 className="text-lg font-bold text-text-primary mb-2 font-serif">Policy Recommendations</h3>
                <p className="text-text-secondary text-sm">No active policies triggered.</p>
            </div>
        );
    }

    const getRiskColor = (level) => {
        switch (level?.toLowerCase()) {
            case 'severe': return 'text-aqi-severe';
            case 'high': return 'text-aqi-poor';
            case 'moderate': return 'text-aqi-moderate';
            default: return 'text-text-secondary';
        }
    };

    return (
        <div className="policy-panel-container">
            <h3 className="text-lg font-bold text-text-primary mb-4 border-b border-gray-200 pb-2 font-serif">Policy Recommendations</h3>

            <div className="space-y-6">
                {stationsWithPolicies.map((station, index) => (
                    <div key={index} className="station-policy-block">
                        <div className="mb-2">
                            <h4 className="text-base font-semibold text-text-primary font-sans">{station.station_name}</h4>
                            <p className={`text-xs font-medium ${getRiskColor(station.risk_level)}`}>
                                Risk Level: {station.risk_level || 'Unknown'}
                            </p>
                        </div>

                        <ul className="space-y-2 mt-2">
                            {station.policies.map((policy, pIdx) => (
                                <li key={pIdx} className="flex items-start">
                                    <span className="flex-shrink-0 w-1.5 h-1.5 mt-2 bg-text-secondary rounded-full mr-2"></span>
                                    <span className="text-sm text-text-secondary leading-relaxed">{policy}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PolicyPanel;
