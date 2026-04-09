import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useApp } from '../App';

function getCurrentWeekNum() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 2, 1); // March 1
  const diff = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1);
}

export default function WeeklyScorecard() {
  const { showToast } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [editData, setEditData] = useState({ achievements: '', carryForward: '' });
  const [saving, setSaving] = useState(false);

  const currentWeek = getCurrentWeekNum();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.getWeeklyScorecard();
      if (res.success) {
        setData(res);
      } else {
        showToast('Failed to load weekly scorecard', 'error');
      }
    } catch {
      showToast('Error loading weekly scorecard', 'error');
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(weekNum, week) {
    if (expandedWeek === weekNum) {
      setExpandedWeek(null);
    } else {
      setExpandedWeek(weekNum);
      setEditData({
        achievements: week.achievements || '',
        carryForward: week.carryForward || '',
      });
    }
  }

  async function handleSave(weekNum) {
    setSaving(true);
    try {
      const res = await api.updateWeeklyScorecard({
        weekNum,
        achievements: editData.achievements,
        carryForward: editData.carryForward,
      });
      if (res.success) {
        showToast('Week updated', 'success');
        setExpandedWeek(null);
        loadData();
      } else {
        showToast(res.error || 'Update failed', 'error');
      }
    } catch {
      showToast('Error saving update', 'error');
    } finally {
      setSaving(false);
    }
  }

  function getCompletionBadge(pct) {
    if (pct == null) return 'badge-secondary';
    if (pct >= 80) return 'badge-success';
    if (pct >= 50) return 'badge-warning';
    return 'badge-danger';
  }

  function getRatingColor(rating) {
    if (!rating && rating !== 0) return 'inherit';
    const n = Number(rating);
    if (n >= 8) return '#22c55e';
    if (n >= 5) return '#f59e0b';
    return '#ef4444';
  }

  if (loading) {
    return (
      <div>
        <div className="page-header"></div>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" />
          <p style={{ marginTop: '1rem', opacity: 0.7 }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <div className="page-header"></div>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Unable to load scorecard data.</p>
          <button className="btn btn-primary" onClick={loadData}>Retry</button>
        </div>
      </div>
    );
  }

  const { weeks = [], year } = data;

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-outline" onClick={loadData}>Refresh</button>
      </div>

      <div className="glass-card">
        <div className="glass-card-header">
          <span>Week-by-Week Performance</span>
          <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Current: Week {currentWeek}</span>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Week</th>
                <th>Period</th>
                <th>Planned</th>
                <th>Done</th>
                <th>Completion</th>
                <th>Avg Rating</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {weeks.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No weeks available</td>
                </tr>
              ) : (
                weeks.map(week => (
                  <React.Fragment key={week.weekNum}>
                    <tr
                      style={{
                        cursor: 'pointer',
                        background: week.weekNum === currentWeek ? 'rgba(99, 102, 241, 0.08)' : undefined,
                        borderLeft: week.weekNum === currentWeek ? '3px solid #6366f1' : '3px solid transparent',
                      }}
                      onClick={() => toggleExpand(week.weekNum, week)}
                    >
                      <td style={{ fontWeight: week.weekNum === currentWeek ? 700 : 500 }}>
                        W{week.weekNum}
                        {week.weekNum === currentWeek && (
                          <span className="badge badge-primary" style={{ marginLeft: 6, fontSize: '0.65rem' }}>Current</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        {week.startDate} - {week.endDate}
                      </td>
                      <td>{week.planned || 0}</td>
                      <td>{week.done || 0}</td>
                      <td>
                        <span className={`badge ${getCompletionBadge(week.completionPct)}`}>
                          {week.completionPct != null ? `${week.completionPct}%` : '--'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: getRatingColor(week.avgDayRating) }}>
                          {week.avgDayRating != null ? Number(week.avgDayRating).toFixed(1) : '--'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={e => { e.stopPropagation(); toggleExpand(week.weekNum, week); }}
                        >
                          {expandedWeek === week.weekNum ? 'Close' : 'Edit'}
                        </button>
                      </td>
                    </tr>
                    {expandedWeek === week.weekNum && (
                      <tr>
                        <td colSpan={7} style={{ padding: '1rem 1.5rem', background: 'rgba(99, 102, 241, 0.03)' }}>
                          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                              <label className="form-label">Achievements</label>
                              <textarea
                                className="form-textarea"
                                rows={3}
                                value={editData.achievements}
                                onChange={e => setEditData({ ...editData, achievements: e.target.value })}
                                placeholder="Key achievements this week..."
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Carry Forward</label>
                              <textarea
                                className="form-textarea"
                                rows={3}
                                value={editData.carryForward}
                                onChange={e => setEditData({ ...editData, carryForward: e.target.value })}
                                placeholder="Tasks to carry forward..."
                              />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => setExpandedWeek(null)}>Cancel</button>
                            <button className="btn btn-primary btn-sm" onClick={() => handleSave(week.weekNum)} disabled={saving}>
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
