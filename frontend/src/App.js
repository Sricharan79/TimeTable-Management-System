import React, { useState } from 'react';
import GeneratorPage from './pages/GeneratorPage';
import AdminDashboard from './pages/AdminDashboard';
import ManageDataPage from './pages/ManageDataPage';
import FacultyDashboard from './pages/FacultyDashboard';
import FacultyNotificationsPage from './pages/FacultyNotificationsPage';
import Sidebar from './components/Sidebar';
import './pages/styles.css';

const DEFAULT_VIEW_BY_PORTAL = {
  admin: 'dashboard',
  faculty: 'faculty'
};

function App() {
  const [activePortal, setActivePortal] = useState('admin');
  const [activeView, setActiveView] = useState(DEFAULT_VIEW_BY_PORTAL.admin);

  const renderPlaceholder = (title, subtitle, heading, message) => (
    <div className="generator-page">
      <header className="top-bar">
        <div className="brand-text">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </header>
      <div className="container">
        <h1>{heading}</h1>
        <p className="subtitle">{message}</p>
      </div>
    </div>
  );

  const handlePortalChange = (portal) => {
    setActivePortal(portal);
    setActiveView(DEFAULT_VIEW_BY_PORTAL[portal]);
  };

  let pageContent = <AdminDashboard />;

  if (activePortal === 'admin') {
    if (activeView === 'generator') {
      pageContent = <GeneratorPage />;
    } else if (activeView === 'manage-data') {
      pageContent = <ManageDataPage />;
    } else {
      pageContent = <AdminDashboard />;
    }
  } else {
    if (activeView === 'notification') {
      pageContent = <FacultyNotificationsPage />;
    } else {
      pageContent = <FacultyDashboard />;
    }
  }

  return (
    <div>
      <div className="app-nav">
        <button
          className={`nav-btn ${activePortal === 'admin' ? 'active' : ''}`}
          onClick={() => handlePortalChange('admin')}
        >
          Admin Portal
        </button>
        <button
          className={`nav-btn ${activePortal === 'faculty' ? 'active' : ''}`}
          onClick={() => handlePortalChange('faculty')}
        >
          Faculty Portal
        </button>
      </div>

      <Sidebar
        portal={activePortal}
        activeTab={activeView}
        setActiveTab={(tabId) => setActiveView(tabId)}
        onPortalChange={handlePortalChange}
      />

      <div className="admin-dashboard-wrapper">
        {pageContent}
      </div>
    </div>
  );
}

export default App;