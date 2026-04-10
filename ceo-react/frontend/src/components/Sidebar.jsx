import React from 'react';
import { useApp } from '../App';

const NAV_SECTIONS = [
  {
    label: 'MAIN',
    items: [
      { id: 'dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1', label: 'Dashboard' },
      { id: 'quick-capture', icon: 'M13 10V3L4 14h7v7l9-11h-7z', label: 'Quick Capture' },
    ],
  },
  {
    label: 'TASKS',
    items: [
      { id: 'someday-list', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', label: 'Someday List' },
      { id: 'daily-schedule', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Daily Schedule' },
      { id: 'recurring-tasks', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', label: 'Recurring Tasks' },
      { id: 'info-system', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', label: 'Information System' },
    ],
  },
  {
    label: 'REPORTS',
    items: [
      { id: 'daily-report', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'Daily Report' },
      { id: 'weekly-scorecard', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z', label: 'Weekly Scorecard' },
      { id: 'next-week-plan', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z', label: 'Week Plan' },
      { id: 'performance-analytics', icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Performance Analytics' },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { id: 'registered-companies', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', label: 'Companies' },
      { id: 'settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', label: 'Settings' },
    ],
  },
];

function NavIcon({ path }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

export default function Sidebar({ open, onClose }) {
  const { currentPage, setCurrentPage, user, logout, hasPermission } = useApp();

  function navigate(page) {
    if (!hasPermission(page)) return;
    setCurrentPage(page);
    onClose();
  }

  return (
    <>
      <div className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/wizone-logo.png" alt="Wizone" style={{ height: 36 }} />
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((section, si) => {
            const visibleItems = section.items.filter(item => hasPermission(item.id));
            if (visibleItems.length === 0) return null;
            return (
              <div key={si} style={{ marginBottom: 6 }}>
                <div className="nav-section-title" style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, padding: '10px 16px 4px', textTransform: 'uppercase' }}>{section.label}</div>
                {visibleItems.map(item => (
                  <a key={item.id} className={`nav-item${currentPage === item.id ? ' active' : ''}`} onClick={() => navigate(item.id)}>
                    <span className="nav-icon"><NavIcon path={item.icon} /></span>
                    <span>{item.label}</span>
                  </a>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="user-avatar">{user?.name?.charAt(0) || 'C'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sidebar-user-name" style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{user?.name || 'CEO'}</div>
                <div className="sidebar-user-role" style={{ fontSize: 10, marginTop: 1 }}>{user?.role || 'Admin'}</div>
              </div>
            </div>
          </div>
          <button onClick={logout} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: '#EF4444', border: 'none', color: '#FFFFFF',
            borderRadius: 8, padding: '8px 0', fontSize: 11, cursor: 'pointer',
            fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(239,68,68,0.3)',
          }}
            onMouseOver={e => { e.currentTarget.style.background = '#DC2626'; }}
            onMouseOut={e => { e.currentTarget.style.background = '#EF4444'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            Sign Out
          </button>
        </div>
      </div>
      {open && <div className="sidebar-overlay show" onClick={onClose} />}
    </>
  );
}
