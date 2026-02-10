import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import FutureForecast from './pages/FutureForecast';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-bg-color">
        <Navbar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/forecast" element={<FutureForecast />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
