import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useApp } from '../App';

const RATINGS = ['Excellent', 'Good', 'Average', 'Poor', 'Bad'];
const RATING_COLORS = {
  Excellent: '#10b981', Good: '#22c55e', Average: '#f59e0b', Poor: '#f97316', Bad: '#ef4444',
};
const RATING_BG = {
  Excellent: '#ECFDF5', Good: '#F0FDF4', Average: '#FFFBEB', Poor: '#FFF7ED', Bad: '#FEF2F2',
};

function formatDateISO(d) { return d.toISOString().split('T')[0]; }
function displayDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n); return formatDateISO(d);
}

export default function DailySchedule() {
  const { showToast } = useApp();
  const [date, setDate] = useState(formatDateISO(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState('');
  const [actuallyDone, setActuallyDone] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const loadData = useCallback(async (targetDate) => {
    setLoading(true);
    try {
      const res = await api.getDailySchedule(targetDate);
      if (res.success) { setData(res); setRating(res.dayRating || ''); setActuallyDone(res.actuallyDone || ''); }
      else showToast('Failed to load schedule', 'error');
    } catch (err) { showToast('Error loading schedule', 'error'); }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { loadData(date); }, [date, loadData]);

  function goToday() { setDate(formatDateISO(new Date())); }
  function goPrev() { setDate(prev => addDays(prev, -1)); }
  function goNext() { setDate(prev => addDays(prev, 1)); }

  async function handleMarkDone(task, isDone) {
    try {
      const res = await api.markDone({ date, source: task.source, sourceRow: task.rowNum, done: isDone ? 'Yes' : 'No' });
      if (res.success) { showToast(isDone ? 'Task marked done' : 'Task unmarked', 'success'); loadData(date); }
    } catch { showToast('Error updating task', 'error'); }
  }

  async function handleRating(r) {
    setRating(r);
    try {
      await api.setDayRating({ date, rating: r });
      showToast('Rating saved', 'success');
    } catch { showToast('Error saving rating', 'error'); }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      await api.saveDSNotes({ date, notes: actuallyDone });
      showToast('Notes saved', 'success');
    } catch { showToast('Error saving notes', 'error'); }
    setSavingNotes(false);
  }

  const isToday = date === formatDateISO(new Date());
  const timeGrid = data?.timeGrid || [];
  const scheduled = data?.scheduled || [];
  const waiting = data?.waiting || [];

  if (loading) {
    return (
      <div>
        <div className="page-header"><div><h2>Daily Schedule</h2></div></div>
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Daily Schedule</h2><p>{displayDate(date)}</p></div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={goPrev}>&#9664; Prev</button>
          <button className={`btn btn-sm ${isToday ? 'btn-primary' : 'btn-outline'}`} onClick={goToday}>Today</button>
          <button className="btn btn-outline btn-sm" onClick={goNext}>Next &#9654;</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* Left: Time Grid */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13, color: 'var(--secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Time Grid</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>{scheduled.length} scheduled, {waiting.length} waiting</span>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: '65vh' }}>
            <table className="data-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Time</th>
                  <th>Assigned Task</th>
                  <th style={{ width: 70 }}>Priority</th>
                  <th style={{ width: 80 }}>Type</th>
                </tr>
              </thead>
              <tbody>
                {timeGrid.map((slot, i) => {
                  const task = slot.task;
                  const hasTask = !!task;
                  const isHigh = task?.priority === 'High';
                  return (
                    <tr key={i} style={hasTask ? {
                      background: isHigh ? 'var(--danger-bg)' : 'var(--success-bg)',
                      borderLeft: `3px solid ${isHigh ? 'var(--danger)' : 'var(--success)'}`,
                    } : {}}>
                      <td style={{ fontWeight: 600, fontSize: 12, color: hasTask ? 'var(--primary)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {slot.time}
                      </td>
                      <td>
                        {hasTask ? (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{task.task}</div>
                            {task.notes && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{task.notes}</div>}
                          </div>
                        ) : (
                          <span style={{ opacity: 0.2, fontSize: 11 }}>&mdash;</span>
                        )}
                      </td>
                      <td>
                        {hasTask && task.priority && (
                          <span className={`badge badge-${task.priority.toLowerCase()}`}>{task.priority}</span>
                        )}
                      </td>
                      <td>
                        {hasTask && task.batchType && (
                          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{task.batchType}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Summary */}
          <div className="glass-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--info)' }}>{data?.totalScheduled ?? 0}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Scheduled</div>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--warning)' }}>{data?.totalWaiting ?? 0}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Waiting</div>
              </div>
            </div>
          </div>

          {/* Scheduled Tasks */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="task-panel-header scheduled">Scheduled Tasks ({scheduled.length})</div>
            <div>
              {scheduled.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>No scheduled tasks</div>
              ) : scheduled.map((task, i) => (
                <div key={i} className="task-item">
                  <div className="task-num sched">{task.schNum || i + 1}</div>
                  <div className="task-name">
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{task.task}</div>
                    {task.schedTime && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{task.schedTime}</div>}
                  </div>
                  <button
                    className={`task-done-btn${task.finalStatus === 'Completed' ? ' done' : ''}`}
                    onClick={() => handleMarkDone(task, task.finalStatus !== 'Completed')}
                  >
                    {task.finalStatus === 'Completed' ? 'Done' : 'Mark Done'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Waiting Tasks */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="task-panel-header waiting">Waiting Tasks ({waiting.length})</div>
            <div>
              {waiting.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>No waiting tasks</div>
              ) : waiting.map((task, i) => (
                <div key={i} className="task-item">
                  <div className="task-num wait">{task.waitNum || i + 1}</div>
                  <div className="task-name">
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{task.task}</div>
                    {task.notes && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{task.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Day Rating */}
          <div className="glass-card" style={{ padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--secondary)' }}>Day Rating</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {RATINGS.map(r => (
                <button key={r} onClick={() => handleRating(r)} style={{
                  padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${rating === r ? RATING_COLORS[r] : 'var(--border)'}`,
                  background: rating === r ? RATING_BG[r] : 'white', color: rating === r ? RATING_COLORS[r] : 'var(--text-secondary)',
                  fontWeight: 600, fontSize: 11, cursor: 'pointer', transition: 'all 0.2s',
                }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Actually Done */}
          <div className="glass-card" style={{ padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--secondary)' }}>Actually Done</div>
            <textarea className="form-textarea" value={actuallyDone} onChange={e => setActuallyDone(e.target.value)}
              placeholder="Record what you actually accomplished today..." rows={4} style={{ width: '100%', marginBottom: 10 }} />
            <button className="btn btn-primary btn-sm" onClick={handleSaveNotes} disabled={savingNotes} style={{ width: '100%' }}>
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
