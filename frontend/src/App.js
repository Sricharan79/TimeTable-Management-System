import React, { useMemo, useState } from 'react';
import GeneratorPage from './pages/GeneratorPage';
import auroraLogo from './assets/image.png';
import API from './services/api';
import './App.css';

const NAV_ITEMS = [
  { key: 'home', label: 'Home' },
  { key: 'contact', label: 'Contact' },
  { key: 'timetable', label: 'TimeTable' }
];

function App() {
  const [activePage, setActivePage] = useState('home');

  const pageTitle = useMemo(() => {
    if (activePage === 'contact') return 'Contact Support';
    if (activePage === 'timetable') return 'TimeTable Generator';
    return 'Academic Scheduling Dashboard';
  }, [activePage]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('authToken');
    delete API.defaults.headers.common.Authorization;
    window.location.href = '/';
  };

  return (
    <div className="app-shell">
      <header className="portal-hero">
        <div className="portal-hero-inner">
          <div className="portal-actions compact">
            <div className="portal-branding compact">
              <h1>Aurora University TimeTable Portal</h1>
              <p>{pageTitle}</p>
            </div>

            <nav className="portal-nav" aria-label="Main Navigation">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`nav-btn ${activePage === item.key ? 'active' : ''}`}
                  onClick={() => setActivePage(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="header-right-cluster">
              <img src={auroraLogo} alt="Aurora University" className="portal-logo compact" />
              <button className="logout-btn-main" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </div>
      </header>

      <main className="portal-main">
        {activePage === 'home' && (
          <section className="content-panel">
            <h2>Welcome to the TimeTable Portal</h2>
            <p>
              Plan and generate department timetable schedules with one clean workflow.
              Move to the TimeTable page to generate schedules and upload data.
            </p>
            <button className="primary-cta" onClick={() => setActivePage('timetable')}>
              Open TimeTable Generator
            </button>
          </section>
        )}

        {activePage === 'contact' && (
          <section className="content-panel">
            <h2>Contact</h2>
            <p>Email: support@aurorauniversity.edu</p>
            <p>Phone: +91 98765 43210</p>
            <p>Hours: Monday - Friday, 9:00 AM to 5:00 PM</p>
          </section>
        )}

        {activePage === 'timetable' && (
          <section className="timetable-panel">
            <GeneratorPage embedded />
          </section>
        )}
      </main>
    </div>
  );
}

export default App;