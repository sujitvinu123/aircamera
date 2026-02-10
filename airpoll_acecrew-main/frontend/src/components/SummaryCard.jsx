import React from 'react';

const SummaryCard = ({ title, value, subtext }) => {
    return (
        <div className="bg-card-bg p-6 rounded-lg shadow-card border border-gray-100 flex flex-col items-center justify-center text-center">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{title}</h3>
            <div className="text-3xl font-bold text-text-primary mb-1 font-serif">{value}</div>
            {subtext && <div className="text-xs text-text-secondary mt-1">{subtext}</div>}
        </div>
    );
};

export default SummaryCard;
