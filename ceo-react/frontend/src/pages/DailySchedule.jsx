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

function formatDateISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const ALL_SLOTS = [
  '7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM',
  '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM',
  '4:00 PM','4:30 PM','5:00 PM','5:30 PM','6:00 PM','6:30 PM','7:00 PM',
  '7:30 PM','8:00 PM','8:30 PM','9:00 PM','9:30 PM','10:00 PM','10:30 PM','11:00 PM','11:30 PM'
];

function buildOccupiedMap(scheduled) {
  const map = {};
  if (!scheduled) return map;
  scheduled.forEach(t => {
    if (!t.schedTime) return;
    const fromIdx = ALL_SLOTS.indexOf(t.schedTime);
    // Try to find schedTimeTo from the task
    const toTime = t.schedTimeTo || t.to;
    const toIdx = toTime ? ALL_SLOTS.indexOf(toTime) : -1;
    if (fromIdx >= 0 && toIdx > fromIdx) {
      for (let j = fromIdx + 1; j < toIdx; j++) {
        map[ALL_SLOTS[j]] = t.task || 'Occupied';
      }
    }
  });
  return map;
}
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
  const [markingDone, setMarkingDone] = useState({});
  const [qcRows, setQcRows] = useState([]);

  const loadData = useCallback(async (targetDate) => {
    setLoading(true);
    try {
      const [res, qcRes] = await Promise.all([api.getDailySchedule(targetDate), api.getQuickCapture()]);
      if (res.success) { setData(res); setRating(res.dayRating || ''); setActuallyDone(res.actuallyDone || ''); }
      else showToast('Failed to load schedule', 'error');
      if (qcRes.success) setQcRows(qcRes.rows || []);
    } catch (err) { showToast('Error loading schedule', 'error'); }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { loadData(date); }, [date, loadData]);

  function goToday() { setDate(formatDateISO(new Date())); }
  function goPrev() { setDate(prev => addDays(prev, -1)); }
  function goNext() { setDate(prev => addDays(prev, 1)); }

  async function handleMarkDone(task, isDone) {
    const key = `${task.source}-${task.rowNum}`;
    setMarkingDone(prev => ({ ...prev, [key]: true }));
    try {
      const res = await api.markDone({ date, source: task.source, sourceRow: task.rowNum, done: isDone ? 'Yes' : 'No' });
      if (res.success) { showToast(isDone ? 'Task marked done' : 'Task unmarked', 'success'); loadData(date); }
      else showToast('Failed to update task', 'error');
    } catch { showToast('Error updating task', 'error'); }
    setMarkingDone(prev => ({ ...prev, [key]: false }));
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

  // Build occupied map from QC rows for this date (slots between from-to)
  const occupiedMap = React.useMemo(() => {
    const map = {};
    const todayQc = qcRows.filter(r => r.schedDate === date && r.schedTimeFrom && r.schedTimeTo);
    todayQc.forEach(r => {
      const fromIdx = ALL_SLOTS.indexOf(r.schedTimeFrom);
      const toIdx = ALL_SLOTS.indexOf(r.schedTimeTo);
      if (fromIdx >= 0 && toIdx > fromIdx) {
        for (let j = fromIdx + 1; j < toIdx; j++) {
          map[ALL_SLOTS[j]] = r.description || 'Occupied';
        }
      }
    });
    // Also from scheduled RT tasks
    scheduled.forEach(t => {
      if (!t.schedTime) return;
      const fromIdx = ALL_SLOTS.indexOf(t.schedTime);
      if (fromIdx < 0) return;
      // RT tasks occupy 1 slot by default
    });
    return map;
  }, [qcRows, scheduled, date]);

  // Count tasks that are done
  const doneCount = [...scheduled, ...waiting].filter(t => t.finalStatus === 'Completed').length;

  if (loading) {
    return (
      <div>
        <div className="page-header"><div></div></div>
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div><p>{displayDate(date)}</p></div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={goPrev}>&#9664; Prev</button>
          <button className={`btn btn-sm ${isToday ? 'btn-primary' : 'btn-outline'}`} onClick={goToday}>Today</button>
          <button className="btn btn-outline btn-sm" onClick={goNext}>Next &#9654;</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* Left: Time Grid */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13, color: 'var(--text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Time Grid</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>
              {timeGrid.filter(s => s.task).length} tasks assigned
              {doneCount > 0 && <span style={{ color: 'var(--success)', marginLeft: 6 }}>({doneCount} done)</span>}
            </span>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: '65vh' }}>
            <table className="data-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Time</th>
                  <th>Assigned Task</th>
                  <th style={{ width: 70 }}>Priority</th>
                  <th style={{ width: 80 }}>Source</th>
                  <th style={{ width: 90 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {timeGrid.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 32, opacity: 0.5 }}>
                      No time slots for this date
                    </td>
                  </tr>
                ) : timeGrid.map((slot, i) => {
                  const task = slot.task;
                  const hasTask = !!task;
                  const isOccupied = !hasTask && occupiedMap[slot.time];
                  const isDone = task?.finalStatus === 'Completed';
                  const isHigh = task?.priority === 'High';
                  if (isOccupied) {
                    return (
                      <tr key={i} style={{ background: 'rgba(13,110,110,0.04)', borderLeft: '3px solid var(--primary)', opacity: 0.5 }}>
                        <td style={{ fontWeight: 600, fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{slot.time}</td>
                        <td colSpan={4} style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>&#8627; {occupiedMap[slot.time]} (continued)</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={i} style={hasTask ? {
                      background: isDone ? 'rgba(16, 185, 129, 0.06)' : isHigh ? 'var(--danger-bg)' : 'var(--success-bg)',
                      borderLeft: `3px solid ${isDone ? '#10b981' : isHigh ? 'var(--danger)' : 'var(--success)'}`,
                    } : {}}>
                      <td style={{ fontWeight: 600, fontSize: 12, color: hasTask ? 'var(--primary)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {slot.time}
                      </td>
                      <td>
                        {hasTask ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{
                                fontWeight: 600, fontSize: 12, color: 'var(--text)',
                                textDecoration: isDone ? 'line-through' : 'none',
                                opacity: isDone ? 0.6 : 1,
                              }}>
                                {task.task}
                              </div>
                              {task.notes && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{task.notes}</div>}
                            </div>
                            {isDone && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, color: '#fff', background: '#10b981',
                                padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap',
                              }}>Done</span>
                            )}
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
                        {hasTask && (
                          <span style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                            background: task.source === 'QC' ? '#e3f2fd' : task.source === 'RT' ? '#fff8e1' : '#f3e8ff',
                            color: task.source === 'QC' ? '#1565c0' : task.source === 'RT' ? '#f57f17' : '#7c3aed',
                          }}>
                            {task.source || task.sendTo || '-'}
                          </span>
                        )}
                      </td>
                      <td>
                        {hasTask && (
                          <button
                            style={{
                              fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 8, border: 'none',
                              cursor: markingDone[`${task.source}-${task.rowNum}`] ? 'wait' : 'pointer',
                              background: isDone ? '#10b981' : 'var(--border)',
                              color: isDone ? '#fff' : 'var(--text-secondary)',
                              transition: 'all 0.2s',
                            }}
                            disabled={markingDone[`${task.source}-${task.rowNum}`]}
                            onClick={() => handleMarkDone(task, !isDone)}
                            title={isDone ? 'Click to unmark' : 'Click to mark done'}
                          >
                            {markingDone[`${task.source}-${task.rowNum}`] ? '...' : isDone ? 'Done' : 'Mark Done'}
                          </button>
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
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--info)' }}>{data?.totalScheduled ?? scheduled.length}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Scheduled</div>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--warning)' }}>{data?.totalWaiting ?? waiting.length}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Waiting</div>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>{doneCount}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Done</div>
              </div>
            </div>
          </div>

          {/* Scheduled Tasks */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="task-panel-header scheduled">Scheduled Tasks ({scheduled.length})</div>
            <div style={{ maxHeight: '30vh', overflowY: 'auto' }}>
              {scheduled.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>No scheduled tasks</div>
              ) : scheduled.map((task, i) => {
                const isDone = task.finalStatus === 'Completed';
                const key = `${task.source}-${task.rowNum}`;
                return (
                  <div key={i} className="task-item" style={{ opacity: isDone ? 0.65 : 1 }}>
                    <div className="task-num sched">{task.schNum || i + 1}</div>
                    <div className="task-name" style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: 600, fontSize: 12,
                        textDecoration: isDone ? 'line-through' : 'none',
                      }}>
                        {task.task}
                      </div>
                      {task.schedTime && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{task.schedTime}</div>}
                      {task.source && (
                        <span style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 8, fontWeight: 600, marginTop: 2, display: 'inline-block',
                          background: task.source === 'QC' ? '#e3f2fd' : '#fff8e1',
                          color: task.source === 'QC' ? '#1565c0' : '#f57f17',
                        }}>{task.source}</span>
                      )}
                    </div>
                    {isDone && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: '#fff', background: '#10b981',
                        padding: '2px 8px', borderRadius: 8, marginRight: 6, whiteSpace: 'nowrap',
                      }}>Done</span>
                    )}
                    <button
                      className={`task-done-btn${isDone ? ' done' : ''}`}
                      onClick={() => handleMarkDone(task, !isDone)}
                      disabled={markingDone[key]}
                      style={{ minWidth: 75, fontSize: 11 }}
                    >
                      {markingDone[key] ? '...' : isDone ? 'Undo' : 'Mark Done'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Waiting Tasks */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="task-panel-header waiting">Waiting Tasks ({waiting.length})</div>
            <div style={{ maxHeight: '25vh', overflowY: 'auto' }}>
              {waiting.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>No waiting tasks</div>
              ) : waiting.map((task, i) => {
                const isDone = task.finalStatus === 'Completed';
                const key = `${task.source}-${task.rowNum}`;
                return (
                  <div key={i} className="task-item" style={{ opacity: isDone ? 0.65 : 1 }}>
                    <div className="task-num wait">{task.waitNum || i + 1}</div>
                    <div className="task-name" style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: 600, fontSize: 12,
                        textDecoration: isDone ? 'line-through' : 'none',
                      }}>
                        {task.task}
                      </div>
                      {task.notes && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{task.notes}</div>}
                      {task.source && (
                        <span style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 8, fontWeight: 600, marginTop: 2, display: 'inline-block',
                          background: task.source === 'QC' ? '#e3f2fd' : '#fff8e1',
                          color: task.source === 'QC' ? '#1565c0' : '#f57f17',
                        }}>{task.source}</span>
                      )}
                    </div>
                    {isDone && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: '#fff', background: '#10b981',
                        padding: '2px 8px', borderRadius: 8, marginRight: 6, whiteSpace: 'nowrap',
                      }}>Done</span>
                    )}
                    <button
                      className={`task-done-btn${isDone ? ' done' : ''}`}
                      onClick={() => handleMarkDone(task, !isDone)}
                      disabled={markingDone[key]}
                      style={{ minWidth: 75, fontSize: 11 }}
                    >
                      {markingDone[key] ? '...' : isDone ? 'Undo' : 'Mark Done'}
                    </button>
                  </div>
                );
              })}
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
