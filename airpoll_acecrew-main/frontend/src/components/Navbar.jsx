import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
    const location = useLocation();

    return (
        <nav className="bg-card-bg shadow-sm py-4 px-8 mb-8 border-b border-gray-200">
            <div className="flex justify-between items-center max-w-7xl mx-auto">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold tracking-wide text-text-primary uppercase">
                        URBAN POLICY DECISION ENGINE
                    </h1>
                    <p className="text-sm text-text-secondary italic">Smart City Command Center</p>
                </div>

                <div className="flex space-x-8 items-center">
                    <div className="space-x-6">
                        <Link
                            to="/"
                            className={`text-sm font-medium transition-colors duration-200 ${location.pathname === '/'
                                ? 'text-text-primary border-b-2 border-text-primary pb-1'
                                : 'text-text-secondary hover:text-text-primary'
                                }`}
                        >
                            Dashboard
                        </Link>
                        <Link
                            to="/forecast"
                            className={`text-sm font-medium transition-colors duration-200 ${location.pathname === '/forecast'
                                ? 'text-text-primary border-b-2 border-text-primary pb-1'
                                : 'text-text-secondary hover:text-text-primary'
                                }`}
                        >
                            Future Forecast
                        </Link>
                    </div>

                    <div className="flex items-center space-x-2 bg-white px-3 py-1 rounded shadow-sm border border-gray-100">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-xs font-semibold text-text-secondary">SYSTEM ONLINE</span>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
