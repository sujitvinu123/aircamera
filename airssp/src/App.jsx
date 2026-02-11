/**
 * AIRSSP — Multi-Page Router App
 */
import React, { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import LoadingScreen from './components/LoadingScreen';
import DashboardPage from './pages/DashboardPage';
import PerceptionPage from './pages/PerceptionPage';
import ForecastPage from './pages/ForecastPage';
import PolicyPage from './pages/PolicyPage';
import LiveDataPage from './pages/LiveDataPage';
import AlertEnginePage from './pages/AlertEnginePage';

function App() {
  const [loading, setLoading] = useState(true);
  const handleLoaded = useCallback(() => setLoading(false), []);

  if (loading) return <LoadingScreen onComplete={handleLoaded} />;

  return (
    <BrowserRouter>
      <div className="app-shell" id="airssp-root">
        <Navbar />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/perception" element={<PerceptionPage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/policy" element={<PolicyPage />} />
          <Route path="/live" element={<LiveDataPage />} />
          <Route path="/alerts" element={<AlertEnginePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
