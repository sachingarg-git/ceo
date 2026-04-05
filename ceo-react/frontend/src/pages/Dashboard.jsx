import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useApp } from '../App';

export default function Dashboard() {
  const { showToast, setCurrentPage } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError(false);
    try {
      const res = await api.getDashboard();
      if (res.success) {
        setData(res);
      } else {
        setError(true);
        showToast('Failed to load dashboard', 'error');
      }
    } catch {
      setError(true);
      showToast('Failed to load dashboard', 'error');
    }
    setLoading(false);
  }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <div>
        <div className="page-header"><div><h2>Dashboard</h2><p>CEO Productivity Command Center</p></div></div>
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <div className="page-header"><div><h2>Dashboard</h2><p>CEO Productivity Command Center</p></div></div>
        <div className="glass-card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Unable to load dashboard data.</p>
          <button className="btn btn-primary" onClick={loadData}>Retry</button>
        </div>
      </div>
    );
  }

  const qc = data.quickCapture || {};
  const sl = data.somedayList || {};
  const rt = data.recurringTasks || {};
  const mr = data.monthlyReport || {};

  return (
    <div>
      <div className="page-header">
        <div><h2>Dashboard</h2><p>CEO Productivity Command Center</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{today}</span>
          <button className="btn btn-primary btn-sm" onClick={() => setCurrentPage('quick-capture')}>+ Quick Capture</button>
        </div>
      </div>

      {/* ROW 1: Quick Capture Stats */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--primary)' }}>
          <div className="kpi-label">Total Captures</div>
          <div className="kpi-value">{qc.total || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--info)' }}>
          <div className="kpi-label">To Someday List</div>
          <div className="kpi-value">{qc.toSomeday || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--accent)' }}>
          <div className="kpi-label">To Info System</div>
          <div className="kpi-value">{qc.toInfoSystem || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--danger)' }}>
          <div className="kpi-label">High Priority</div>
          <div className="kpi-value">{qc.highPriority || 0}</div>
        </div>
      </div>

      {/* ROW 2: Someday List + Today Stats */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--primary)' }}>
          <div className="kpi-label">Total SL Tasks</div>
          <div className="kpi-value">{sl.total || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--info)' }}>
          <div className="kpi-label">Scheduled Today</div>
          <div className="kpi-value">{sl.scheduledToday || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--warning)' }}>
          <div className="kpi-label">Waiting</div>
          <div className="kpi-value">{sl.waiting || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--success)' }}>
          <div className="kpi-label">Completed Today</div>
          <div className="kpi-value">{sl.completed || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--danger)' }}>
          <div className="kpi-label">Overdue</div>
          <div className="kpi-value">{sl.overdue || 0}</div>
        </div>
      </div>

      {/* ROW 3: Recurring + Monthly */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--primary)' }}>
          <div className="kpi-label">Active Recurring</div>
          <div className="kpi-value">{rt.active || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--warning)' }}>
          <div className="kpi-label">Due Today (RT)</div>
          <div className="kpi-value">{rt.dueToday || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--info)' }}>
          <div className="kpi-label">Due Tomorrow (RT)</div>
          <div className="kpi-value">{rt.dueTomorrow || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--success)' }}>
          <div className="kpi-label">30-Day Avg Completion</div>
          <div className="kpi-value">{mr.avgCompletion || 0}%</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--primary)' }}>
          <div className="kpi-label">Days Tracked</div>
          <div className="kpi-value">{mr.daysTracked || 0}</div>
        </div>
      </div>

      {/* TODAY'S OVERVIEW */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="glass-card">
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--secondary)' }}>Today's Scheduled Tasks</h4>
          <div className="empty-state" style={{ padding: 20 }}>
            <div className="empty-icon" style={{ fontSize: 24 }}>&#128203;</div>
            <p style={{ fontSize: 11 }}>{sl.scheduledToday > 0 ? `${sl.scheduledToday} tasks scheduled` : 'No tasks scheduled for today'}</p>
          </div>
        </div>
        <div className="glass-card">
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--secondary)' }}>Alerts & Notifications</h4>
          <div className="empty-state" style={{ padding: 20 }}>
            <div className="empty-icon" style={{ fontSize: 24 }}>{sl.overdue > 0 ? '\u26A0' : '\u2705'}</div>
            <p style={{ fontSize: 11 }}>{sl.overdue > 0 ? `${sl.overdue} overdue tasks need attention` : 'All clear! No overdue tasks'}</p>
          </div>
        </div>
      </div>

      {/* SYSTEM FLOW DIAGRAM */}
      <div className="glass-card" style={{ marginTop: 16 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: 'var(--secondary)' }}>System Workflow</h4>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', fontSize: 11 }}>
          <div style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', borderRadius: 8, fontWeight: 600 }}>Quick Capture</div>
          <span style={{ color: 'var(--muted)', fontSize: 16 }}>&rarr;</span>
          <div style={{ padding: '8px 16px', background: 'var(--info)', color: 'white', borderRadius: 8, fontWeight: 600 }}>Someday List</div>
          <span style={{ color: 'var(--muted)', fontSize: 16 }}>&rarr;</span>
          <div style={{ padding: '8px 16px', background: 'var(--success)', color: 'white', borderRadius: 8, fontWeight: 600 }}>Daily Schedule</div>
          <span style={{ color: 'var(--muted)', fontSize: 16 }}>&rarr;</span>
          <div style={{ padding: '8px 16px', background: 'var(--secondary)', color: 'white', borderRadius: 8, fontWeight: 600 }}>Daily Report</div>
          <span style={{ color: 'var(--muted)', fontSize: 16 }}>&rarr;</span>
          <div style={{ padding: '8px 16px', background: 'var(--accent)', color: 'white', borderRadius: 8, fontWeight: 600 }}>Weekly Scorecard</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12, fontSize: 11 }}>
          <div style={{ padding: '6px 12px', background: 'var(--warning)', color: 'white', borderRadius: 8, fontWeight: 600 }}>Recurring Tasks</div>
          <span style={{ color: 'var(--muted)' }}>feed into</span>
          <div style={{ padding: '6px 12px', background: 'var(--info)', color: 'white', borderRadius: 8, fontWeight: 600 }}>Someday List</div>
          <span style={{ color: 'var(--muted)', margin: '0 16px' }}>|</span>
          <div style={{ padding: '6px 12px', background: 'var(--primary)', color: 'white', borderRadius: 8, fontWeight: 600 }}>Quick Capture</div>
          <span style={{ color: 'var(--muted)' }}>also feeds</span>
          <div style={{ padding: '6px 12px', background: '#8E24AA', color: 'white', borderRadius: 8, fontWeight: 600 }}>Info System</div>
        </div>
      </div>
    </div>
  );
}
