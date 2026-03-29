import React, { useState } from 'react';
import './Sidebar.css';

const MENU_BY_PORTAL = {
	admin: [
		{ id: 'dashboard', label: 'Admin Dashboard', icon: '📊' },
		{ id: 'generator', label: 'Time Table Generator', icon: '📅' },
		{ id: 'feedback', label: 'Student Feedback', icon: '📝' }
	],
	faculty: [
		{ id: 'faculty', label: 'Faculty Dashboard', icon: '👩‍🏫' },
		{ id: 'notification', label: 'Swap Notifications', icon: '🔔' }
	]
};

function Sidebar({ portal = 'admin', activeTab, setActiveTab, onPortalChange }) {
	const [collapsed, setCollapsed] = useState(false);
	const menuItems = MENU_BY_PORTAL[portal] || MENU_BY_PORTAL.admin;
	const switchLabel = portal === 'admin' ? 'Go Faculty' : 'Go Admin';
	const nextPortal = portal === 'admin' ? 'faculty' : 'admin';

	return (
		<div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
			<div className="sidebar-header">
				<div className="sidebar-brand">
					<span className="sidebar-icon">⏱</span>
					{!collapsed && <span className="sidebar-title">TimeTable</span>}
				</div>
				<button
					className="toggle-btn"
					onClick={() => setCollapsed(!collapsed)}
					title={collapsed ? 'Expand' : 'Collapse'}
				>
					{collapsed ? '▶' : '◀'}
				</button>
			</div>

			<nav className="sidebar-nav">
				{menuItems.map((item) => (
					<button
						key={item.id}
						className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
						onClick={() => setActiveTab(item.id)}
						title={collapsed ? item.label : ''}
					>
						<span className="nav-icon">{item.icon}</span>
						{!collapsed && <span className="nav-label">{item.label}</span>}
					</button>
				))}
			</nav>

			<button
				className="portal-switch-btn"
				onClick={() => onPortalChange?.(nextPortal)}
				title={collapsed ? switchLabel : ''}
			>
				{collapsed ? (portal === 'admin' ? 'F' : 'A') : switchLabel}
			</button>
		</div>
	);
}

export default Sidebar;
