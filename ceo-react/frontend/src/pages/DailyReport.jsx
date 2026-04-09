import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useApp } from '../App';

const RATING_OPTIONS = ['', 'Excellent', 'Good', 'Average', 'Poor', 'Bad'];

export default function DailyReport() {
  const { showToast } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState(null); // { date, field }
  const [localEdits, setLocalEdits] = useState({}); // { [date]: { achievements, notes, dayRating } }
  const savingRef = useRef(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.getDailyReport();
      if (res.success) {
        setData(res);
        // Initialize local edits from data
        const edits = {};
        (res.days || []).forEach(day => {
          edits[day.date] = {
            achievements: day.achievements || '',
            notes: day.notes || '',
            dayRating: day.dayRating || '',
          };
        });
        setLocalEdits(edits);
      } else {
        showToast('Failed to load daily report', 'error');
      }
    } catch {
      showToast('Error loading daily report', 'error');
    } finally {
      setLoading(false);
    }
  }

  function updateLocal(date, field, value) {
    setLocalEdits(prev => ({
      ...prev,
      [date]: { ...prev[date], [field]: value },
    }));
  }

  async function saveField(date) {
    if (savingRef.current) return;
    savingRef.current = true;
    const edit = localEdits[date];
    if (!edit) { savingRef.current = false; return; }
    try {
      const res = await api.updateDailyReport({
        date,
        achievements: edit.achievements,
        notes: edit.notes,
        dayRating: edit.dayRating,
      });
      if (res.success) {
        showToast('Saved', 'success');
      } else {
        showToast(res.error || 'Update failed', 'error');
      }
    } catch {
      showToast('Error saving', 'error');
    } finally {
      savingRef.current = false;
      setEditingCell(null);
    }
  }

  function handleRatingChange(date, value) {
    updateLocal(date, 'dayRating', value);
    // Auto-save on change
    setTimeout(() => {
      const edit = { ...localEdits[date], dayRating: value };
      api.updateDailyReport({ date, achievements: edit.achievements, notes: edit.notes, dayRating: value })
        .then(res => {
          if (res.success) showToast('Rating saved', 'success');
          else showToast('Failed to save rating', 'error');
        })
        .catch(() => showToast('Error saving rating', 'error'));
    }, 50);
  }

  function getCompletionColor(pct) {
    if (pct == null) return '#94a3b8';
    if (pct >= 80) return '#22c55e';
    if (pct >= 50) return '#f59e0b';
    return '#ef4444';
  }

  function getRatingColor(rating) {
    if (!rating) return 'var(--muted)';
    switch (rating) {
      case 'Excellent': return '#22c55e';
      case 'Good': return '#3b82f6';
      case 'Average': return '#f59e0b';
      case 'Poor': return '#f97316';
      case 'Bad': return '#ef4444';
      default: return 'inherit';
    }
  }

  if (loading) {
    return (
      <div>
        <div className="page-header"><div></div></div>
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
        <div className="page-header"><div></div></div>
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
        <div></div>
        <button className="btn btn-outline btn-sm" onClick={loadData}>Refresh</button>
      </div>

      {/* KPI Row 1 */}
      <div className="kpi-grid">
        <div className="kpi-card accent-accent">
          <div className="kpi-label">Days Tracked</div>
          <div className="kpi-value">{monthlySummary.daysTracked || 0}</div>
        </div>
        <div className="kpi-card accent-primary">
          <div className="kpi-label">Total Scheduled</div>
          <div className="kpi-value">{monthlySummary.totalScheduled || 0}</div>
        </div>
        <div className="kpi-card accent-success">
          <div className="kpi-label">Total Completed</div>
          <div className="kpi-value">{monthlySummary.totalCompleted || 0}</div>
        </div>
        <div className="kpi-card accent-info">
          <div className="kpi-label">Overall Completion</div>
          <div className="kpi-value">{monthlySummary.overallCompletionPct || 0}%</div>
        </div>
      </div>

      {/* KPI Row 2 */}
      <div className="kpi-grid" style={{ marginTop: 12 }}>
        <div className="kpi-card accent-primary">
          <div className="kpi-label">Days With Tasks</div>
          <div className="kpi-value">{days.filter(d => (d.scheduled || 0) > 0).length}</div>
        </div>
        <div className="kpi-card accent-info">
          <div className="kpi-label">Avg Tasks/Day</div>
          <div className="kpi-value">{monthlySummary.avgTasksPerDay || 0}</div>
        </div>
        <div className="kpi-card accent-success">
          <div className="kpi-label">Days &gt;= 80%</div>
          <div className="kpi-value">{monthlySummary.daysAbove80Pct || 0}</div>
        </div>
        <div className="kpi-card accent-accent">
          <div className="kpi-label">Days &lt; 50%</div>
          <div className="kpi-value" style={{ color: (monthlySummary.daysBelow50Pct || 0) > 0 ? '#ef4444' : 'inherit' }}>{monthlySummary.daysBelow50Pct || 0}</div>
        </div>
      </div>

      {/* Days Table */}
      <div className="glass-card" style={{ marginTop: '1.5rem' }}>
        <div className="glass-card-header">
          <span>Daily Breakdown</span>
          <span className="badge badge-active" style={{ marginLeft: 8 }}>{days.length} days</span>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th style={{ textAlign: 'center' }}>Scheduled</th>
                <th style={{ textAlign: 'center' }}>Completed</th>
                <th style={{ textAlign: 'center', minWidth: 120 }}>Completion %</th>
                <th style={{ textAlign: 'center' }}>Waiting</th>
                <th style={{ minWidth: 100 }}>Day Rating</th>
                <th style={{ minWidth: 160 }}>Achievements</th>
                <th style={{ minWidth: 140 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {days.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No data available</td>
                </tr>
              ) : (
                days.map(day => {
                  const edit = localEdits[day.date] || {};
                  const pct = day.completionPct;
                  const pctColor = getCompletionColor(pct);
                  const dayName = day.dateFormatted ? '' : '';
                  // Extract day name from date if available
                  let displayDay = '';
                  try {
                    const d = new Date(day.date);
                    displayDay = d.toLocaleDateString('en-US', { weekday: 'short' });
                  } catch { displayDay = ''; }

                  return (
                    <tr key={day.date}>
                      <td style={{ fontWeight: 500, whiteSpace: 'nowrap', fontSize: 12 }}>{day.dateFormatted || day.date}</td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>{displayDay}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{day.scheduled || 0}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{day.completed || 0}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            flex: 1,
                            height: 8,
                            background: 'rgba(0,0,0,0.06)',
                            borderRadius: 4,
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${Math.min(pct || 0, 100)}%`,
                              height: '100%',
                              background: pctColor,
                              borderRadius: 4,
                              transition: 'width 0.3s',
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: pctColor, minWidth: 32, textAlign: 'right' }}>
                            {pct != null ? `${pct}%` : '--'}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{day.waiting || 0}</td>
                      <td>
                        <select
                          className="form-select"
                          style={{
                            fontSize: 11,
                            padding: '3px 6px',
                            minWidth: 90,
                            color: getRatingColor(edit.dayRating),
                            fontWeight: edit.dayRating ? 600 : 400,
                          }}
                          value={edit.dayRating || ''}
                          onChange={e => handleRatingChange(day.date, e.target.value)}
                        >
                          {RATING_OPTIONS.map(r => (
                            <option key={r} value={r}>{r || '-- Select --'}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {editingCell?.date === day.date && editingCell?.field === 'achievements' ? (
                          <input
                            className="form-input"
                            style={{ fontSize: 11, padding: '3px 6px' }}
                            autoFocus
                            value={edit.achievements || ''}
                            onChange={e => updateLocal(day.date, 'achievements', e.target.value)}
                            onBlur={() => saveField(day.date)}
                            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                          />
                        ) : (
                          <div
                            style={{
                              fontSize: 11,
                              cursor: 'pointer',
                              padding: '3px 6px',
                              borderRadius: 4,
                              minHeight: 24,
                              display: 'flex',
                              alignItems: 'center',
                              color: edit.achievements ? 'inherit' : 'var(--muted)',
                              background: 'rgba(0,0,0,0.02)',
                            }}
                            onClick={() => setEditingCell({ date: day.date, field: 'achievements' })}
                            title="Click to edit"
                          >
                            {edit.achievements || 'Click to add...'}
                          </div>
                        )}
                      </td>
                      <td>
                        {editingCell?.date === day.date && editingCell?.field === 'notes' ? (
                          <input
                            className="form-input"
                            style={{ fontSize: 11, padding: '3px 6px' }}
                            autoFocus
                            value={edit.notes || ''}
                            onChange={e => updateLocal(day.date, 'notes', e.target.value)}
                            onBlur={() => saveField(day.date)}
                            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                          />
                        ) : (
                          <div
                            style={{
                              fontSize: 11,
                              cursor: 'pointer',
                              padding: '3px 6px',
                              borderRadius: 4,
                              minHeight: 24,
                              display: 'flex',
                              alignItems: 'center',
                              color: edit.notes ? 'inherit' : 'var(--muted)',
                              background: 'rgba(0,0,0,0.02)',
                            }}
                            onClick={() => setEditingCell({ date: day.date, field: 'notes' })}
                            title="Click to edit"
                          >
                            {edit.notes || 'Click to add...'}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
