import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useApp } from '../App';

export default function DailyReport() {
  const { showToast } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.getDailyReport();
      if (res.success) {
        setData(res);
      } else {
        showToast('Failed to load daily report', 'error');
      }
    } catch {
      showToast('Error loading daily report', 'error');
    } finally {
      setLoading(false);
    }
  }

  function openEdit(day) {
    setEditRow({
      date: day.date,
      dateFormatted: day.dateFormatted,
      dayRating: day.dayRating || '',
      achievements: day.achievements || '',
      notes: day.notes || '',
    });
  }

  async function handleSave() {
    if (!editRow) return;
    setSaving(true);
    try {
      const res = await api.updateDailyReport({
        date: editRow.date,
        dayRating: editRow.dayRating,
        achievements: editRow.achievements,
        notes: editRow.notes,
      });
      if (res.success) {
        showToast('Day updated', 'success');
        setEditRow(null);
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

  function getRatingColor(rating) {
    if (!rating && rating !== 0) return 'inherit';
    const n = Number(rating);
    if (n >= 8) return '#22c55e';
    if (n >= 5) return '#f59e0b';
    return '#ef4444';
  }

  function getCompletionBadge(pct) {
    if (pct == null) return 'badge-secondary';
    if (pct >= 80) return 'badge-success';
    if (pct >= 50) return 'badge-warning';
    return 'badge-danger';
  }

  if (loading) {
    return (
      <div>
        <div className="page-header"><h1>Daily Report</h1></div>
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
        <div className="page-header"><h1>Daily Report</h1></div>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Unable to load report data.</p>
          <button className="btn btn-primary" onClick={loadData}>Retry</button>
        </div>
      </div>
    );
  }

  const { days = [], monthlySummary = {} } = data;

  return (
    <div>
      <div className="page-header">
        <h1>Daily Report</h1>
        <button className="btn btn-outline" onClick={loadData}>Refresh</button>
      </div>

      {/* KPI Summary Cards */}
      <div className="kpi-grid">
        <div className="kpi-card accent-primary">
          <div className="kpi-label">Total Tasks</div>
          <div className="kpi-value">{monthlySummary.totalScheduled || 0}</div>
          <div className="kpi-change">{monthlySummary.totalCompleted || 0} completed</div>
        </div>
        <div className="kpi-card accent-success">
          <div className="kpi-label">Completion Rate</div>
          <div className="kpi-value">{monthlySummary.overallCompletionPct || 0}%</div>
          <div className="kpi-change">{monthlySummary.daysAbove80Pct || 0} days above 80%</div>
        </div>
        <div className="kpi-card accent-info">
          <div className="kpi-label">Avg Tasks/Day</div>
          <div className="kpi-value">{monthlySummary.avgTasksPerDay || 0}</div>
          <div className="kpi-change">{monthlySummary.daysBelow50Pct || 0} days below 50%</div>
        </div>
        <div className="kpi-card accent-accent">
          <div className="kpi-label">Days Tracked</div>
          <div className="kpi-value">{monthlySummary.daysTracked || 0}</div>
          <div className="kpi-change">Last 30 days</div>
        </div>
      </div>

      {/* Days Table */}
      <div className="glass-card" style={{ marginTop: '1.5rem' }}>
        <div className="glass-card-header">
          <span>Last 30 Days</span>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Rating</th>
                <th>Scheduled</th>
                <th>Completed</th>
                <th>%</th>
                <th>Waiting</th>
                <th>Achievements</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {days.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No data available</td>
                </tr>
              ) : (
                days.map(day => (
                  <tr key={day.date} style={{ cursor: 'pointer' }} onClick={() => openEdit(day)}>
                    <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{day.dateFormatted || day.date}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: getRatingColor(day.dayRating) }}>
                        {day.dayRating || '--'}
                      </span>
                    </td>
                    <td>{day.scheduled || 0}</td>
                    <td>{day.completed || 0}</td>
                    <td>
                      <span className={`badge ${getCompletionBadge(day.completionPct)}`}>
                        {day.completionPct != null ? `${day.completionPct}%` : '--'}
                      </span>
                    </td>
                    <td>{day.waiting || 0}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {day.achievements || '--'}
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); openEdit(day); }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editRow && (
        <div className="modal-overlay" onClick={() => setEditRow(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Day - {editRow.dateFormatted || editRow.date}</h3>
              <button className="modal-close" onClick={() => setEditRow(null)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Day Rating (1-10)</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  max={10}
                  value={editRow.dayRating}
                  onChange={e => setEditRow({ ...editRow, dayRating: e.target.value })}
                  placeholder="1-10"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Achievements</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={editRow.achievements}
                  onChange={e => setEditRow({ ...editRow, achievements: e.target.value })}
                  placeholder="Key achievements for the day..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={editRow.notes}
                  onChange={e => setEditRow({ ...editRow, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditRow(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
