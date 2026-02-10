import React from 'react';

const Filters = ({ filters, setFilters, locations }) => {
    const handleLocationChange = (e) => {
        setFilters(prev => ({ ...prev, location: e.target.value }));
    };

    const handleDateChange = (e) => {
        setFilters(prev => ({ ...prev, date: e.target.value }));
    };

    return (
        <div className="bg-sc-paper p-4 rounded-xl shadow-sc-card border border-sc-border flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-sc-secondary-dark uppercase mb-1">Filter by Location</label>
                <select
                    value={filters.location}
                    onChange={handleLocationChange}
                    className="w-full bg-sc-bg border border-sc-border text-sc-primary-dark text-sm rounded-lg focus:ring-2 focus:ring-sc-secondary-dark focus:border-sc-secondary-dark block p-2.5 transition-colors"
                >
                    <option value="All">All Locations</option>
                    {locations.map((loc, idx) => (
                        <option key={idx} value={loc.station_name}>{loc.station_name}</option>
                    ))}
                </select>
            </div>

            <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-sc-secondary-dark uppercase mb-1">Filter by Date</label>
                <input
                    type="date"
                    value={filters.date}
                    onChange={handleDateChange}
                    className="w-full bg-sc-bg border border-sc-border text-sc-primary-dark text-sm rounded-lg focus:ring-2 focus:ring-sc-secondary-dark focus:border-sc-secondary-dark block p-2.5 transition-colors"
                />
            </div>

            <div className="flex items-end">
                <button
                    onClick={() => setFilters({ location: 'All', date: '' })}
                    className="bg-sc-bg text-sc-primary-dark border border-sc-border hover:bg-sc-border font-medium rounded-lg text-sm px-5 py-2.5 transition-all duration-200"
                >
                    Reset
                </button>
            </div>
        </div>
    );
};

export default Filters;
