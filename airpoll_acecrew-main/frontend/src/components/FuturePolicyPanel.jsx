import React, { useMemo } from 'react';

const FuturePolicyPanel = ({ predictions }) => {
    const policyData = useMemo(() => {
        if (!predictions || predictions.length === 0) return [];
        const stationMap = new Map();
        predictions.forEach(p => {
            if (!stationMap.has(p.station_name) || p.predicted_AQI > stationMap.get(p.station_name).predicted_AQI) {
                if (p.future_recommended_policies && p.future_recommended_policies.length > 0) {
                    const validPolicies = p.future_recommended_policies.filter(pol => !pol.includes("No preventive action"));
                    if (validPolicies.length > 0 || p.predicted_AQI > 150) {
                        stationMap.set(p.station_name, p);
                    }
                }
            }
        });
        return Array.from(stationMap.values()).sort((a, b) => b.predicted_AQI - a.predicted_AQI).slice(0, 3);
    }, [predictions]);

    if (policyData.length === 0) return null;

    return (
        <div className="bg-card-bg p-6 rounded-lg shadow-card border border-gray-100 h-full overflow-y-auto">
            <h3 className="text-lg font-bold text-text-primary mb-4 border-b border-gray-200 pb-2 font-serif">Detailed Policy Recommendations</h3>
            <div className="space-y-6">
                {policyData.map((item, idx) => (
                    <div key={idx} className="border-b border-gray-200 pb-4 last:border-0">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-bold text-text-primary">{item.station_name}</h4>
                            <span className="text-xs font-bold px-2 py-1 rounded bg-gray-200 text-text-primary">
                                AQI: {item.predicted_AQI}
                            </span>
                        </div>
                        <ul className="space-y-2 mt-2">
                            {item.future_recommended_policies.map((policy, pIdx) => (
                                <li key={pIdx} className="text-sm text-text-secondary pl-4 border-l-2 border-accent-color">
                                    {policy}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FuturePolicyPanel;
