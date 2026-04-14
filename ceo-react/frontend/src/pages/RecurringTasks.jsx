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

// Get clean createdBy name for the current user (no company suffix)
function getCreatedBy(user) {
  if (!user) return 'Unknown';
  if (user.isSubUser) return user.username || stripCompanySuffix(user.name) || 'Unknown';
  return stripCompanySuffix(user.name) || user.username || 'Unknown';
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
  return freq === 'Weekly' || freq === 'Monthly';
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

// Returns TIME_SLOTS filtered to only those after the given fromSlot
function getValidToSlots(fromSlot) {
  if (!fromSlot) return TIME_SLOTS;
  const idx = TIME_SLOTS.indexOf(fromSlot);
  return idx >= 0 ? TIME_SLOTS.slice(idx + 1) : TIME_SLOTS;
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
      const [res, mastersRes] = await Promise.all([
        api.getRecurringTasks(),
        api.getMasters()
      ]);
      if (res.success) setRows(res.rows || []);
      if (mastersRes.success || mastersRes.data) setMasters(mastersRes.masters || mastersRes.data || mastersRes);
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
      const myName = stripCompanySuffix(user?.name || '').toLowerCase();
      const myUsername = (user?.username || '').toLowerCase();
      result = result.filter(r => {
        if (!r.createdBy) return false;
        const storedBy = stripCompanySuffix(r.createdBy).toLowerCase();
        return storedBy === myName || storedBy === myUsername;
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
            <input type="checkbox" className="ss-check"
              onChange={e => toggleSelectAll(e.target.checked)}
              checked={selected.size > 0 && selected.size === filtered.length} />
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
                <th style={{ width: 28 }}><input type="checkbox" className="ss-check" onChange={e => toggleSelectAll(e.target.checked)} /></th>
                <th style={{ width: 28 }}>#</th>
                <th style={{ minWidth: 240 }}>Task Name</th>
                <th style={{ width: 80 }}>Priority</th>
                <th style={{ width: 100 }}>Frequency</th>
                <th style={{ width: 95 }}>Day</th>
                <th style={{ width: 85 }}>Wk Pos</th>
                <th style={{ width: 100 }}>Fixed Date</th>
                <th style={{ width: 95 }}>Time From</th>
                <th style={{ width: 95 }}>Time To</th>
                <th style={{ width: 75 }}>Duration</th>
                <th style={{ width: 95 }}>Batch</th>
                <th style={{ width: 80 }}>Status</th>
                <th style={{ width: 95 }}>Next Occ.</th>
                <th style={{ width: 90 }}>SL Status</th>
                <th style={{ width: 100 }}>Created By</th>
                <th style={{ width: 40 }}>Actions</th>
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
                        <td data-row={idx} data-col={0} style={{ textAlign: 'center' }}>
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
                        {/* 5: Day (Weekday) */}
                        <td data-row={idx} data-col={5}>
                          <select className="ss-cell" value={row.weekday || ''} onChange={e => handleCellChange(row.id, 'weekday', e.target.value)} disabled={!dayEnabled}>
                            <option value="">--</option>
                            {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </td>
                        {/* 6: Week Position */}
                        <td data-row={idx} data-col={6}>
                          <select className="ss-cell" value={row.weekPosition || ''} onChange={e => handleCellChange(row.id, 'weekPosition', e.target.value)} disabled={!wpEnabled}>
                            <option value="">--</option>
                            {WEEK_POSITIONS.map(wp => <option key={wp.value} value={wp.value}>{wp.label}</option>)}
                          </select>
                        </td>
                        {/* 7: Fixed Date */}
                        <td data-row={idx} data-col={7} style={{ background: fdEnabled ? 'rgba(13,110,110,0.06)' : 'transparent' }}>
                          <input type="date" className="ss-cell ss-date-only" value={row.fixedDate || ''}
                            onChange={e => handleCellChange(row.id, 'fixedDate', e.target.value)}
                            disabled={!fdEnabled}
                            style={{ opacity: fdEnabled ? 1 : 0.3, cursor: fdEnabled ? 'pointer' : 'not-allowed', borderColor: fdEnabled && row.fixedDate ? 'var(--primary)' : 'transparent' }} />
                        </td>
                        {/* 8: Time From */}
                        <td data-row={idx} data-col={8}>
                          <select className="ss-cell" value={row.timeSlot || ''} onChange={e => handleCellChange(row.id, 'timeSlot', e.target.value)}>
                            <option value="">--</option>
                            {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        {/* 9: Time To */}
                        <td data-row={idx} data-col={9}>
                          <select className="ss-cell" value={row.timeTo || ''}
                            onChange={e => handleCellChange(row.id, 'timeTo', e.target.value)}>
                            <option value="">--</option>
                            {getValidToSlots(row.timeSlot).map(t => <option key={t} value={t}>{t}</option>)}
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
                      {/* Day */}
                      <td>
                        <select className="ss-cell" value={newRow.weekday} onChange={e => updateNewRowField('weekday', e.target.value)} disabled={!showWeekday(newRow.frequency)}>
                          <option value="">--</option>
                          {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </td>
                      {/* Wk Pos */}
                      <td>
                        <select className="ss-cell" value={newRow.weekPosition} onChange={e => updateNewRowField('weekPosition', e.target.value)} disabled={!showWeekPosition(newRow.frequency)}>
                          <option value="">--</option>
                          {WEEK_POSITIONS.map(wp => <option key={wp.value} value={wp.value}>{wp.label}</option>)}
                        </select>
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
                        <select className="ss-cell" value={newRow.timeSlot} onChange={e => updateNewRowField('timeSlot', e.target.value)}>
                          <option value="">--</option>
                          {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      {/* Time To */}
                      <td>
                        <select className="ss-cell" value={newRow.timeTo || ''} onChange={e => updateNewRowField('timeTo', e.target.value)}>
                          <option value="">--</option>
                          {getValidToSlots(newRow.timeSlot).map(t => <option key={t} value={t}>{t}</option>)}
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
