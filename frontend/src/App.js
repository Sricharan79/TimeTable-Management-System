import React, { useState } from 'react';
import GeneratorPage from './pages/GeneratorPage';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  const [activeView, setActiveView] = useState('generator');

  return (
    <div>
      <div className="app-nav">
        <button
          className={`nav-btn ${activeView === 'generator' ? 'active' : ''}`}
          onClick={() => setActiveView('generator')}
        >
          Timetable Generator
        </button>
        <button
          className={`nav-btn ${activeView === 'admin' ? 'active' : ''}`}
          onClick={() => setActiveView('admin')}
        >
          Admin Dashboard
        </button>
      </div>

      {activeView === 'admin' ? <AdminDashboard /> : <GeneratorPage />}
    </div>
  );
}

export default App;