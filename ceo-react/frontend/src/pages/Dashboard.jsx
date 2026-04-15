import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useApp } from '../App';

export default function Dashboard() {
  const { showToast, setCurrentPage, user } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [qcRows, setQcRows] = useState([]);
  const [popup, setPopup] = useState(null); // { title, items }

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true); setError(false); setAnimate(false);
    try {
      const [res, qcRes] = await Promise.all([api.getDashboard(), api.getQuickCapture()]);
      if (res.success) { setData(res); setTimeout(() => setAnimate(true), 100); }
      else { setError(true); }
      if (qcRes.success) setQcRows(qcRes.rows || []);
    } catch { setError(true); }
    setLoading(false);
  }

  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = today.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><div className="spinner" /></div>;
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#128533;</div>
        <p style={{ color: 'var(--muted)', marginBottom: 16 }}>Unable to load dashboard</p>
        <button className="btn btn-primary" onClick={loadData}>Retry</button>
      </div>
    );
  }

  const qc = data.quickCapture || {};
  const sl = data.somedayList || {};
  const rt = data.recurringTasks || {};
  const totalActive = (qc.total || 0) + (rt.active || 0);
  const todayISO = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');

  // Today's scheduled tasks from QC
  const todayTasks = qcRows.filter(r => r.schedDate === todayISO && r.slStatus !== 'Completed').slice(0, 5);
  // Recent captures (last 3)
  const recentCaptures = qcRows.slice(-3).reverse();

  // Status popup data builders
  const overdueRows = qcRows.filter(r => r.schedDate && r.schedDate < todayISO && r.slStatus !== 'Completed');
  const waitingRows = qcRows.filter(r => r.slStatus === 'Waiting');
  const completedTodayRows = qcRows.filter(r => r.slStatus === 'Completed' && r.doneDate === todayISO);
  const somedayRows = qcRows.filter(r => r.sendTo === 'Someday List' && r.slStatus !== 'Completed');

  function openPopup(label, rows) {
    setPopup({ title: label, items: rows });
  }

  const card = { background: 'var(--card-bg)', borderRadius: 16, padding: '20px 24px', color: 'var(--text)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' };

  return (
    <div>
      {/* Hero Header */}
      <div style={{
        ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
        opacity: animate ? 1 : 0, transform: animate ? 'translateY(0)' : 'translateY(10px)', transition: 'all 0.4s ease',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{greeting}, {user?.name || 'CEO'}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{dateStr} &middot; {totalActive} active tasks</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={loadData} style={{ width: 42, height: 42, borderRadius: 12, border: '1px solid #E2E8F0', background: '#F8FAFC', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}
            onMouseOver={e => e.currentTarget.style.background = '#E2E8F0'} onMouseOut={e => e.currentTarget.style.background = '#F8FAFC'}>&#8635;</button>
          <button onClick={() => setCurrentPage('quick-capture')} style={{ height: 42, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #2563EB, #3B82F6)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 6, transition: '0.2s', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
            onMouseOver={e => e.currentTarget.style.opacity = '0.9'} onMouseOut={e => e.currentTarget.style.opacity = '1'}>+ Capture</button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { value: totalActive, label: 'Active tasks', dot: '#818CF8', bg: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)', numColor: '#4F46E5' },
          { value: rt.dueToday || 0, label: 'Recurring due', dot: '#F59E0B', bg: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', numColor: '#D97706' },
          { value: sl.scheduledToday || 0, label: 'Scheduled today', dot: '#3B82F6', bg: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', numColor: '#2563EB' },
          { value: qc.highPriority || 0, label: 'High priority', dot: '#F43F5E', bg: 'linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%)', numColor: '#E11D48' },
        ].map((kpi, i) => (
          <div key={i} style={{
            ...card, background: kpi.bg, border: 'none',
            opacity: animate ? 1 : 0, transform: animate ? 'translateY(0)' : 'translateY(16px)',
            transition: `all 0.4s ease ${0.1 + i * 0.08}s`,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: kpi.dot, marginBottom: 10 }} />
            <div style={{ fontSize: 36, fontWeight: 900, color: kpi.numColor, lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontSize: 12, color: kpi.numColor, opacity: 0.7, marginTop: 6, fontWeight: 600 }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Middle Row: Today's Tasks + Status Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        {/* Today's Tasks */}
        <div style={{
          ...card, opacity: animate ? 1 : 0, transform: animate ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.4s ease 0.4s',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>Today's Tasks</div>
          {todayTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)', fontSize: 13 }}>No tasks scheduled for today</div>
          ) : todayTasks.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: i > 0 ? '1px solid #334155' : 'none' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t.description}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {t.schedTimeFrom || ''}{t.batchType ? ' · ' + t.batchType : ''}{t.priority ? ' · ' + t.priority : ''}
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                background: t.priority === 'High' ? 'rgba(244,63,94,0.15)' : 'rgba(59,130,246,0.15)',
                color: t.priority === 'High' ? '#F43F5E' : '#60A5FA',
              }}>{t.priority === 'High' ? 'High' : 'Pending'}</span>
            </div>
          ))}
        </div>

        {/* Status Overview */}
        <div style={{
          ...card, opacity: animate ? 1 : 0, transform: animate ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.4s ease 0.5s',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>Status Overview</div>
          {[
            { label: 'Overdue', value: sl.overdue || overdueRows.length, dot: '#EF4444', rows: overdueRows },
            { label: 'Waiting', value: sl.waiting || waitingRows.length, dot: '#F59E0B', rows: waitingRows },
            { label: 'Completed today', value: sl.completed || completedTodayRows.length, dot: '#10B981', rows: completedTodayRows },
            { label: 'Someday list', value: sl.total || somedayRows.length, dot: '#8B5CF6', rows: somedayRows },
          ].map((item, i) => (
            <div key={i} onClick={() => openPopup(item.label, item.rows)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, borderTop: i > 0 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.dot }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: item.value > 0 && item.dot === '#EF4444' ? '#EF4444' : 'var(--text)' }}>{item.value}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>›</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>30-day completion</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#10B981' }}>0%</span>
            </div>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: '0%', height: '100%', background: 'linear-gradient(90deg, #10B981, #34D399)', borderRadius: 2 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Captures */}
      <div style={{
        ...card, opacity: animate ? 1 : 0, transform: animate ? 'translateY(0)' : 'translateY(16px)',
        transition: 'all 0.4s ease 0.6s',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>Recent Captures</div>
        {recentCaptures.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)', fontSize: 13 }}>No recent captures</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(recentCaptures.length, 3)}, 1fr)`, gap: 12 }}>
            {recentCaptures.map((t, i) => (
              <div key={i} style={{ background: 'var(--bg)', borderRadius: 12, padding: '16px 18px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#000000', marginBottom: 8 }}>{t.description}</div>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                  background: t.sendTo === 'Someday List' ? 'rgba(139,92,246,0.15)' : t.priority === 'High' ? 'rgba(244,63,94,0.15)' : 'rgba(59,130,246,0.15)',
                  color: t.sendTo === 'Someday List' ? '#A78BFA' : t.priority === 'High' ? '#F43F5E' : '#60A5FA',
                }}>{t.priority === 'High' ? 'High' : t.sendTo === 'Someday List' ? 'Someday' : 'Info'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Popup Modal */}
      {popup && (
        <div onClick={() => setPopup(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '75vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{popup.title}</div>
              <button onClick={() => setPopup(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>✕</button>
            </div>
            {/* Body */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
              {popup.items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>No tasks found</div>
              ) : popup.items.map((t, i) => (
                <div key={i} style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t.description}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {t.schedDate || 'No date'}{t.schedTimeFrom ? ' · ' + t.schedTimeFrom : ''}{t.priority ? ' · ' + t.priority : ''}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap',
                    background: t.slStatus === 'Completed' ? 'rgba(16,185,129,0.15)' : t.slStatus === 'Waiting' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                    color: t.slStatus === 'Completed' ? '#10B981' : t.slStatus === 'Waiting' ? '#F59E0B' : '#3B82F6',
                  }}>{t.slStatus || 'Scheduled'}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{popup.items.length} task{popup.items.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
