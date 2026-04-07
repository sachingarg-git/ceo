import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useApp } from '../App';

const ICONS = {
  capture: '\u26A1', someday: '\uD83D\uDCCB', info: '\uD83D\uDCDA', high: '\uD83D\uDD25',
  tasks: '\uD83D\uDCCA', scheduled: '\uD83D\uDCC5', waiting: '\u23F3', completed: '\u2705',
  overdue: '\u26A0\uFE0F', recurring: '\uD83D\uDD04', dueToday: '\uD83D\uDEA8', dueTomorrow: '\uD83D\uDD52',
  completion: '\uD83C\uDFC6', days: '\uD83D\uDCC8',
};

export default function Dashboard() {
  const { showToast, setCurrentPage, user } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true); setError(false); setAnimate(false);
    try {
      const res = await api.getDashboard();
      if (res.success) { setData(res); setTimeout(() => setAnimate(true), 100); }
      else { setError(true); showToast('Failed to load dashboard', 'error'); }
    } catch { setError(true); showToast('Failed to load dashboard', 'error'); }
    setLoading(false);
  }

  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Good Morning' : today.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const dateStr = today.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div>
        <div className="page-header"><div><h2>Dashboard</h2></div></div>
        <div style={{ textAlign: 'center', padding: 80 }}><div className="spinner" /><p style={{ marginTop: 12, color: 'var(--muted)', fontSize: 12 }}>Loading dashboard...</p></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <div className="page-header"><div><h2>Dashboard</h2></div></div>
        <div className="glass-card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#128533;</div>
          <p style={{ color: 'var(--muted)', marginBottom: 16 }}>Unable to load dashboard data.</p>
          <button className="btn btn-primary" onClick={loadData}>Try Again</button>
        </div>
      </div>
    );
  }

  const qc = data.quickCapture || {};
  const sl = data.somedayList || {};
  const rt = data.recurringTasks || {};
  const mr = data.monthlyReport || {};
  const todayTasks = sl.scheduledToday || 0;
  const totalActive = (qc.total || 0) + (rt.active || 0);

  const kpiRows = [
    {
      title: 'Quick Capture',
      cards: [
        { label: 'Total Captures', value: qc.total || 0, icon: ICONS.capture, color: '#0D6E6E', bg: 'linear-gradient(135deg, #E0F2F2 0%, #B2DFDB 100%)' },
        { label: 'To Someday List', value: qc.toSomeday || 0, icon: ICONS.someday, color: '#3B82F6', bg: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)' },
        { label: 'To Info System', value: qc.toInfoSystem || 0, icon: ICONS.info, color: '#8B5CF6', bg: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)' },
        { label: 'High Priority', value: qc.highPriority || 0, icon: ICONS.high, color: '#EF4444', bg: 'linear-gradient(135deg, #FEF2F2 0%, #FECACA 100%)' },
      ]
    },
    {
      title: 'Someday List & Today',
      cards: [
        { label: 'Total SL Tasks', value: sl.total || 0, icon: ICONS.tasks, color: '#0D6E6E', bg: 'linear-gradient(135deg, #E0F2F2 0%, #B2DFDB 100%)' },
        { label: 'Scheduled Today', value: sl.scheduledToday || 0, icon: ICONS.scheduled, color: '#3B82F6', bg: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)' },
        { label: 'Waiting', value: sl.waiting || 0, icon: ICONS.waiting, color: '#F59E0B', bg: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)' },
        { label: 'Completed Today', value: sl.completed || 0, icon: ICONS.completed, color: '#10B981', bg: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)' },
        { label: 'Overdue', value: sl.overdue || 0, icon: ICONS.overdue, color: '#EF4444', bg: 'linear-gradient(135deg, #FEF2F2 0%, #FECACA 100%)' },
      ]
    },
    {
      title: 'Recurring & Performance',
      cards: [
        { label: 'Active Recurring', value: rt.active || 0, icon: ICONS.recurring, color: '#0D6E6E', bg: 'linear-gradient(135deg, #E0F2F2 0%, #B2DFDB 100%)' },
        { label: 'Due Today', value: rt.dueToday || 0, icon: ICONS.dueToday, color: '#F59E0B', bg: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)' },
        { label: 'Due Tomorrow', value: rt.dueTomorrow || 0, icon: ICONS.dueTomorrow, color: '#3B82F6', bg: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)' },
        { label: '30-Day Completion', value: `${mr.avgCompletion || 0}%`, icon: ICONS.completion, color: '#10B981', bg: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)' },
        { label: 'Days Tracked', value: mr.daysTracked || 0, icon: ICONS.days, color: '#8B5CF6', bg: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)' },
      ]
    },
  ];

  return (
    <div>
      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0D6E6E 0%, #14919B 50%, #0D6E6E 100%)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 24, color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 8px 32px rgba(13,110,110,0.25)',
        animation: animate ? 'fadeInDown 0.5s ease' : 'none',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{greeting}, {user?.name || 'CEO'}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{dateStr}</div>
          <div style={{ marginTop: 12, display: 'flex', gap: 20, fontSize: 12 }}>
            <span><strong>{totalActive}</strong> active tasks</span>
            <span><strong>{todayTasks}</strong> scheduled today</span>
            <span><strong>{rt.dueToday || 0}</strong> recurring due</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)' }} onClick={loadData}>&#8635; Refresh</button>
          <button className="btn btn-sm" style={{ background: 'white', color: 'var(--primary)', fontWeight: 700 }} onClick={() => setCurrentPage('quick-capture')}>+ Quick Capture</button>
        </div>
      </div>

      {/* KPI Sections */}
      {kpiRows.map((section, si) => (
        <div key={si} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, paddingLeft: 4 }}>{section.title}</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${section.cards.length}, 1fr)`, gap: 14 }}>
            {section.cards.map((card, ci) => (
              <div key={ci} style={{
                background: card.bg, borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden',
                border: `1px solid ${card.color}15`, cursor: 'default',
                transform: animate ? 'translateY(0)' : 'translateY(20px)',
                opacity: animate ? 1 : 0,
                transition: `all 0.4s cubic-bezier(0.4,0,0.2,1) ${si * 0.1 + ci * 0.06}s`,
              }}>
                <div style={{ position: 'absolute', top: -8, right: -8, fontSize: 48, opacity: 0.08 }}>{card.icon}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: card.color, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{card.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: card.color, opacity: 0.3, borderRadius: '0 0 14px 14px' }} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Today Overview + Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, animation: animate ? 'fadeInUp 0.6s ease 0.3s both' : 'none' }}>
        <div className="glass-card" style={{ padding: '20px 24px', borderLeft: '4px solid var(--info)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--secondary)' }}>Today's Schedule</h4>
            <button className="btn btn-xs btn-outline" onClick={() => setCurrentPage('daily-schedule')}>View &rarr;</button>
          </div>
          {todayTasks > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #3B82F6, #60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'white', fontWeight: 800 }}>{todayTasks}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{todayTasks} task{todayTasks > 1 ? 's' : ''} scheduled</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Click to view your daily schedule</div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>&#128203;</div>
              <div style={{ fontSize: 12 }}>No tasks scheduled for today</div>
            </div>
          )}
        </div>

        <div className="glass-card" style={{ padding: '20px 24px', borderLeft: `4px solid ${sl.overdue > 0 ? 'var(--danger)' : 'var(--success)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--secondary)' }}>Alerts & Status</h4>
            {sl.overdue > 0 && <span className="badge badge-overdue" style={{ animation: 'pulse 2s infinite' }}>{sl.overdue} Overdue</span>}
          </div>
          {sl.overdue > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #EF4444, #F87171)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'white', fontWeight: 800 }}>{sl.overdue}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)' }}>{sl.overdue} overdue task{sl.overdue > 1 ? 's' : ''}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>These tasks need your immediate attention</div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--success)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>&#9989;</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>All clear! No overdue tasks</div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 20, animation: animate ? 'fadeInUp 0.6s ease 0.4s both' : 'none' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, paddingLeft: 4 }}>Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {[
            { label: 'Quick Capture', icon: '\u26A1', page: 'quick-capture', color: '#0D6E6E' },
            { label: 'Daily Schedule', icon: '\uD83D\uDCC5', page: 'daily-schedule', color: '#3B82F6' },
            { label: 'Someday List', icon: '\uD83D\uDCCB', page: 'someday-list', color: '#F59E0B' },
            { label: 'Recurring Tasks', icon: '\uD83D\uDD04', page: 'recurring-tasks', color: '#10B981' },
            { label: 'Week Plan', icon: '\uD83D\uDCC6', page: 'next-week-plan', color: '#8B5CF6' },
          ].map((action, i) => (
            <button key={i} onClick={() => setCurrentPage(action.page)} style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12,
              padding: '16px 12px', cursor: 'pointer', textAlign: 'center',
              transition: 'all 0.2s', boxShadow: 'var(--shadow)',
            }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>{action.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: action.color }}>{action.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* System Workflow */}
      <div className="glass-card" style={{ padding: '20px 24px', animation: animate ? 'fadeInUp 0.6s ease 0.5s both' : 'none' }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: 'var(--secondary)' }}>System Workflow</h4>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', fontSize: 11 }}>
          {[
            { label: 'Quick Capture', bg: 'var(--primary-gradient)', cursor: 'quick-capture' },
            { label: 'Someday List', bg: 'linear-gradient(135deg, #3B82F6, #60A5FA)', cursor: 'someday-list' },
            { label: 'Daily Schedule', bg: 'linear-gradient(135deg, #10B981, #34D399)', cursor: 'daily-schedule' },
            { label: 'Daily Report', bg: 'linear-gradient(135deg, #1E293B, #334155)', cursor: 'daily-report' },
            { label: 'Weekly Scorecard', bg: 'linear-gradient(135deg, #8B5CF6, #A78BFA)', cursor: 'weekly-scorecard' },
          ].map((step, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ color: 'var(--muted)', fontSize: 14, margin: '0 2px' }}>&rarr;</span>}
              <div onClick={() => setCurrentPage(step.cursor)} style={{
                padding: '8px 16px', background: step.bg, color: 'white', borderRadius: 10,
                fontWeight: 600, cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
                onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >{step.label}</div>
            </React.Fragment>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: 10, fontSize: 11 }}>
          <div style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: 'white', borderRadius: 8, fontWeight: 600 }}>Recurring Tasks</div>
          <span style={{ color: 'var(--muted)' }}>feed into</span>
          <div style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #3B82F6, #60A5FA)', color: 'white', borderRadius: 8, fontWeight: 600 }}>Someday List</div>
          <span style={{ color: 'var(--muted)', margin: '0 12px' }}>|</span>
          <div style={{ padding: '6px 12px', background: 'var(--primary-gradient)', color: 'white', borderRadius: 8, fontWeight: 600 }}>Quick Capture</div>
          <span style={{ color: 'var(--muted)' }}>also feeds</span>
          <div style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)', color: 'white', borderRadius: 8, fontWeight: 600 }}>Info System</div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
