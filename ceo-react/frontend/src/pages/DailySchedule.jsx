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

function displayDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n); return formatDateISO(d);
}

// Source badge style
function sourceBadge(source) {
  const s = source || '-';
  const map = {
    QC: { bg: '#e3f2fd', color: '#1565c0' },
    RT: { bg: '#fff8e1', color: '#f57f17' },
  };
  const style = map[s] || { bg: '#f3e8ff', color: '#7c3aed' };
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
      background: style.bg, color: style.color,
    }}>{s}</span>
  );
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

  // ─── Build occupied slot map (slots between from→to of QC tasks) ───────────
  const { occupiedMap, scheduledQcSlots } = React.useMemo(() => {
    const oMap = {};        // time → task description (for "continued" display)
    const schedQc = {};     // time → full QC row (the START slot of a QC task)

    const todayQc = qcRows.filter(r => r.schedDate === date && r.schedTimeFrom);
    todayQc.forEach(r => {
      // Mark the start slot as a QC-scheduled task
      schedQc[r.schedTimeFrom] = r;

      // Mark in-between slots as occupied
      const fromIdx = ALL_SLOTS.indexOf(r.schedTimeFrom);
      const toIdx = r.schedTimeTo ? ALL_SLOTS.indexOf(r.schedTimeTo) : -1;
      if (fromIdx >= 0 && toIdx > fromIdx) {
        for (let j = fromIdx + 1; j < toIdx; j++) {
          oMap[ALL_SLOTS[j]] = r.description || 'Occupied';
        }
      }
    });
    return { occupiedMap: oMap, scheduledQcSlots: schedQc };
  }, [qcRows, date]);

  // ─── Partition timeGrid into two grids ────────────────────────────────────
  // Top Grid  → slots that have a scheduled task (from RT/API) OR a QC task starting at that time
  // Bottom Grid → slots that are empty AND not "occupied" (continued) by any task
  const { scheduledGrid, availableGrid } = React.useMemo(() => {
    const sg = [];   // scheduled time blocks
    const ag = [];   // available/free slots

    timeGrid.forEach(slot => {
      const hasApiTask = !!slot.task;
      const hasQcTask  = !!scheduledQcSlots[slot.time];
      const isOccupied = !!occupiedMap[slot.time];  // mid-span slot

      if (hasApiTask) {
        // API-scheduled task (RT/etc.) — goes to top grid
        sg.push({ ...slot, gridType: 'api' });
      } else if (hasQcTask) {
        // QC task starting at this slot — goes to top grid
        const qc = scheduledQcSlots[slot.time];
        sg.push({
          time: slot.time,
          gridType: 'qc',
          task: {
            task: qc.description,
            priority: qc.priorityWait || qc.priority || '',
            source: 'QC',
            rowNum: qc.id,
            schedTime: qc.schedTimeFrom,
            schedTimeTo: qc.schedTimeTo,
            notes: qc.notes || '',
            finalStatus: qc.slStatus === 'Completed' ? 'Completed' : '',
          },
        });
      } else if (!isOccupied) {
        // Truly free slot — goes to bottom grid
        ag.push(slot);
      }
      // Occupied mid-span slots are silently skipped (they belong to the task above)
    });

    return { scheduledGrid: sg, availableGrid: ag };
  }, [timeGrid, occupiedMap, scheduledQcSlots]);

  const doneCount = [...scheduled, ...waiting].filter(t => t.finalStatus === 'Completed').length;

  if (loading) {
    return (
      <div>
        <div className="page-header"><div></div></div>
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      </div>
    );
  }

  // ─── Shared table header ───────────────────────────────────────────────────
  const GridHeader = () => (
    <thead>
      <tr>
        <th style={{ width: 90 }}>Time</th>
        <th>Assigned Task</th>
        <th style={{ width: 80 }}>Time Range</th>
        <th style={{ width: 70 }}>Priority</th>
        <th style={{ width: 70 }}>Source</th>
        <th style={{ width: 100 }}>Status</th>
      </tr>
    </thead>
  );

  // ─── Scheduled task row renderer ──────────────────────────────────────────
  function renderScheduledRow(slot, i) {
    const task = slot.task;
    const isDone = task?.finalStatus === 'Completed';
    const isHigh = task?.priority === 'High';
    const key = `${task.source}-${task.rowNum}`;
    const isBusy = markingDone[key];

    return (
      <tr key={i} style={{
        background: isDone
          ? 'rgba(16,185,129,0.07)'
          : isHigh
            ? 'var(--danger-bg)'
            : 'rgba(14,165,233,0.06)',
        borderLeft: `3px solid ${isDone ? '#10b981' : isHigh ? 'var(--danger)' : 'var(--primary)'}`,
      }}>
        {/* Time */}
        <td style={{ fontWeight: 700, fontSize: 12, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
          {slot.time}
        </td>
        {/* Task name */}
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: 600, fontSize: 12, color: 'var(--text)',
                textDecoration: isDone ? 'line-through' : 'none',
                opacity: isDone ? 0.6 : 1,
              }}>
                {task.task}
              </div>
              {task.notes && (
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{task.notes}</div>
              )}
            </div>
            {isDone && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#fff', background: '#10b981',
                padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap',
              }}>Done</span>
            )}
          </div>
        </td>
        {/* Time range */}
        <td style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          {task.schedTimeTo
            ? <span style={{ background: 'var(--border)', borderRadius: 6, padding: '2px 6px', fontSize: 10 }}>
                {slot.time} – {task.schedTimeTo}
              </span>
            : <span style={{ opacity: 0.3 }}>—</span>
          }
        </td>
        {/* Priority */}
        <td>
          {task.priority && (
            <span className={`badge badge-${task.priority.toLowerCase()}`}>{task.priority}</span>
          )}
        </td>
        {/* Source */}
        <td>{sourceBadge(task.source)}</td>
        {/* Mark done */}
        <td>
          <button
            style={{
              fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 8, border: 'none',
              cursor: isBusy ? 'wait' : 'pointer',
              background: isDone ? '#10b981' : 'var(--border)',
              color: isDone ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s',
            }}
            disabled={isBusy}
            onClick={() => handleMarkDone(task, !isDone)}
            title={isDone ? 'Click to unmark' : 'Click to mark done'}
          >
            {isBusy ? '...' : isDone ? 'Done ✓' : 'Mark Done'}
          </button>
        </td>
      </tr>
    );
  }

  // ─── Cycling colors for free slot rows ───────────────────────────────────
  const FREE_SLOT_COLORS = [
    { bg: 'rgba(14,165,233,0.08)',  border: '#0ea5e9', text: '#0369a1',  dot: '#0ea5e9'  },  // sky
    { bg: 'rgba(16,185,129,0.08)', border: '#10b981', text: '#047857',  dot: '#10b981'  },  // emerald
    { bg: 'rgba(139,92,246,0.08)', border: '#8b5cf6', text: '#6d28d9',  dot: '#8b5cf6'  },  // violet
    { bg: 'rgba(245,158,11,0.08)', border: '#f59e0b', text: '#b45309',  dot: '#f59e0b'  },  // amber
    { bg: 'rgba(236,72,153,0.08)', border: '#ec4899', text: '#be185d',  dot: '#ec4899'  },  // pink
    { bg: 'rgba(99,102,241,0.08)', border: '#6366f1', text: '#4338ca',  dot: '#6366f1'  },  // indigo
    { bg: 'rgba(20,184,166,0.08)', border: '#14b8a6', text: '#0f766e',  dot: '#14b8a6'  },  // teal
  ];

  return (
    <>
    {/* ── Keyframe animations for free slots ── */}
    <style>{`
      @keyframes slot-pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.35; }
      }
      @keyframes dot-blink {
        0%, 100% { transform: scale(1);   opacity: 1; }
        50%       { transform: scale(1.6); opacity: 0.5; }
      }
      @keyframes slot-row-glow {
        0%, 100% { box-shadow: inset 0 0 0px transparent; }
        50%       { box-shadow: inset 3px 0 12px rgba(255,255,255,0.08); }
      }
      .free-slot-row { animation: slot-row-glow 2.4s ease-in-out infinite; }
      .free-slot-dot { animation: dot-blink 1.2s ease-in-out infinite; }
      .free-slot-label { animation: slot-pulse 2.0s ease-in-out infinite; }
    `}</style>
    <div>
      {/* Page header */}
      <div className="page-header">
        <div><p>{displayDate(date)}</p></div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={goPrev}>&#9664; Prev</button>
          <button className={`btn btn-sm ${isToday ? 'btn-primary' : 'btn-outline'}`} onClick={goToday}>Today</button>
          <button className="btn btn-outline btn-sm" onClick={goNext}>Next &#9654;</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

        {/* ── Left: Two grids stacked ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── GRID 1: Scheduled Time Blocks ── */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              padding: '13px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'linear-gradient(90deg, rgba(14,165,233,0.08) 0%, transparent 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 16, background: 'var(--primary)', color: '#fff',
                  borderRadius: 8, width: 28, height: 28, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>📋</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Scheduled Time Blocks</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                    Tasks with confirmed date & time from Quick Capture
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--primary)',
                  background: 'rgba(14,165,233,0.12)', borderRadius: 20,
                  padding: '3px 12px',
                }}>
                  {scheduledGrid.length} block{scheduledGrid.length !== 1 ? 's' : ''}
                </span>
                {doneCount > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: '#10b981',
                    background: 'rgba(16,185,129,0.12)', borderRadius: 20,
                    padding: '3px 12px',
                  }}>
                    {doneCount} done
                  </span>
                )}
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowY: 'auto', maxHeight: '38vh' }}>
              {scheduledGrid.length === 0 ? (
                <div style={{
                  padding: '36px 20px', textAlign: 'center',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}>
                  <div style={{ fontSize: 32, opacity: 0.3 }}>📅</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
                    No scheduled tasks for this date
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.7 }}>
                    Schedule tasks via Quick Capture with a date & time to see them here
                  </div>
                </div>
              ) : (
                <table className="data-table" style={{ marginBottom: 0 }}>
                  <GridHeader />
                  <tbody>
                    {scheduledGrid.map((slot, i) => renderScheduledRow(slot, i))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── GRID 2: Available Time Slots ── */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              padding: '13px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'linear-gradient(90deg, rgba(100,116,139,0.06) 0%, transparent 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 16, background: 'var(--muted)', color: '#fff',
                  borderRadius: 8, width: 28, height: 28, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>🕐</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Available Time Slots</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                    Open slots — not occupied by any scheduled task
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, color: 'var(--muted)',
                background: 'rgba(100,116,139,0.1)', borderRadius: 20,
                padding: '3px 12px',
              }}>
                {availableGrid.length} free slot{availableGrid.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Table */}
            <div style={{ overflowY: 'auto', maxHeight: '38vh' }}>
              <table className="data-table" style={{ marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Time</th>
                    <th>Slot</th>
                  </tr>
                </thead>
                <tbody>
                  {availableGrid.length === 0 ? (
                    <tr>
                      <td colSpan={2} style={{ textAlign: 'center', padding: 28, opacity: 0.4, fontSize: 12 }}>
                        All time slots are occupied today
                      </td>
                    </tr>
                  ) : availableGrid.map((slot, i) => {
                    const c = FREE_SLOT_COLORS[i % FREE_SLOT_COLORS.length];
                    const delay = `${(i * 0.18) % 2.0}s`;
                    return (
                      <tr key={i} className="free-slot-row" style={{
                        background: c.bg,
                        borderLeft: `3px solid ${c.border}`,
                        animationDelay: delay,
                        transition: 'background 0.3s',
                      }}>
                        <td style={{
                          fontWeight: 700, fontSize: 12,
                          color: c.text, whiteSpace: 'nowrap',
                        }}>
                          {slot.time}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {/* Blinking dot */}
                            <span className="free-slot-dot" style={{
                              display: 'inline-block',
                              width: 7, height: 7, borderRadius: '50%',
                              background: c.dot,
                              flexShrink: 0,
                              animationDelay: delay,
                            }} />
                            <span className="free-slot-label" style={{
                              fontSize: 11, color: c.text,
                              fontWeight: 600,
                              animationDelay: delay,
                            }}>
                              Free — available to schedule
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Summary counters */}
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

          {/* Scheduled Tasks panel */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="task-panel-header scheduled">Scheduled Tasks ({scheduled.length})</div>
            <div style={{ maxHeight: '28vh', overflowY: 'auto' }}>
              {scheduled.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>No scheduled tasks</div>
              ) : scheduled.map((task, i) => {
                const isDone = task.finalStatus === 'Completed';
                const key = `${task.source}-${task.rowNum}`;
                return (
                  <div key={i} className="task-item" style={{ opacity: isDone ? 0.65 : 1 }}>
                    <div className="task-num sched">{task.schNum || i + 1}</div>
                    <div className="task-name" style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, textDecoration: isDone ? 'line-through' : 'none' }}>
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

          {/* Waiting Tasks panel */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="task-panel-header waiting">Waiting Tasks ({waiting.length})</div>
            <div style={{ maxHeight: '22vh', overflowY: 'auto' }}>
              {waiting.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>No waiting tasks</div>
              ) : waiting.map((task, i) => {
                const isDone = task.finalStatus === 'Completed';
                const key = `${task.source}-${task.rowNum}`;
                return (
                  <div key={i} className="task-item" style={{ opacity: isDone ? 0.65 : 1 }}>
                    <div className="task-num wait">{task.waitNum || i + 1}</div>
                    <div className="task-name" style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, textDecoration: isDone ? 'line-through' : 'none' }}>
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
                  padding: '6px 14px', borderRadius: 8,
                  border: `1.5px solid ${rating === r ? RATING_COLORS[r] : 'var(--border)'}`,
                  background: rating === r ? RATING_BG[r] : 'white',
                  color: rating === r ? RATING_COLORS[r] : 'var(--text-secondary)',
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
            <textarea
              className="form-textarea"
              value={actuallyDone}
              onChange={e => setActuallyDone(e.target.value)}
              placeholder="Record what you actually accomplished today..."
              rows={4}
              style={{ width: '100%', marginBottom: 10 }}
            />
            <button className="btn btn-primary btn-sm" onClick={handleSaveNotes} disabled={savingNotes} style={{ width: '100%' }}>
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
