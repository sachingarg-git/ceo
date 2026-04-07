import React from 'react';
import { useApp } from '../App';

const NAV_ITEMS = [
  { id: 'dashboard', icon: '\u25A0', label: 'Dashboard' },
  { id: 'quick-capture', icon: '\u26A1', label: 'Quick Capture' },
  { id: 'someday-list', icon: '\uD83D\uDCCB', label: 'Someday List' },
  { id: 'daily-schedule', icon: '\uD83D\uDCC5', label: 'Daily Schedule' },
  { id: 'recurring-tasks', icon: '\uD83D\uDD04', label: 'Recurring Tasks' },
  { id: 'info-system', icon: '\uD83D\uDCDA', label: 'Information System' },
  { id: '_divider1' },
  { id: 'daily-report', icon: '\uD83D\uDCCA', label: 'Daily Report' },
  { id: 'weekly-scorecard', icon: '\uD83C\uDFC6', label: 'Weekly Scorecard' },
  { id: 'next-week-plan', icon: '\uD83D\uDCC5', label: 'Week Plan' },
  { id: 'performance-analytics', icon: '\uD83D\uDCC8', label: 'Performance Analytics' },
  { id: '_divider2' },
  { id: 'registered-companies', icon: '\uD83C\uDFE2', label: 'Registered Companies' },
  { id: 'settings', icon: '\u2699', label: 'Settings' },
];

export default function Sidebar({ open, onClose }) {
  const { currentPage, setCurrentPage, user, logout, hasPermission } = useApp();

  function navigate(page) {
    if (!hasPermission(page)) return;
    setCurrentPage(page);
    onClose();
  }

  // Filter nav items based on user permissions
  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.id.startsWith('_divider')) return true; // keep dividers, we'll clean up empty ones
    return hasPermission(item.id);
  });

  // Remove orphaned dividers (dividers at start, end, or consecutive)
  const cleanedItems = visibleItems.filter((item, i, arr) => {
    if (!item.id.startsWith('_divider')) return true;
    // Remove if first, last, or previous is also a divider
    if (i === 0 || i === arr.length - 1) return false;
    if (arr[i - 1]?.id.startsWith('_divider')) return false;
    // Remove if next is also a divider or doesn't exist
    if (arr[i + 1]?.id.startsWith('_divider')) return false;
    return true;
  });

  return (
    <>
      <div className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>WIZONE</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5 }}>CEO PRODUCTIVITY</div>
        </div>
        <nav className="sidebar-nav">
          {cleanedItems.map(item => {
            if (item.id.startsWith('_divider')) return <div key={item.id} className="nav-divider" />;
            return (
              <a key={item.id} className={`nav-item${currentPage === item.id ? ' active' : ''}`} onClick={() => navigate(item.id)}>
                <span className="nav-icon">{item.icon}</span> {item.label}
              </a>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">{user?.name?.charAt(0) || 'C'}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>{user?.name || 'CEO'}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{user?.role || 'Administrator'}</div>
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={logout} style={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.2)', width: '100%', marginTop: 8, fontSize: 10 }}>Sign Out</button>
        </div>
      </div>
      {open && <div className="sidebar-overlay show" onClick={onClose} />}
    </>
  );
}
