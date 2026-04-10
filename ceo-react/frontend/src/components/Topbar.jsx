import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../App';
import { api } from '../api';

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

function OnlineIndicator({ user }) {
  const [online, setOnline] = useState({ total: 0, companies: 0, users: 0, list: [] });
  const [showPopup, setShowPopup] = useState(false);
  const isCEO = user?.type === 'ceo' || !user?.companyId || user?.companyId === 0;

  // Heartbeat — send every 30s
  useEffect(() => {
    if (!user) return;
    const ping = () => api.heartbeat({
      userId: user.id || user.username,
      userName: user.name || user.username,
      userType: user.type || 'user',
      companyId: user.companyId || 0,
    }).catch(() => {});
    ping();
    const hb = setInterval(ping, 30000);
    return () => clearInterval(hb);
  }, [user]);

  // Poll online count every 30s (CEO only)
  useEffect(() => {
    if (!isCEO) return;
    const fetch = () => api.getOnlineUsers().then(r => { if (r.success) setOnline(r); }).catch(() => {});
    fetch();
    const id = setInterval(fetch, 30000);
    return () => clearInterval(id);
  }, [isCEO]);

  if (!isCEO) return null;

  return (
    <div style={{ position: 'relative' }}>
      <div onClick={() => setShowPopup(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        background: 'linear-gradient(135deg,#10B981,#059669)', borderRadius: 10,
        padding: '5px 12px',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 2px rgba(255,255,255,0.4)', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{online.total} Online</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>🏢{online.companies} 👤{online.users}</span>
      </div>

      {showPopup && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', top: '110%', right: 0, width: 260,
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.15)', zIndex: 999, overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>🟢 Live Users Online</span>
            <button onClick={() => setShowPopup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {online.list.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>No one online</div>
            ) : online.list.map((u, i) => (
              <div key={i} style={{ padding: '9px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', flexShrink: 0, display: 'inline-block' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{u.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{u.type === 'company' ? '🏢 Company' : '👤 User'}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '8px 16px', background: 'var(--bg)', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
            Auto-refreshes every 30s
          </div>
        </div>
      )}
      <style>{`@keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

export default function Topbar({ onToggleSidebar }) {
  const { currentPage, user, theme, toggleTheme } = useApp();

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="hamburger" onClick={onToggleSidebar}>&#9776;</button>
        <h3 className="topbar-title">{PAGE_TITLES[currentPage] || currentPage}</h3>
      </div>
      <div className="topbar-right">
        <OnlineIndicator user={user} />
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
