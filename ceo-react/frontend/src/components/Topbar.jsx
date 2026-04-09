import React, { useState, useEffect } from 'react';
import { useApp } from '../App';

function ISTClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    function tick() {
      const now = new Date();
      const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      let h = ist.getHours();
      const m = String(ist.getMinutes()).padStart(2, '0');
      const s = String(ist.getSeconds()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      setTime(`${String(h).padStart(2,'0')}:${m}:${s} ${ampm}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'var(--primary-gradient)', borderRadius: 10,
      padding: '4px 14px', minWidth: 120,
    }}>
      <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: 1.5, fontFamily: 'monospace' }}>{time}</span>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' }}>IST</span>
    </div>
  );
}

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  'quick-capture': 'Quick Capture',
  'someday-list': 'Someday List',
  'daily-schedule': 'Daily Schedule',
  'recurring-tasks': 'Recurring Tasks',
  'info-system': 'Information System',
  'daily-report': 'Daily Report',
  'weekly-scorecard': 'Weekly Scorecard',
  'next-week-plan': 'Week Plan',
  settings: 'Settings',
  'performance-analytics': 'Performance Analytics',
  'registered-companies': 'Registered Companies',
};

export default function Topbar({ onToggleSidebar }) {
  const { currentPage, user, theme, toggleTheme } = useApp();

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="hamburger" onClick={onToggleSidebar}>&#9776;</button>
        <h3 className="topbar-title">{PAGE_TITLES[currentPage] || currentPage}</h3>
      </div>
      <div className="topbar-right">
        <ISTClock />
        <button onClick={toggleTheme} className="theme-toggle-btn" title={theme === 'light' ? 'Switch to Dark' : 'Switch to Light'}>
          {theme === 'light' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          )}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="user-avatar-small">{user?.name?.charAt(0) || 'C'}</div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'User'}</span>
        </div>
      </div>
    </div>
  );
}
