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
    QC: { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd', icon: '📋', label: 'Quick Capture' },
    RT: { bg: '#fef3c7', color: '#b45309', border: '#fcd34d', icon: '🔄', label: 'Recurring' },
  };
  const style = map[s] || { bg: '#f3e8ff', color: '#7c3aed', border: '#c4b5fd', icon: '•', label: s };
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
      background: style.bg, color: style.color,
      border: `1px solid ${style.border}`,
      display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
    }}>
      <span>{style.icon}</span>
      <span>{style.label}</span>
    </span>
  );
}

// Compact inline source tag (for sidebar panels)
function sourceTag(source) {
  const map = {
    QC: { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd', icon: '📋', label: 'QC' },
    RT: { bg: '#fef3c7', color: '#b45309', border: '#fcd34d', icon: '🔄', label: 'Recurring' },
  };
  const style = map[source] || null;
  if (!style) return null;
  return (
    <span style={{
      fontSize: 9, padding: '1px 6px', borderRadius: 8, fontWeight: 700,
      background: style.bg, color: style.color,
      border: `1px solid ${style.border}`,
      display: 'inline-flex', alignItems: 'center', gap: 2,
      marginTop: 2,
    }}>
      <span>{style.icon}</span>
      <span>{style.label}</span>
    </span>
  );
}

export default function DailySchedule() {
  const { showToast } = useApp();
  const [date, setDate] = useState(() => {
    // If navigated from calendar widget, use that date (first mount only)
    const saved = localStorage.getItem('ds_selected_date');
    if (saved) { localStorage.removeItem('ds_selected_date'); return saved; }
    return formatDateISO(new Date());
  });

  // Listen for calendar date-selection events (fires even when already on this page)
  useEffect(() => {
    function handleDateSelect(e) {
      if (e.detail?.date) setDate(e.detail.date);
    }
    window.addEventListener('ds-select-date', handleDateSelect);
    return () => window.removeEventListener('ds-select-date', handleDateSelect);
  }, []);
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

  // ─── Build occupied slot map (slots between from→to of QC + RT tasks) ───────
  const { occupiedMap, scheduledQcSlots } = React.useMemo(() => {
    const oMap = {};        // time → task description (for "continued" display)
    const schedQc = {};     // time → full QC row (the START slot of a QC task)

    // QC tasks: mark start + in-between slots
    const todayQc = qcRows.filter(r => r.schedDate === date && r.schedTimeFrom);
    todayQc.forEach(r => {
      schedQc[r.schedTimeFrom] = r;
      const fromIdx = ALL_SLOTS.indexOf(r.schedTimeFrom);
      const toIdx = r.schedTimeTo ? ALL_SLOTS.indexOf(r.schedTimeTo) : -1;
      if (fromIdx >= 0 && toIdx > fromIdx) {
        for (let j = fromIdx + 1; j < toIdx; j++) {
          oMap[ALL_SLOTS[j]] = r.description || 'Occupied';
        }
      }
    });

    // RT tasks from timeGrid: mark start + all in-between slots as occupied
    timeGrid.forEach(slot => {
      if (!slot.task || slot.task.source !== 'RT') return;
      const task = slot.task;
      const fromTime = task.schedTime || slot.time;
      const toTime = task.schedTimeTo || '';
      if (!fromTime || !toTime) return;
      const fromIdx = ALL_SLOTS.indexOf(fromTime);
      const toIdx = ALL_SLOTS.indexOf(toTime);
      if (fromIdx >= 0 && toIdx > fromIdx) {
        // Mark all slots from fromIdx+1 up to (but not including) toIdx as occupied
        for (let j = fromIdx + 1; j < toIdx; j++) {
          oMap[ALL_SLOTS[j]] = task.task || 'Occupied';
        }
      }
    });

    return { occupiedMap: oMap, scheduledQcSlots: schedQc };
  }, [qcRows, date, timeGrid]);

  // ─── Current time in minutes (for filtering past slots) ──────────────────
  const nowMinutes = React.useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  function parseSlotMinutes(timeStr) {
    if (!timeStr) return null;
    const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const period = m[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }

  // ─── Partition timeGrid into two grids ────────────────────────────────────
  // Top Grid  → slots that have a scheduled task (from RT/API) OR a QC task starting at that time
  // Bottom Grid → slots that are empty AND not "occupied" (continued) by any task AND not in the past (for today)
  const { scheduledGrid, availableGrid } = React.useMemo(() => {
    const sg = [];   // scheduled time blocks
    const ag = [];   // available/free slots
    const isToday = date === new Date().toISOString().slice(0, 10);

    timeGrid.forEach(slot => {
      const hasApiTask = !!slot.task;

      // Skip past slots for today in the free slots list
      // Use current 30-min boundary so the slot we're currently inside always shows as free
      if (!hasApiTask && isToday) {
        const slotMin = parseSlotMinutes(slot.time);
        const currentSlotMin = Math.floor(nowMinutes / 30) * 30; // e.g. 9:58 AM → 9:30 AM boundary
        if (slotMin !== null && slotMin < currentSlotMin) return; // strictly before current slot
      }
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
            baseStatus: qc.slStatus || 'Scheduled',
            finalStatus: qc.slStatus === 'Completed' ? 'Completed' : (qc.slStatus || 'Scheduled'),
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
        <th style={{ width: 120 }}>Source</th>
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
          {(() => {
            // For QC tasks, cross-reference qcRows to get schedTimeFrom/To reliably
            const qcRow = task.source === 'QC'
              ? qcRows.find(r => r.id === task.rowNum || r._rowNum === task.rowNum)
              : null;
            const fromTime = qcRow?.schedTimeFrom || task.schedTime || slot.time;
            const toTime   = qcRow?.schedTimeTo || task.schedTimeTo || '';
            if (toTime) {
              return (
                <span style={{
                  background: isDone ? 'rgba(16,185,129,0.12)' : 'rgba(14,165,233,0.1)',
                  border: `1px solid ${isDone ? '#6ee7b7' : '#93c5fd'}`,
                  borderRadius: 6, padding: '2px 7px', fontSize: 10,
                  color: isDone ? '#047857' : '#1d4ed8', fontWeight: 600,
                  display: 'inline-block',
                }}>
                  {fromTime} – {toTime}
                </span>
              );
            }
            return <span style={{ opacity: 0.3 }}>—</span>;
          })()}
        </td>
        {/* Priority */}
        <td>
          {task.priority && (
            <span className={`badge badge-${task.priority.toLowerCase()}`}>{task.priority}</span>
          )}
        </td>
        {/* Source */}
        <td>{sourceBadge(task.source)}</td>
        {/* Status + Mark Done */}
        <td>
          {(() => {
            const qcRowForStatus = task.source === 'QC'
              ? qcRows.find(r => r.id === task.rowNum || r._rowNum === task.rowNum)
              : null;
            const status = isDone ? 'Completed'
              : qcRowForStatus?.slStatus
              || task.finalStatus || task.baseStatus || 'Scheduled';
            const statusColors = {
              Completed: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
              Scheduled: { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
              Waiting:   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
              Pending:   { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
            };
            const sc = statusColors[status] || statusColors.Scheduled;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                {/* Status badge */}
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                  background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                  whiteSpace: 'nowrap',
                }}>
                  {status === 'Completed' ? '✅ ' : status === 'Scheduled' ? '📋 ' : status === 'Waiting' ? '⏳ ' : ''}{status}
                </span>
                {/* Mark Done toggle button */}
                <button
                  style={{
                    fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 7, border: 'none',
                    cursor: isBusy ? 'wait' : 'pointer',
                    background: isDone ? '#6ee7b7' : '#e2e8f0',
                    color: isDone ? '#065f46' : '#475569',
                    transition: 'all 0.2s',
                  }}
                  disabled={isBusy}
                  onClick={() => handleMarkDone(task, !isDone)}
                  title={isDone ? 'Click to unmark done' : 'Click to mark done'}
                >
                  {isBusy ? '…' : isDone ? '↩ Unmark' : '✓ Mark Done'}
                </button>
              </div>
            );
          })()}
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
              padding: '14px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.07) 0%, rgba(14,165,233,0.04) 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 15, background: 'linear-gradient(135deg,#10b981,#0ea5e9)',
                  color: '#fff', borderRadius: 10, width: 32, height: 32,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(16,185,129,0.25)',
                }}>🟢</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Available Time Slots</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                    Open windows — not occupied by any task
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 800, color: '#059669',
                background: 'rgba(16,185,129,0.12)', borderRadius: 20,
                padding: '4px 14px', border: '1px solid rgba(16,185,129,0.25)',
              }}>
                {availableGrid.length} free
              </span>
            </div>

            {/* Chip grid */}
            {availableGrid.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>All slots occupied!</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>No free time windows today</div>
              </div>
            ) : (
              <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: '34vh' }}>
                {/* Group consecutive slots into blocks */}
                {(() => {
                  // Build groups of consecutive free slots
                  const groups = [];
                  let current = null;
                  availableGrid.forEach((slot, i) => {
                    const slotIdx = ALL_SLOTS.indexOf(slot.time);
                    if (!current) {
                      current = { start: slot.time, end: slot.time, slotIdx, slots: [slot] };
                    } else {
                      const prevIdx = ALL_SLOTS.indexOf(current.slots[current.slots.length - 1].time);
                      if (slotIdx === prevIdx + 1) {
                        current.slots.push(slot);
                        current.end = slot.time;
                      } else {
                        groups.push(current);
                        current = { start: slot.time, end: slot.time, slotIdx, slots: [slot] };
                      }
                    }
                  });
                  if (current) groups.push(current);

                  const blockColors = [
                    { bg: 'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.04))', border: '#10b981', text: '#047857', badge: '#dcfce7', badgeText: '#166534' },
                    { bg: 'linear-gradient(135deg,rgba(14,165,233,0.1),rgba(14,165,233,0.04))', border: '#0ea5e9', text: '#0369a1', badge: '#dbeafe', badgeText: '#1e40af' },
                    { bg: 'linear-gradient(135deg,rgba(139,92,246,0.1),rgba(139,92,246,0.04))', border: '#8b5cf6', text: '#6d28d9', badge: '#ede9fe', badgeText: '#4c1d95' },
                    { bg: 'linear-gradient(135deg,rgba(245,158,11,0.1),rgba(245,158,11,0.04))', border: '#f59e0b', text: '#b45309', badge: '#fef3c7', badgeText: '#78350f' },
                    { bg: 'linear-gradient(135deg,rgba(20,184,166,0.1),rgba(20,184,166,0.04))', border: '#14b8a6', text: '#0f766e', badge: '#ccfbf1', badgeText: '#134e4a' },
                  ];

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {groups.map((group, gi) => {
                        const c = blockColors[gi % blockColors.length];
                        const slotCount = group.slots.length;
                        const durationMins = slotCount * 30;
                        const durationLabel = durationMins >= 60
                          ? `${Math.floor(durationMins/60)}h${durationMins%60 ? ` ${durationMins%60}m` : ''}`
                          : `${durationMins}m`;

                        return (
                          <div key={gi} style={{
                            background: c.bg,
                            border: `1.5px solid ${c.border}`,
                            borderRadius: 12,
                            padding: '10px 14px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: 12,
                          }}>
                            {/* Left: time range */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 4, height: 36, borderRadius: 4,
                                background: c.border, flexShrink: 0,
                              }} />
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 14, color: c.text }}>
                                  {group.start}
                                  {group.end !== group.start && <span style={{ fontWeight: 400, fontSize: 12, margin: '0 4px' }}>→</span>}
                                  {group.end !== group.start && group.end}
                                </div>
                                <div style={{ fontSize: 10, color: c.text, opacity: 0.7, marginTop: 2 }}>
                                  {slotCount} slot{slotCount > 1 ? 's' : ''} · {durationLabel} free
                                </div>
                              </div>
                            </div>
                            {/* Right: chips for each slot */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
                              {group.slots.map((s, si) => (
                                <span key={si} style={{
                                  fontSize: 10, fontWeight: 700,
                                  background: c.badge, color: c.badgeText,
                                  border: `1px solid ${c.border}`,
                                  borderRadius: 6, padding: '2px 7px',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {s.time}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
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
                      {task.source && sourceTag(task.source)}
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
                      {task.source && sourceTag(task.source)}
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
