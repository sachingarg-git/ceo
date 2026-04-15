import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';

// Auto-resize a single textarea to fit its content
function autoResize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}
import { api } from '../api';
import { useApp } from '../App';

// Strip company suffix from a name: "sachin (WIZONE AI LABS)" → "sachin"
function stripCompanySuffix(name) {
  if (!name) return '';
  return name.replace(/\s*\(.*\)\s*$/, '').trim();
}

// Get clean createdBy name for the current user
function getCreatedBy(user) {
  if (!user) return 'Unknown';
  if (user.isSubUser) {
    // Sub-user: name is "anjali (WIZONE AI LABS...)" → strip suffix → "anjali"
    return stripCompanySuffix(user.name) || user.username || 'Unknown';
  }
  // Company owner: use login username, not company trade name
  return user.username || stripCompanySuffix(user.name) || 'Unknown';
}

// Determine if the current user can see a specific task based on per-user visibility rules
function canSeeTaskByUser(task, currentUser, companyUsers, taskAccessGrants, isCompanyOwner) {
  if (isCompanyOwner) return true; // owner always sees all
  if (!task.createdBy) return true; // no creator = public

  // Own tasks always visible — normalize both sides
  const myName = stripCompanySuffix(currentUser?.name || '').toLowerCase();
  const myUsername = (currentUser?.username || '').toLowerCase();
  const storedBy = stripCompanySuffix(task.createdBy).toLowerCase();
  if (storedBy === myName || storedBy === myUsername) return true;

  // Find creator in company users
  const creator = companyUsers.find(u =>
    stripCompanySuffix(u.fullName || '').toLowerCase() === storedBy ||
    (u.username || '').toLowerCase() === storedBy
  );
  if (!creator) return true; // unknown creator = show

  // If creator is Private, need explicit grant
  if (creator.taskPrivacy === 'Private') {
    const mySubUserId = currentUser?.subUserId;
    return taskAccessGrants.some(g => g.ownerUserId === creator.id && g.viewerUserId === mySubUserId);
  }

  return true; // Public
}

const TIME_SLOTS = [
  '7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM',
  '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM',
  '4:00 PM','4:30 PM','5:00 PM','5:30 PM','6:00 PM','6:30 PM','7:00 PM',
  '7:30 PM','8:00 PM','8:30 PM','9:00 PM','9:30 PM','10:00 PM','10:30 PM','11:00 PM','11:30 PM'
];

const STATUS_FILTERS = ['Active', 'Paused', 'Stopped', 'All'];
const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Yearly', 'Fixed Date'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEK_POSITIONS = [
  { value: 'First', label: '1st' },
  { value: 'Second', label: '2nd' },
  { value: 'Third', label: '3rd' },
  { value: 'Fourth', label: '4th' },
  { value: 'Last', label: 'Last' },
];
const TASK_STATUSES = ['Active', 'Paused', 'Stopped'];
const SL_STATUSES = ['Scheduled', 'Waiting', 'Completed', 'Skipped'];

const COL_COUNT = 17;

function showWeekday(freq) {
  return freq === 'Daily' || freq === 'Weekly' || freq === 'Monthly';
}
function showWeekPosition(freq) {
  // WK POS is available for Daily, Weekly, and Monthly
  return freq === 'Daily' || freq === 'Weekly' || freq === 'Monthly';
}

// Helper: does a date match the Nth weekday of its month?
function matchesNthWeekdayOfMonth(date, weekday, weekPosition) {
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const targetDay = days.indexOf(weekday);
  if (targetDay < 0) return false;
  const jsTarget = (targetDay + 1) % 7; // convert Mon-based to JS Sun-based
  const posMap = { First: 1, Second: 2, Third: 3, Fourth: 4, Last: 99 };
  const pos = posMap[weekPosition] || 0;
  if (!pos) return false;
  if (pos === 99) {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const diff = (lastDay.getDay() - jsTarget + 7) % 7;
    return date.getDate() === lastDay.getDate() - diff;
  }
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = (jsTarget - firstDay.getDay() + 7) % 7;
  return date.getDate() === 1 + offset + (pos - 1) * 7;
}

// Does this RT row occur on the given ISO date string?
// weekday may be comma-separated multi-day e.g. "Monday,Saturday"
function rtOccursOnDate(rt, dateStr) {
  if (!rt || !dateStr) return false;
  const date = new Date(dateStr + 'T00:00:00');
  const freq = (rt.frequency || '').toLowerCase();
  const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const dayOfWeekIdx = (date.getDay() + 6) % 7; // Mon=0 … Sun=6
  // Parse multi-day weekday
  const weekdays = rt.weekday ? rt.weekday.split(',').map(d => d.trim()).filter(Boolean) : [];

  if (freq === 'daily') {
    if (weekdays.length > 0) {
      // Single day + position: Nth weekday of month
      if (rt.weekPosition && weekdays.length === 1)
        return matchesNthWeekdayOfMonth(date, weekdays[0], rt.weekPosition);
      // Multi-day: occurs on any of the selected weekdays
      return weekdays.some(d => dayNames.indexOf(d) === dayOfWeekIdx);
    }
    return true; // pure daily (every day)
  }
  if (freq === 'weekly') {
    if (weekdays.length === 0) return false;
    const matchesDay = weekdays.some(d => dayNames.indexOf(d) === dayOfWeekIdx);
    if (!matchesDay) return false;
    // Position only meaningful for single day
    if (rt.weekPosition && weekdays.length === 1)
      return matchesNthWeekdayOfMonth(date, weekdays[0], rt.weekPosition);
    return true;
  }
  if (freq === 'monthly') {
    if (rt.fixedDate) { const fd = new Date(rt.fixedDate + 'T00:00:00'); return date.getDate() === fd.getDate(); }
    const wd = weekdays[0] || '';
    return matchesNthWeekdayOfMonth(date, wd, rt.weekPosition);
  }
  if (freq === 'fixed date') return dateStr === rt.fixedDate;
  if (freq === 'yearly') {
    if (!rt.fixedDate) return false;
    const fd = new Date(rt.fixedDate + 'T00:00:00');
    return date.getMonth() === fd.getMonth() && date.getDate() === fd.getDate();
  }
  return false;
}

// Do two RT rows share at least one common calendar day?
function rtTasksShareDay(a, b) {
  const freqA = (a.frequency || '').toLowerCase();
  const freqB = (b.frequency || '').toLowerCase();
  // Support comma-separated multi-day weekdays
  const daysA = a.weekday ? a.weekday.split(',').map(d => d.trim()).filter(Boolean) : [];
  const daysB = b.weekday ? b.weekday.split(',').map(d => d.trim()).filter(Boolean) : [];
  const posA  = a.weekPosition || '';
  const posB  = b.weekPosition || '';

  // Pure daily (no weekday filter) occurs every day → always shares a day
  if (freqA === 'daily' && daysA.length === 0) return true;
  if (freqB === 'daily' && daysB.length === 0) return true;

  // Both have specific weekdays → conflict only if any weekday overlaps
  if (daysA.length > 0 && daysB.length > 0) {
    const overlap = daysA.some(d => daysB.includes(d));
    if (!overlap) return false;
    // Position check only when both are single-day
    if (daysA.length === 1 && daysB.length === 1 && posA && posB && posA !== posB) return false;
    return true;
  }

  // Fixed date vs fixed date
  if (freqA === 'fixed date' && freqB === 'fixed date') return a.fixedDate === b.fixedDate;

  // Fixed date vs any recurring → check if that date falls on the recurring pattern
  if (freqA === 'fixed date' || freqB === 'fixed date') {
    const fdTask  = freqA === 'fixed date' ? a : b;
    const recTask = freqA === 'fixed date' ? b : a;
    if (!fdTask.fixedDate) return false;
    return rtOccursOnDate(recTask, fdTask.fixedDate);
  }

  // Monthly vs monthly
  const dayA = daysA[0] || '';
  const dayB = daysB[0] || '';
  if (freqA === 'monthly' && freqB === 'monthly') return dayA === dayB && posA === posB;

  return false; // safe default — no proven overlap
}

function parseTimeToMin(t) {
  if (!t) return null;
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1]), min = parseInt(m[2]);
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function calcDuration(from, to) {
  if (!from || !to) return '';
  const f = parseTimeToMin(from), t2 = parseTimeToMin(to);
  if (f === null || t2 === null) return '';
  if (t2 <= f) return <span style={{ color: '#ef4444', fontSize: 10 }}>⚠ To &lt; From</span>;
  const diff = t2 - f;
  const h = Math.floor(diff / 60), m = diff % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

// ── Multi-Day Checkbox Dropdown ──────────────────────────────────────────────
// value:    comma-separated string like "Monday,Saturday" or ""
// onChange: fires ONLY when the dropdown closes (not on every tick) → one API save per session
function MultiDaySelect({ value, onChange, disabled }) {
  const [open, setOpen]     = React.useState(false);
  // draft = what's checked inside the open dropdown (not yet committed)
  const [draft, setDraft]   = React.useState([]);
  const ref                 = React.useRef(null);
  const onChangeRef         = React.useRef(onChange);
  onChangeRef.current       = onChange;

  // Sync draft from value when dropdown opens
  const committed = value ? value.split(',').map(d => d.trim()).filter(Boolean) : [];

  const openDropdown = () => {
    if (disabled) return;
    setDraft([...committed]); // start draft from current saved value
    setOpen(true);
  };

  // Commit draft → call onChange (→ API save) only if something changed
  const closeAndSave = React.useCallback((currentDraft) => {
    setOpen(false);
    const newVal = currentDraft.join(',');
    const oldVal = (value || '');
    if (newVal !== oldVal) onChangeRef.current(newVal);
  }, [value]);

  const toggle = (day) => {
    setDraft(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  // Click outside → commit
  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        // capture current draft before state update
        setDraft(d => { closeAndSave(d); return d; });
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, closeAndSave]);

  // Display label uses committed (saved) value in cell, draft inside open dropdown
  const displaySelected = open ? draft : committed;
  const label = displaySelected.length === 0
    ? '--'
    : displaySelected.length === 1
      ? displaySelected[0].slice(0, 3)
      : displaySelected.map(d => d.slice(0, 2)).join(',');

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <button
        type="button"
        onClick={openDropdown}
        disabled={disabled}
        style={{
          width: '100%', textAlign: 'left', background: 'transparent',
          border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 11, color: disabled ? 'var(--muted)' : 'var(--text)',
          padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <span style={{ fontWeight: committed.length > 0 ? 600 : 400 }}>{label}</span>
        <span style={{ fontSize: 8, opacity: 0.6 }}>▼</span>
      </button>
      {open && !disabled && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 9999,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          minWidth: 150, padding: '6px 0',
        }}>
          {WEEKDAYS.map(day => {
            const checked = draft.includes(day);
            return (
              <label key={day} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 12px', cursor: 'pointer', fontSize: 12,
                background: checked ? 'rgba(13,110,110,0.08)' : 'transparent',
                color: checked ? 'var(--primary)' : 'var(--text)',
                fontWeight: checked ? 600 : 400,
                userSelect: 'none',
              }}
                onMouseDown={e => e.preventDefault()} // prevent dropdown close on click
                onClick={() => toggle(day)}
              >
                <span style={{
                  width: 15, height: 15, borderRadius: 3, flexShrink: 0,
                  border: `2px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                  background: checked ? 'var(--primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {checked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </span>
                {day}
              </label>
            );
          })}
          {/* Footer: Clear + Done button */}
          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0 0', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setDraft([]); }}
              style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
            >
              ✕ Clear
            </button>
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => closeAndSave(draft)}
              style={{
                fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 5,
                background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer',
              }}
            >
              ✓ Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Returns TIME_SLOTS after fromSlot with conflict info from other RT rows + QC rows
function getValidToSlots(fromSlot, currentRow, otherRtRows, qcRows) {
  if (!fromSlot) return TIME_SLOTS.map(t => ({ slot: t, booked: false }));
  const idx = TIME_SLOTS.indexOf(fromSlot);
  const afterSlots = idx >= 0 ? TIME_SLOTS.slice(idx + 1) : TIME_SLOTS;
  const fromMin = parseTimeToMin(fromSlot);
  const bookedMins = getBookedMinutes(currentRow, otherRtRows, qcRows);

  return afterSlots.map(slot => {
    const slotMin = parseTimeToMin(slot);
    let booked = false;
    if (slotMin !== null) {
      for (let m = fromMin; m < slotMin; m += 30) {
        if (bookedMins.has(m)) { booked = true; break; }
      }
    }
    return { slot, booked };
  });
}
// Returns set of minute-values booked by other active RT rows + QC rows on overlapping dates
function getBookedMinutes(currentRow, otherRtRows, qcRows) {
  const bookedMins = new Set();
  if (!currentRow) return bookedMins;

  // 1. Other Recurring Tasks — only flag if they share at least one calendar day
  if (otherRtRows) {
    otherRtRows.forEach(other => {
      if (!other.timeSlot || (other.status || '').toLowerCase() !== 'active') return;
      if (!rtTasksShareDay(currentRow, other)) return; // different days — no conflict
      const otherFrom = parseTimeToMin(other.timeSlot);
      const otherTo   = other.timeTo ? parseTimeToMin(other.timeTo) : (otherFrom !== null ? otherFrom + 30 : null);
      if (otherFrom === null) return;
      const otherEnd  = otherTo !== null ? otherTo : otherFrom + 30;
      for (let m = otherFrom; m < otherEnd; m += 30) bookedMins.add(m);
    });
  }

  // 2. Quick Capture rows — only add if the QC date falls on a day the current RT occurs
  if (qcRows) {
    qcRows.forEach(qc => {
      if (!qc.schedTimeFrom || qc.slStatus === 'Completed') return;
      // If QC has a specific date, check it matches the current RT's schedule
      if (qc.schedDate && !rtOccursOnDate(currentRow, qc.schedDate)) return;
      const qcFrom = parseTimeToMin(qc.schedTimeFrom);
      const qcTo   = qc.schedTimeTo ? parseTimeToMin(qc.schedTimeTo) : (qcFrom !== null ? qcFrom + 30 : null);
      if (qcFrom === null) return;
      const qcEnd  = qcTo !== null ? qcTo : qcFrom + 30;
      for (let m = qcFrom; m < qcEnd; m += 30) bookedMins.add(m);
    });
  }

  return bookedMins;
}

function showFixedDate(freq) {
  return freq === 'Yearly' || freq === 'Fixed Date' || freq === 'Monthly';
}

function formatNextOcc(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return dd + '-' + mm + '-' + yyyy;
  } catch {
    return isoStr;
  }
}

export default function RecurringTasks() {
  const { showToast, user, viewMode, setViewMode, canViewAll, isCompanyOwner, companyUsers = [], taskAccessGrants = [] } = useApp();
  const [rows, setRows] = useState([]);
  const [qcRows, setQcRows] = useState([]); // Quick Capture rows for slot conflict detection
  const [masters, setMasters] = useState(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Active');
  const [filterFrequency, setFilterFrequency] = useState('');

  const [selected, setSelected] = useState(new Set());
  const [newRow, setNewRow] = useState(null); // unsaved new row
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const tbodyRef = useRef(null);

  // Resize all task-name textareas after every render (handles initial load + data changes)
  useLayoutEffect(() => {
    if (!tbodyRef.current) return;
    tbodyRef.current.querySelectorAll('textarea.ss-task-cell').forEach(autoResize);
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, mastersRes, qcRes] = await Promise.all([
        api.getRecurringTasks(),
        api.getMasters(),
        api.getQuickCapture(),
      ]);
      if (res.success) setRows(res.rows || []);
      if (mastersRes.success || mastersRes.data) setMasters(mastersRes.masters || mastersRes.data || mastersRes);
      if (qcRes.success) setQcRows(qcRes.rows || []);
    } catch (err) {
      showToast('Error loading data: ' + err.message, 'error');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const priorityOptions = masters?.priorities || ['High', 'Medium', 'Low'];
  const batchTypeOptions = masters?.batchTypes || masters?.batchType || [];

  /* ── filtering ── */
  const filtered = useMemo(() => {
    let result = rows.filter(r => {
      if (search && !(r.task || r.name || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus !== 'All' && (r.status || '').toLowerCase() !== filterStatus.toLowerCase()) return false;
      if (filterFrequency && r.frequency !== filterFrequency) return false;
      return true;
    });
    // viewMode filter — "Me Only" shows ONLY tasks created by the logged-in user
    if (viewMode === 'me') {
      const myIdentity = getCreatedBy(user).toLowerCase();
      result = result.filter(r => {
        if (!r.createdBy) return false;
        return stripCompanySuffix(r.createdBy).toLowerCase() === myIdentity;
      });
    }
    // Per-user privacy filter (only when viewMode is 'all' and has rights)
    if (viewMode === 'all' && canViewAll && !isCompanyOwner) {
      result = result.filter(r => canSeeTaskByUser(r, user, companyUsers, taskAccessGrants, isCompanyOwner));
    }
    return result;
  }, [rows, search, filterStatus, filterFrequency, viewMode, user, canViewAll, isCompanyOwner, companyUsers, taskAccessGrants]);

  /* ── inline cell change (existing rows) ── */
  async function handleCellChange(id, field, value) {
    const updates = { [field]: value };

    // When frequency changes, clear irrelevant fields
    if (field === 'frequency') {
      if (!showWeekday(value)) updates.weekday = '';
      if (!showWeekPosition(value)) updates.weekPosition = '';
      if (!showFixedDate(value)) updates.fixedDate = '';
    }

    // When Time From changes, clear Time To if it's now before or equal to From
    if (field === 'timeSlot') {
      const currentRow = rows.find(r => r.id === id);
      if (currentRow?.timeTo) {
        const fromMin = parseTimeToMin(value);
        const toMin = parseTimeToMin(currentRow.timeTo);
        if (fromMin !== null && toMin !== null && toMin <= fromMin) {
          updates.timeTo = '';
        }
      }
    }

    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    try {
      const res = await api.updateRecurring(id, updates);
      if (!res.success) showToast(res.message || 'Failed to save', 'error');
    } catch {
      showToast('Failed to save', 'error');
    }
  }

  /* ── new row handling ── */
  function addNewRow() {
    if (newRow) return; // already have an unsaved row
    setNewRow({
      task: '', priority: 'Medium', frequency: 'Daily', weekday: '',
      weekPosition: '', fixedDate: '', timeSlot: '', timeTo: '', batchType: '',
      status: 'Active', slStatus: 'Scheduled', notes: '',
      createdBy: getCreatedBy(user),
    });
  }

  function updateNewRowField(field, value) {
    setNewRow(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      // When frequency changes, clear irrelevant fields
      if (field === 'frequency') {
        if (!showWeekday(value)) updated.weekday = '';
        if (!showWeekPosition(value)) updated.weekPosition = '';
        if (!showFixedDate(value)) updated.fixedDate = '';
      }
      // When Time From changes, clear Time To if it becomes invalid
      if (field === 'timeSlot') {
        const fromMin = parseTimeToMin(value);
        const toMin = parseTimeToMin(prev.timeTo);
        if (fromMin !== null && toMin !== null && toMin <= fromMin) {
          updated.timeTo = '';
        }
      }
      return updated;
    });
  }

  async function saveNewRow() {
    if (!newRow || !newRow.task.trim()) return;
    try {
      const res = await api.addRecurring({ ...newRow, createdBy: newRow.createdBy || getCreatedBy(user) });
      if (res.success) {
        showToast('Recurring task added', 'success');
        setNewRow(null);
        loadData();
      } else {
        showToast(res.message || 'Failed to add', 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  /* ── new row: save on blur from task name if filled ── */
  function handleNewRowTaskBlur() {
    if (newRow && newRow.task.trim()) {
      saveNewRow();
    }
  }

  /* ── delete ── */
  async function handleDelete(id) {
    try {
      const res = await api.deleteRecurring(id);
      if (res.success) {
        showToast('Task deleted', 'success');
        setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
        loadData();
      } else {
        showToast(res.message || 'Failed to delete', 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  /* ── select ── */
  function toggleSelect(id) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleSelectAll(checked) {
    setSelected(checked ? new Set(filtered.map(r => r.id)) : new Set());
  }
  async function deleteSelected() {
    if (selected.size === 0) return;
    for (const id of selected) {
      try { await api.deleteRecurring(id); } catch { /* skip */ }
    }
    showToast(selected.size + ' tasks deleted', 'success');
    setSelected(new Set());
    loadData();
  }

  /* ── keyboard navigation ── */
  const handleKeyDown = useCallback((e) => {
    const cell = e.target.closest('[data-row][data-col]');
    if (!cell || !tbodyRef.current) return;

    const row = parseInt(cell.dataset.row, 10);
    const col = parseInt(cell.dataset.col, 10);
    let targetRow = row;
    let targetCol = col;

    if (e.key === 'Enter') {
      e.preventDefault();
      targetCol = col + 1;
      if (targetCol >= COL_COUNT) { targetCol = 2; targetRow = row + 1; }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      targetCol = col + 1;
      if (targetCol >= COL_COUNT) return;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      targetCol = col - 1;
      if (targetCol < 0) return;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      targetRow = row + 1;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      targetRow = row - 1;
      if (targetRow < 0) return;
    } else {
      return;
    }

    const target = tbodyRef.current.querySelector('[data-row="' + targetRow + '"][data-col="' + targetCol + '"]');
    if (target) {
      const focusable = target.querySelector('input, select, textarea, button') || target;
      focusable.focus();
    }
  }, []);

  /* ── loading ── */
  if (loading) {
    return (
      <div>
        <div className="page-header"><div></div></div>
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      </div>
    );
  }

  /* ── no rights overlay ── */
  if (viewMode === 'all' && !canViewAll) {
    return (
      <div>
        <div className="page-header"><div></div></div>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>No rights to view all tasks</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
            Your company admin has restricted access. Switch to "Me Only" to see your tasks.
          </div>
          <button className="btn btn-primary" onClick={() => setViewMode('me')}>
            👤 Switch to Me Only
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={addNewRow}>+ Add Recurring Task</button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input type="text" className="form-input" placeholder="Search tasks..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth: 220 }} />
        <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ maxWidth: 140 }}>
          <option value="All">All Status</option>
          {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-select" value={filterFrequency} onChange={e => setFilterFrequency(e.target.value)} style={{ maxWidth: 140 }}>
          <option value="">All Frequency</option>
          {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{filtered.length} tasks</div>
      </div>

      {/* Spreadsheet Table */}
      <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid #e0e8f0' }}>
        <div className="ss-toolbar">
          <div className="ss-toolbar-left">
            <button className={'ss-del-btn' + (selected.size > 0 ? ' active' : '')}
              onClick={deleteSelected} disabled={selected.size === 0}>
              &#10005; Delete
            </button>
            {selected.size > 0 && <span className="ss-sel-count">{selected.size} selected</span>}
          </div>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: '65vh', overflowY: 'auto' }}>
          <table className="ss-table">
            <thead>
              <tr>
                <th style={{ width: 28, position: 'sticky', left: 0, zIndex: 4, background: 'var(--primary)', textAlign: 'center' }}><input type="checkbox" className="ss-check" onChange={e => toggleSelectAll(e.target.checked)} /></th>
                <th style={{ width: 28 }}>#</th>
                <th style={{ minWidth: 240 }}>Task Name</th>
                <th style={{ minWidth: 90 }}>Priority</th>
                <th style={{ minWidth: 110 }}>Frequency</th>
                <th style={{ minWidth: 120 }}>Day</th>
                <th style={{ minWidth: 100 }}>Wk Pos</th>
                <th style={{ minWidth: 110 }}>Fixed Date</th>
                <th style={{ minWidth: 105 }}>Time From</th>
                <th style={{ minWidth: 105 }}>Time To</th>
                <th style={{ minWidth: 80 }}>Duration</th>
                <th style={{ minWidth: 130 }}>Batch</th>
                <th style={{ minWidth: 100 }}>Status</th>
                <th style={{ minWidth: 100 }}>Next Occ.</th>
                <th style={{ minWidth: 105 }}>SL Status</th>
                <th style={{ minWidth: 110 }}>Created By</th>
                <th style={{ minWidth: 50 }}>Actions</th>
              </tr>
            </thead>
            <tbody ref={tbodyRef} onKeyDown={handleKeyDown}>
              {filtered.length === 0 && !newRow ? (
                <tr><td colSpan={COL_COUNT} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                  {rows.length === 0 ? 'No recurring tasks yet. Click "+ Add Recurring Task" to get started!' : 'No tasks match your filters.'}
                </td></tr>
              ) : (
                <>
                  {filtered.map((row, idx) => {
                    const freq = row.frequency || '';
                    const dayEnabled = showWeekday(freq);
                    const wpEnabled = showWeekPosition(freq);
                    const fdEnabled = showFixedDate(freq);

                    return (
                      <tr key={row.id}>
                        {/* 0: checkbox */}
                        <td data-row={idx} data-col={0} style={{ textAlign: 'center', position: 'sticky', left: 0, zIndex: 1, background: '#fff' }}>
                          <input type="checkbox" className="ss-check" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} />
                        </td>
                        {/* 1: # */}
                        <td data-row={idx} data-col={1} className="ss-num">
                          {idx + 1}
                        </td>
                        {/* 2: Task Name */}
                        <td data-row={idx} data-col={2} className="ss-task-td">
                          <textarea className="ss-task-cell" defaultValue={row.task || row.name || ''}
                            rows={1}
                            onInput={e => autoResize(e.target)}
                            onBlur={e => { if (e.target.value !== (row.task || row.name || '')) handleCellChange(row.id, 'task', e.target.value); }} />
                        </td>
                        {/* 3: Priority */}
                        <td data-row={idx} data-col={3}>
                          <select className="ss-cell" value={row.priority || ''} onChange={e => handleCellChange(row.id, 'priority', e.target.value)}>
                            <option value="">--</option>
                            {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        {/* 4: Frequency */}
                        <td data-row={idx} data-col={4}>
                          <select className="ss-cell" value={freq} onChange={e => handleCellChange(row.id, 'frequency', e.target.value)}>
                            <option value="">--</option>
                            {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </td>
                        {/* 5: Day (Weekday) — multi-select checkboxes */}
                        <td data-row={idx} data-col={5} style={{ overflow: 'visible' }}>
                          <MultiDaySelect
                            value={row.weekday || ''}
                            onChange={v => handleCellChange(row.id, 'weekday', v)}
                            disabled={!dayEnabled}
                          />
                        </td>
                        {/* 6: Week Position — disabled when multiple days selected */}
                        {(() => {
                          const multiDay = (row.weekday || '').split(',').filter(d => d.trim()).length > 1;
                          return (
                            <td data-row={idx} data-col={6}>
                              <select className="ss-cell" value={row.weekPosition || ''} onChange={e => handleCellChange(row.id, 'weekPosition', e.target.value)} disabled={!wpEnabled || multiDay}>
                                <option value="">--</option>
                                {WEEK_POSITIONS.map(wp => <option key={wp.value} value={wp.value}>{wp.label}</option>)}
                              </select>
                            </td>
                          );
                        })()}
                        {/* 7: Fixed Date */}
                        <td data-row={idx} data-col={7} style={{ background: fdEnabled ? 'rgba(13,110,110,0.06)' : 'transparent' }}>
                          <input type="date" className="ss-cell ss-date-only" value={row.fixedDate || ''}
                            onChange={e => handleCellChange(row.id, 'fixedDate', e.target.value)}
                            disabled={!fdEnabled}
                            style={{ opacity: fdEnabled ? 1 : 0.3, cursor: fdEnabled ? 'pointer' : 'not-allowed', borderColor: fdEnabled && row.fixedDate ? 'var(--primary)' : 'transparent' }} />
                        </td>
                        {/* 8: Time From */}
                        <td data-row={idx} data-col={8}>
                          {(() => {
                            const bookedMins = getBookedMinutes(row, rows.filter(r => r.id !== row.id), qcRows);
                            return (
                              <select className="ss-cell" value={row.timeSlot || ''} onChange={e => handleCellChange(row.id, 'timeSlot', e.target.value)}>
                                <option value="">--</option>
                                {TIME_SLOTS.map(t => {
                                  const min = parseTimeToMin(t);
                                  const booked = min !== null && bookedMins.has(min);
                                  return <option key={t} value={t} disabled={booked} style={booked ? { color: '#ef4444' } : {}}>{booked ? t + ' (Conflict)' : t}</option>;
                                })}
                              </select>
                            );
                          })()}
                        </td>
                        {/* 9: Time To */}
                        <td data-row={idx} data-col={9}>
                          <select className="ss-cell" value={row.timeTo || ''}
                            onChange={e => handleCellChange(row.id, 'timeTo', e.target.value)}>
                            <option value="">--</option>
                            {getValidToSlots(row.timeSlot, row, rows.filter(r => r.id !== row.id), qcRows).map(({ slot, booked }) => (
                              <option key={slot} value={slot} disabled={booked} style={booked ? { color: '#ef4444' } : {}}>
                                {booked ? slot + ' (Conflict)' : slot}
                              </option>
                            ))}
                          </select>
                        </td>
                        {/* 10: Duration */}
                        <td data-row={idx} data-col={10} style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, padding: '0 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          {calcDuration(row.timeSlot, row.timeTo)}
                        </td>
                        {/* 11: Batch */}
                        <td data-row={idx} data-col={11}>
                          {Array.isArray(batchTypeOptions) && batchTypeOptions.length > 0 ? (
                            <select className="ss-cell" value={row.batchType || ''} onChange={e => handleCellChange(row.id, 'batchType', e.target.value)}>
                              <option value="">--</option>
                              {batchTypeOptions.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                            </select>
                          ) : (
                            <input className="ss-cell" defaultValue={row.batchType || ''}
                              onBlur={e => { if (e.target.value !== (row.batchType || '')) handleCellChange(row.id, 'batchType', e.target.value); }} />
                          )}
                        </td>
                        {/* 12: Status */}
                        <td data-row={idx} data-col={12}>
                          <select className="ss-cell" value={row.status || ''} onChange={e => handleCellChange(row.id, 'status', e.target.value)}>
                            <option value="">--</option>
                            {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        {/* 13: Next Occurrence (read-only) */}
                        <td data-row={idx} data-col={13} style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                          {formatNextOcc(row._nextOccurrenceISO) || row._nextOccurrence || '-'}
                        </td>
                        {/* 14: SL Status */}
                        <td data-row={idx} data-col={14}>
                          <select className="ss-cell" value={row.slStatus || ''} onChange={e => handleCellChange(row.id, 'slStatus', e.target.value)}>
                            <option value="">--</option>
                            {SL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        {/* 15: Created By (read-only) */}
                        <td data-row={idx} data-col={15} style={{ fontSize: 11, color: 'var(--muted)', padding: '0 8px', whiteSpace: 'nowrap' }}>
                          {row.createdBy || '-'}
                        </td>
                        {/* 16: Actions (delete) */}
                        <td data-row={idx} data-col={16} style={{ textAlign: 'center' }}>
                          <button className="ss-del" title="Delete" onClick={() => setDeleteConfirmId(row.id)}>&times;</button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* New unsaved row */}
                  {newRow && (
                    <tr className="ss-row-new">
                      {/* checkbox */}
                      <td style={{ textAlign: 'center' }}><input type="checkbox" className="ss-check" disabled /></td>
                      {/* # */}
                      <td className="ss-num">{filtered.length + 1}</td>
                      {/* Task Name */}
                      <td className="ss-task-td">
                        <textarea className="ss-task-cell" autoFocus placeholder="Enter task name..."
                          rows={1}
                          value={newRow.task} onChange={e => updateNewRowField('task', e.target.value)}
                          onInput={e => autoResize(e.target)}
                          onBlur={handleNewRowTaskBlur}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveNewRow(); } }} />
                      </td>
                      {/* Priority */}
                      <td>
                        <select className="ss-cell" value={newRow.priority} onChange={e => updateNewRowField('priority', e.target.value)}>
                          {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      {/* Frequency */}
                      <td>
                        <select className="ss-cell" value={newRow.frequency} onChange={e => updateNewRowField('frequency', e.target.value)}>
                          {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </td>
                      {/* Day — multi-select checkboxes */}
                      <td style={{ overflow: 'visible' }}>
                        <MultiDaySelect
                          value={newRow.weekday}
                          onChange={v => updateNewRowField('weekday', v)}
                          disabled={!showWeekday(newRow.frequency)}
                        />
                      </td>
                      {/* Wk Pos — disabled when multiple days */}
                      <td>
                        {(() => {
                          const multiDay = (newRow.weekday || '').split(',').filter(d => d.trim()).length > 1;
                          return (
                            <select className="ss-cell" value={newRow.weekPosition} onChange={e => updateNewRowField('weekPosition', e.target.value)} disabled={!showWeekPosition(newRow.frequency) || multiDay}>
                              <option value="">--</option>
                              {WEEK_POSITIONS.map(wp => <option key={wp.value} value={wp.value}>{wp.label}</option>)}
                            </select>
                          );
                        })()}
                      </td>
                      {/* Fixed Date */}
                      <td style={{ background: showFixedDate(newRow.frequency) ? 'rgba(13,110,110,0.06)' : 'transparent' }}>
                        <input type="date" className="ss-cell ss-date-only" value={newRow.fixedDate}
                          onChange={e => updateNewRowField('fixedDate', e.target.value)}
                          disabled={!showFixedDate(newRow.frequency)}
                          style={{ opacity: showFixedDate(newRow.frequency) ? 1 : 0.3, cursor: showFixedDate(newRow.frequency) ? 'pointer' : 'not-allowed' }} />
                      </td>
                      {/* Time From */}
                      <td>
                        {(() => {
                          const bookedMins = getBookedMinutes(newRow, rows, qcRows);
                          return (
                            <select className="ss-cell" value={newRow.timeSlot} onChange={e => updateNewRowField('timeSlot', e.target.value)}>
                              <option value="">--</option>
                              {TIME_SLOTS.map(t => {
                                const min = parseTimeToMin(t);
                                const booked = min !== null && bookedMins.has(min);
                                return <option key={t} value={t} disabled={booked} style={booked ? { color: '#ef4444' } : {}}>{booked ? t + ' (Conflict)' : t}</option>;
                              })}
                            </select>
                          );
                        })()}
                      </td>
                      {/* Time To */}
                      <td>
                        <select className="ss-cell" value={newRow.timeTo || ''} onChange={e => updateNewRowField('timeTo', e.target.value)}>
                          <option value="">--</option>
                          {getValidToSlots(newRow.timeSlot, newRow, rows, qcRows).map(({ slot, booked }) => (
                            <option key={slot} value={slot} disabled={booked} style={booked ? { color: '#ef4444' } : {}}>
                              {booked ? slot + ' (Conflict)' : slot}
                            </option>
                          ))}
                        </select>
                      </td>
                      {/* Duration */}
                      <td style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, padding: '0 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        {calcDuration(newRow.timeSlot, newRow.timeTo)}
                      </td>
                      {/* Batch */}
                      <td>
                        {Array.isArray(batchTypeOptions) && batchTypeOptions.length > 0 ? (
                          <select className="ss-cell" value={newRow.batchType} onChange={e => updateNewRowField('batchType', e.target.value)}>
                            <option value="">--</option>
                            {batchTypeOptions.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                          </select>
                        ) : (
                          <input className="ss-cell" value={newRow.batchType} onChange={e => updateNewRowField('batchType', e.target.value)} />
                        )}
                      </td>
                      {/* Status */}
                      <td>
                        <select className="ss-cell" value={newRow.status} onChange={e => updateNewRowField('status', e.target.value)}>
                          {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      {/* Next Occ (empty for new) */}
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>-</td>
                      {/* SL Status */}
                      <td>
                        <select className="ss-cell" value={newRow.slStatus} onChange={e => updateNewRowField('slStatus', e.target.value)}>
                          {SL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      {/* Created By (read-only, pre-filled) */}
                      <td style={{ fontSize: 11, color: 'var(--muted)', padding: '0 8px', whiteSpace: 'nowrap' }}>
                        {newRow.createdBy || '-'}
                      </td>
                      {/* Actions: cancel new row */}
                      <td style={{ textAlign: 'center' }}>
                        <button className="ss-del" title="Cancel" onClick={() => setNewRow(null)}>&times;</button>
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <div className={'modal-overlay' + (deleteConfirmId ? ' show' : '')} onClick={e => { if (e.target === e.currentTarget) setDeleteConfirmId(null); }}>
        <div className="modal" style={{ maxWidth: 440 }}>
          <div className="modal-header">
            <h3>Delete Recurring Task</h3>
            <button className="modal-close" onClick={() => setDeleteConfirmId(null)}>&times;</button>
          </div>
          <div className="modal-body">
            {(() => {
              const task = rows.find(r => r.id === deleteConfirmId);
              if (!task) return <p>Are you sure you want to delete this task?</p>;
              return (
                <div>
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#DC2626', marginBottom: 4 }}>&#9888; This action cannot be undone</div>
                    <div style={{ fontSize: 11, color: '#7F1D1D' }}>This recurring task and all its scheduled occurrences will be permanently removed.</div>
                  </div>
                  <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{task.name || task.task || '-'}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Frequency: {task.frequency || '-'} {task.weekday ? '| Day: ' + task.weekday : ''} {task.timeSlot ? '| Time: ' + task.timeSlot : ''}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Priority: {task.priority || '-'} | Status: {task.status || '-'}</div>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => { handleDelete(deleteConfirmId); setDeleteConfirmId(null); }}>Delete Task</button>
          </div>
        </div>
      </div>
    </div>
  );
}
