import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../App';
import { api } from '../api';

// ─── Mini Calendar Dropdown ────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_SHORT   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function formatISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function CalendarDropdown() {
  const today = formatISO(new Date());
  const [open, setOpen]       = useState(false);
  const [qcRows, setQcRows]   = useState([]);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [tooltip, setTooltip] = useState(null); // { dateStr, tasks, x, y }
  const wrapRef = useRef(null);
  const loaded  = useRef(false);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Fetch QC data once on first open
  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    api.getQuickCapture().then(r => { if (r.success) setQcRows(r.rows || []); }).catch(() => {});
  }, [open]);

  // Build dateKey → tasks map
  const taskMap = useMemo(() => {
    const map = {};
    qcRows.forEach(r => {
      if (!r.schedDate) return;
      if (!map[r.schedDate]) map[r.schedDate] = [];
      map[r.schedDate].push(r);
    });
    return map;
  }, [qcRows]);

  // Month summary
  const monthKey = calYear + '-' + String(calMonth+1).padStart(2,'0');
  const monthRows = qcRows.filter(r => r.schedDate && r.schedDate.startsWith(monthKey));
  const mScheduled = monthRows.filter(r => r.slStatus !== 'Completed').length;
  const mDone      = monthRows.filter(r => r.slStatus === 'Completed').length;

  // Calendar cells
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_,i) => i+1)];

  function dateStr(day) {
    return calYear + '-' + String(calMonth+1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
  }
  function prevMonth() { calMonth === 0 ? (setCalYear(y=>y-1), setCalMonth(11)) : setCalMonth(m=>m-1); }
  function nextMonth() { calMonth === 11 ? (setCalYear(y=>y+1), setCalMonth(0))  : setCalMonth(m=>m+1); }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {/* Calendar toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Open Calendar"
        style={{
          background: open ? 'var(--primary)' : 'var(--card-bg)',
          border: '1.5px solid var(--border)',
          borderRadius: 10, padding: '5px 10px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.2s', color: open ? '#fff' : 'var(--text)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ fontSize: 11, fontWeight: 700 }}>Calendar</span>
        {/* Show today's task count if any */}
        {(taskMap[today] || []).length > 0 && (
          <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 800, padding: '1px 5px', minWidth: 16, textAlign: 'center' }}>
            {taskMap[today].length}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Invisible bridge to prevent gap issues */}
          <div style={{
            position: 'absolute', top: '100%', right: 0,
            width: 320, height: 12,
            background: 'transparent',
          }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: 320, zIndex: 9999,
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            overflow: 'visible',
          }}>
          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--primary-gradient)', borderRadius: '16px 16px 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button onClick={prevMonth} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 14, fontWeight: 700 }}>◀</button>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#fff', letterSpacing: 0.5 }}>{MONTH_NAMES[calMonth]} {calYear}</span>
              <button onClick={nextMonth} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 14, fontWeight: 700 }}>▶</button>
            </div>
            {/* Month summary badges */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 20, padding: '2px 10px' }}>📋 {mScheduled} Scheduled</span>
              <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(16,185,129,0.35)', color: '#fff', borderRadius: 20, padding: '2px 10px' }}>✅ {mDone} Done</span>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '12px 14px' }}>
            {/* Day names */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
              {DAY_SHORT.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{d}</div>
              ))}
            </div>

            {/* Date cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, position: 'relative' }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const ds    = dateStr(day);
                const tasks = taskMap[ds] || [];
                const isToday    = ds === today;
                const hasSched   = tasks.some(t => t.slStatus !== 'Completed');
                const hasComp    = tasks.some(t => t.slStatus === 'Completed');
                const allDone    = tasks.length > 0 && tasks.every(t => t.slStatus === 'Completed');

                // Styling
                let bg = 'transparent', color = 'var(--text)', border = '1.5px solid transparent';
                if (allDone)       { bg = '#d1fae5'; color = '#065f46'; border = '1.5px solid #6ee7b7'; }
                else if (hasSched) { bg = '#dbeafe'; color = '#1d4ed8'; border = '1.5px solid #93c5fd'; }
                if (isToday)       { border = '2px solid var(--primary)'; }

                return (
                  <div
                    key={i}
                    onMouseEnter={e => {
                      if (tasks.length === 0) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({ dateStr: ds, tasks, rect });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      textAlign: 'center', borderRadius: 8, cursor: tasks.length ? 'pointer' : 'default',
                      background: bg, color, border,
                      fontSize: 11, fontWeight: isToday ? 800 : 600,
                      padding: '4px 2px', minHeight: 34,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.12s',
                      position: 'relative',
                    }}
                  >
                    {isToday && (
                      <span style={{ position: 'absolute', top: 2, right: 3, width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} />
                    )}
                    {day}
                    {/* Dot indicators */}
                    {tasks.length > 0 && (
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 1 }}>
                        {hasSched && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />}
                        {hasComp  && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />}
                      </div>
                    )}
                    {/* Task count badge */}
                    {tasks.length > 1 && (
                      <span style={{ fontSize: 7, fontWeight: 800, background: hasSched ? '#3b82f6' : '#10b981', color: '#fff', borderRadius: 6, padding: '0 3px', lineHeight: '10px', marginTop: 1 }}>
                        {tasks.length}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { bg: '#dbeafe', border: '#93c5fd', dot: '#3b82f6', label: 'Scheduled' },
                { bg: '#d1fae5', border: '#6ee7b7', dot: '#10b981', label: 'All Done'  },
                { bg: 'transparent', border: 'var(--primary)', dot: 'var(--primary)', label: 'Today' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: l.bg, border: `1.5px solid ${l.border}`, display: 'inline-block' }} />
                  <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600 }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        </>
      )}

      {/* Tooltip portal — positioned below the calendar */}
      {tooltip && (() => {
        // Get calendar dropdown position
        const calendarRect = wrapRef.current?.getBoundingClientRect();
        if (!calendarRect) return null;
        
        const popupWidth = 300;
        
        // Position below calendar, aligned to calendar's right edge
        let left = calendarRect.right - popupWidth;
        let top = calendarRect.bottom + 10; // 10px below calendar
        
        // Ensure it stays within viewport bounds
        left = Math.max(10, Math.min(left, window.innerWidth - popupWidth - 10));
        
        return (
          <div style={{
            position: 'fixed', left, top, zIndex: 99999,
            background: '#0f172a', color: '#f1f5f9',
            borderRadius: 12, padding: '12px 14px',
            width: popupWidth - 28,
            maxHeight: 300, overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            pointerEvents: 'none', border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ fontWeight: 800, fontSize: 10, marginBottom: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
              {tooltip.dateStr} — {tooltip.tasks.length} task{tooltip.tasks.length !== 1 ? 's' : ''}
            </div>
            {tooltip.tasks.map((t, i) => (
              <div key={i} style={{
                marginBottom: i < tooltip.tasks.length - 1 ? 8 : 0,
                paddingBottom: i < tooltip.tasks.length - 1 ? 8 : 0,
                borderBottom: i < tooltip.tasks.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: t.slStatus === 'Completed' ? '#6ee7b7' : '#7dd3fc', marginBottom: 4 }}>
                  {t.slStatus === 'Completed' ? '✅' : '📋'} {t.description}
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {t.schedTimeFrom && (
                    <span style={{ fontSize: 10, background: 'rgba(14,165,233,0.25)', color: '#7dd3fc', borderRadius: 5, padding: '1px 7px', fontWeight: 600 }}>
                      🕐 {t.schedTimeFrom}{t.schedTimeTo ? ' – ' + t.schedTimeTo : ''}
                    </span>
                  )}
                  {t.priority && (
                    <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.25)', color: '#fcd34d', borderRadius: 5, padding: '1px 7px', fontWeight: 600 }}>
                      {t.priority}
                    </span>
                  )}
                  <span style={{ fontSize: 10, background: t.slStatus === 'Completed' ? 'rgba(16,185,129,0.25)' : 'rgba(59,130,246,0.25)', color: t.slStatus === 'Completed' ? '#6ee7b7' : '#93c5fd', borderRadius: 5, padding: '1px 7px', fontWeight: 600 }}>
                    {t.slStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

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
  const isCEO = user?.type === 'ceo';

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
        <CalendarDropdown />
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
