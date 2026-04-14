import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  // Sub-users: store just username (clean, no company suffix)
  if (user.isSubUser) return user.username || stripCompanySuffix(user.name) || 'Unknown';
  // Company owner: name is already TradeName or LegalName (no suffix)
  return stripCompanySuffix(user.name) || user.username || 'Unknown';
}

// Determine if the current user can see a specific task based on per-user visibility rules
function canSeeTaskByUser(task, currentUser, companyUsers, taskAccessGrants, isCompanyOwner) {
  if (isCompanyOwner) return true; // owner always sees all
  if (!task.createdBy || task.createdBy === 'Auto (Recurring)') return true; // no creator = public

  // Own tasks always visible — normalize both sides to handle legacy stored names
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

// Compute whether a recurring task applies to a given date string (YYYY-MM-DD)
function doesRecurOn(rt, dateStr) {
  if (!rt || (rt.status || '').toLowerCase() !== 'active') return false;
  const date = new Date(dateStr + 'T00:00:00');
  const freq = rt.frequency;
  if (!freq) return false;

  if (freq === 'Daily') return true;

  if (freq === 'Weekly') {
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const targetDay = days.indexOf(rt.weekday);
    if (targetDay < 0) return false;
    const dateDay = (date.getDay() + 6) % 7; // 0=Monday
    return dateDay === targetDay;
  }

  if (freq === 'Monthly') {
    if (rt.fixedDate) {
      const fd = new Date(rt.fixedDate + 'T00:00:00');
      return date.getDate() === fd.getDate();
    }
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const targetDay = days.indexOf(rt.weekday);
    if (targetDay < 0) return false;
    const jsTarget = (targetDay + 1) % 7;
    const posMap = { First: 1, Second: 2, Third: 3, Fourth: 4, Last: 99 };
    const pos = posMap[rt.weekPosition] || 1;
    if (pos === 99) {
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const diff = (lastDay.getDay() - jsTarget + 7) % 7;
      return date.getDate() === lastDay.getDate() - diff;
    }
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const offset = (jsTarget - firstDay.getDay() + 7) % 7;
    return date.getDate() === 1 + offset + (pos - 1) * 7;
  }

  if (freq === 'Yearly') {
    if (!rt.fixedDate) return false;
    const fd = new Date(rt.fixedDate + 'T00:00:00');
    return date.getMonth() === fd.getMonth() && date.getDate() === fd.getDate();
  }

  if (freq === 'Fixed Date') {
    return dateStr === rt.fixedDate;
  }

  return false;
}

const TIME_SLOTS = [
  '7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM',
  '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM',
  '4:00 PM','4:30 PM','5:00 PM','5:30 PM','6:00 PM','6:30 PM','7:00 PM',
  '7:30 PM','8:00 PM','8:30 PM','9:00 PM','9:30 PM','10:00 PM','10:30 PM','11:00 PM','11:30 PM'
];

/* ── helpers ─────────────────────────────────────────────── */

function parseTimeSlot(slot) {
  if (!slot) return null;
  const m = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = m[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function formatCreated(dateStr, timeStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const display = parts[2] + '-' + parts[1] + '-' + parts[0];
  return timeStr ? display + ' ' + timeStr : display;
}

function currentTimeFormatted() {
  const d = new Date();
  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + min + ' ' + ampm;
}

function calcDuration(from, to) {
  if (!from || !to) return '';
  const parse = t => {
    const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return null;
    let h = parseInt(m[1]), min = parseInt(m[2]);
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  };
  const f = parse(from), t2 = parse(to);
  if (f === null || t2 === null || t2 <= f) return '';
  const diff = t2 - f;
  const h = Math.floor(diff / 60), m = diff % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

/* ── column map for keyboard nav ─────────────────────────── */
const COL_COUNT = 16; // checkbox(0), #(1), created(2), desc(3), priority(4), schedDate(5), deadline(6), sendTo(7), batch(8), slStatus(9), from(10), to(11), duration(12), createdBy(13), notes(14), actions(15)

/* ── component ───────────────────────────────────────────── */

export default function QuickCapture() {
  const { showToast, user, viewMode, setViewMode, canViewAll, isCompanyOwner, companyUsers = [], taskAccessGrants = [] } = useApp();
  const [rows, setRows] = useState([]);
  const [recurringTasks, setRecurringTasks] = useState([]);
  const [masters, setMasters] = useState(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterSendTo, setFilterSendTo] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [filterDate, setFilterDate] = useState(''); // 'today' | 'tomorrow' | 'upcoming'
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [selected, setSelected] = useState(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(getEmptyForm());
  const [slotConflict, setSlotConflict] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(null);

  const tbodyRef = useRef(null);

  useEffect(() => { loadData(); }, []);

  // Auto-resize all description textareas after rows render
  useEffect(() => {
    if (!tbodyRef.current) return;
    const textareas = tbodyRef.current.querySelectorAll('textarea.ss-desc-cell');
    textareas.forEach(ta => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });
  }, [rows]);

  function getEmptyForm() {
    return {
      description: '', priority: 'Medium', batchType: '', sendTo: 'Someday List',
      slStatus: 'Scheduled', schedDate: '', schedTimeFrom: '', schedTimeTo: '',
      deadline: '', notes: ''
    };
  }

  async function loadData() {
    setLoading(true);
    try {
      // Note: recurring tasks are shown via conflict indicators only, not synced as rows
      const [captureRes, mastersRes, recurRes] = await Promise.all([
        api.getQuickCapture(), api.getMasters(), api.getRecurringTasks()
      ]);
      if (captureRes.success) setRows(captureRes.rows || []);
      if (mastersRes.success) setMasters(mastersRes.masters);
      if (recurRes.success) setRecurringTasks(recurRes.rows || []);
    } catch { showToast('Error loading data', 'error'); }
    setLoading(false);
  }

  /* ── booked slots map: { "2026-04-05": Set(minuteValue) } ── */
  const bookedRanges = useMemo(() => {
    const map = {};

    function addRange(dateStr, fromSlot, toSlot, taskId) {
      if (!dateStr || !fromSlot) return;
      const fromMin = parseTimeSlot(fromSlot);
      const toMin = toSlot ? parseTimeSlot(toSlot) : (fromMin !== null ? fromMin + 30 : null);
      if (fromMin === null) return;
      const endMin = toMin !== null ? toMin : fromMin + 30;
      if (!map[dateStr]) map[dateStr] = {};
      // mark every 30-min slot from fromMin up to (but not including) endMin
      for (let m = fromMin; m < endMin; m += 30) {
        if (!map[dateStr][m]) map[dateStr][m] = [];
        map[dateStr][m].push(taskId);
      }
    }

    rows.forEach(r => {
      if (r.schedDate && r.schedTimeFrom) {
        addRange(r.schedDate, r.schedTimeFrom, r.schedTimeTo, r.id);
      }
    });

    // recurring tasks: use _nextOccurrenceISO (date part) + timeSlot
    recurringTasks.forEach(rt => {
      if (rt.status !== 'Active' && rt.status !== 'active') return;
      if (rt._nextOccurrenceISO && rt.timeSlot) {
        const dateStr = rt._nextOccurrenceISO.substring(0, 10);
        addRange(dateStr, rt.timeSlot, null, 'recurring-' + rt.id);
      }
    });

    return map;
  }, [rows, recurringTasks]);

  /* ── recurring conflict check for QC rows ── */
  const recurringConflicts = useMemo(() => {
    const conflicts = new Set();
    if (!recurringTasks.length) return conflicts;
    rows.forEach(r => {
      if (!r.schedDate || !r.schedTimeFrom) return;
      recurringTasks.forEach(rt => {
        if (rt.status !== 'Active' && rt.status !== 'active') return;
        if (!rt._nextOccurrenceISO || !rt.timeSlot) return;
        const rtDate = rt._nextOccurrenceISO.substring(0, 10);
        if (r.schedDate === rtDate && r.schedTimeFrom === rt.timeSlot) {
          conflicts.add(r.id);
        }
      });
    });
    return conflicts;
  }, [rows, recurringTasks]);

  function isSlotBooked(dateStr, slot, excludeTaskId) {
    if (!dateStr || !slot) return false;
    const slotMin = parseTimeSlot(slot);
    if (slotMin === null) return false;
    const dateMap = bookedRanges[dateStr];
    if (!dateMap || !dateMap[slotMin]) return false;
    const ids = dateMap[slotMin];
    if (excludeTaskId) {
      return ids.some(id => id !== excludeTaskId);
    }
    return ids.length > 0;
  }

  function getFilteredSlots(dateStr, excludeTaskId) {
    const today = todayISO();
    const isToday = dateStr === today;
    const currentMin = isToday ? nowMinutes() : -1;

    return TIME_SLOTS.map(slot => {
      const slotMin = parseTimeSlot(slot);
      const isPast = isToday && slotMin !== null && slotMin <= currentMin;
      const booked = isSlotBooked(dateStr, slot, excludeTaskId);
      return { slot, disabled: isPast || booked, label: booked ? slot + ' (Booked)' : slot, isPast, booked };
    });
  }

  function checkSlotConflict(date, timeFrom, currentId) {
    if (!date || !timeFrom) { setSlotConflict(''); return false; }
    if (isSlotBooked(date, timeFrom, currentId)) {
      setSlotConflict('Slot already booked at ' + timeFrom + ' on ' + date);
      return true;
    }
    setSlotConflict('');
    return false;
  }

  function getToSlots(fromSlot, dateStr, excludeTaskId) {
    if (!fromSlot) return [];
    const fromIdx = TIME_SLOTS.indexOf(fromSlot);
    if (fromIdx < 0) return [];
    const afterSlots = TIME_SLOTS.slice(fromIdx + 1);
    if (!dateStr) return afterSlots;
    const today = todayISO();
    const isToday = dateStr === today;
    const currentMin = isToday ? nowMinutes() : -1;
    return afterSlots.map(slot => {
      const slotMin = parseTimeSlot(slot);
      const isPast = isToday && slotMin !== null && slotMin <= currentMin;
      return { slot, disabled: isPast, label: slot };
    });
  }

  /* ── date card counts ── */
  const todayISO2 = todayISO();
  const tomorrowISO = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })();
  const todayCount = rows.filter(r => r.schedDate === todayISO2 && r.slStatus !== 'Completed').length;
  const tomorrowCount = rows.filter(r => r.schedDate === tomorrowISO && r.slStatus !== 'Completed').length;
  const upcomingCount = rows.filter(r => r.schedDate && r.schedDate > tomorrowISO && r.slStatus !== 'Completed').length;
  const notScheduledCount = rows.filter(r => !r.schedDate && r.slStatus !== 'Completed' && r.sendTo !== 'Information System').length;

  /* ── filtering ── */
  let filtered = rows.filter(r => {
    // Hide tasks sent to Information System (they show in Info System page instead)
    if (!filterSendTo && r.sendTo === 'Information System') return false;
    if (search && !(r.description || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSendTo && r.sendTo !== filterSendTo) return false;
    if (filterPriority && r.priority !== filterPriority) return false;
    if (filterStatus && r.slStatus !== filterStatus) return false;
    if (filterDate === 'today' && r.schedDate !== todayISO2) return false;
    if (filterDate === 'tomorrow' && r.schedDate !== tomorrowISO) return false;
    if (filterDate === 'upcoming' && !(r.schedDate && r.schedDate > tomorrowISO)) return false;
    if (filterDate === 'notscheduled' && !!r.schedDate) return false;
    return true;
  });
  // viewMode filter — "Me Only" shows ONLY tasks created by the logged-in user
  if (viewMode === 'me') {
    const myName = stripCompanySuffix(user?.name || '').toLowerCase();
    const myUsername = (user?.username || '').toLowerCase();
    filtered = filtered.filter(r => {
      if (!r.createdBy) return false; // no createdBy = not mine
      const storedBy = stripCompanySuffix(r.createdBy).toLowerCase();
      return storedBy === myName || storedBy === myUsername;
    });
  }

  // Per-user privacy filter (only when viewMode is 'all' and has rights)
  if (viewMode === 'all' && canViewAll && !isCompanyOwner) {
    filtered = filtered.filter(r => canSeeTaskByUser(r, user, companyUsers, taskAccessGrants, isCompanyOwner));
  }

  // Compute virtual recurring rows for the currently viewed date (today or tomorrow)
  const virtualRecurRows = useMemo(() => {
    const targetDate = filterDate === 'today' ? todayISO2
                     : filterDate === 'tomorrow' ? tomorrowISO
                     : null; // only show virtual rows when filtering by today or tomorrow
    if (!targetDate || !recurringTasks.length) return [];

    // Task names already in QC for this date (to avoid duplicates)
    const qcKeys = new Set(
      rows
        .filter(r => r.schedDate === targetDate && r.slStatus !== 'Completed')
        .map(r => (r.description || '').toLowerCase().trim())
    );

    return recurringTasks
      .filter(rt => doesRecurOn(rt, targetDate))
      .filter(rt => !qcKeys.has((rt.task || rt.name || '').toLowerCase().trim()))
      .map(rt => ({
        id: 'rt-virtual-' + rt.id,
        _isVirtualRecurring: true,
        description: rt.task || rt.name || '',
        priority: rt.priority || 'Medium',
        batchType: rt.batchType || '',
        schedDate: targetDate,
        schedTimeFrom: rt.timeSlot || '',
        schedTimeTo: rt.timeTo || '',
        slStatus: 'Scheduled',
        sendTo: 'Someday List',
        createdBy: 'Recurring',
        _recurFreq: rt.frequency,
      }));
  }, [recurringTasks, rows, filterDate, todayISO2, tomorrowISO]);

  /* ── inline cell change ── */
  async function handleCellChange(id, field, value) {
    const row = rows.find(r => r.id === id);
    const updates = { [field]: value };

    if (field === 'schedTimeFrom' || field === 'schedDate') {
      const date = field === 'schedDate' ? value : (row?.schedDate || '');
      const time = field === 'schedTimeFrom' ? value : (row?.schedTimeFrom || '');
      if (date && time && isSlotBooked(date, time, id)) {
        showToast('Slot already booked', 'warning');
        return;
      }
    }

    // Schedule Date -> auto-fill deadline + clear from/to if cleared
    if (field === 'schedDate') {
      if (value) {
        if (!row?.deadline) updates.deadline = value;
      } else {
        updates.schedTimeFrom = '';
        updates.schedTimeTo = '';
      }
    }

    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    try { await api.updateTask(id, updates); } catch { showToast('Failed to save', 'error'); }
  }

  /* ── modal ── */
  function openAddModal() {
    setEditingId(null);
    setForm(getEmptyForm());
    setSlotConflict('');
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditingId(null); setSlotConflict(''); }

  function handleFormChange(field, value) {
    const updated = { ...form, [field]: value };

    if (field === 'schedDate') {
      if (!value) {
        updated.schedTimeFrom = '';
        updated.schedTimeTo = '';
      } else {
        if (!updated.deadline) updated.deadline = value;
      }
    }

    if (field === 'schedDate' || field === 'schedTimeFrom') {
      checkSlotConflict(
        field === 'schedDate' ? value : form.schedDate,
        field === 'schedTimeFrom' ? value : form.schedTimeFrom,
        editingId
      );
    }

    if (field === 'schedTimeFrom' && value) {
      const fromIdx = TIME_SLOTS.indexOf(value);
      if (fromIdx >= 0 && fromIdx < TIME_SLOTS.length - 1) {
        updated.schedTimeTo = TIME_SLOTS[fromIdx + 1];
      }
    }

    setForm(updated);
  }

  async function handleSave() {
    if (!form.description.trim()) { showToast('Task description is required', 'warning'); return; }
    if (form.schedDate && form.schedTimeFrom) {
      const hasConflict = checkSlotConflict(form.schedDate, form.schedTimeFrom, editingId);
      if (hasConflict) { showToast('Cannot save - time slot already booked!', 'error'); return; }
    }
    try {
      const payload = { ...form };
      if (!editingId) {
        payload.date = todayISO();
        payload.time = currentTimeFormatted();
        payload.createdBy = getCreatedBy(user);
      }
      const res = editingId ? await api.updateTask(editingId, payload) : await api.addTask(payload);
      if (res.success) { showToast(editingId ? 'Task updated' : 'Task added', 'success'); closeModal(); loadData(); }
      else showToast('Failed to save', 'error');
    } catch { showToast('Error saving task', 'error'); }
  }

  async function handleDelete(id) {
    try {
      const res = await api.deleteTask(id);
      if (res.success) { showToast('Task deleted', 'success'); setDeleteId(null); loadData(); }
    } catch { showToast('Error deleting', 'error'); }
  }

  async function saveBulkTasks() {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { showToast('No tasks to add', 'warning'); return; }
    let added = 0;
    const now = todayISO();
    const nowTime = currentTimeFormatted();
    for (const line of lines) {
      try {
        const res = await api.addTask({ description: line, priority: 'Medium', sendTo: 'Someday List', slStatus: 'Scheduled', date: now, time: nowTime, createdBy: getCreatedBy(user) });
        if (res.success) added++;
      } catch { /* skip */ }
    }
    showToast(added + ' tasks added', 'success');
    setBulkText(''); setShowBulk(false); loadData();
  }

  function toggleSelect(id) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleSelectAll(checked) { setSelected(checked ? new Set(filtered.map(r => r.id)) : new Set()); }
  function requestDeleteSelected() {
    const tasksToDelete = rows.filter(r => selected.has(r.id));
    const scheduledTasks = tasksToDelete.filter(r => r.schedDate && r.schedTimeFrom);
    setBulkDeleteConfirm({ all: tasksToDelete, scheduled: scheduledTasks });
  }
  async function confirmBulkDelete() {
    if (!bulkDeleteConfirm) return;
    for (const t of bulkDeleteConfirm.all) { try { await api.deleteTask(t.id); } catch { /* skip */ } }
    showToast(bulkDeleteConfirm.all.length + ' tasks deleted', 'success');
    setSelected(new Set()); setBulkDeleteConfirm(null); loadData();
  }

  async function bulkSendToInfoSystem() {
    const count = selected.size;
    if (count === 0) return;
    let moved = 0;
    for (const id of selected) {
      try {
        await api.updateTask(id, { sendTo: 'Information System' });
        moved++;
      } catch { /* skip */ }
    }
    showToast(`${moved} task${moved > 1 ? 's' : ''} moved to Information System`, 'success');
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
      if (targetCol >= COL_COUNT) { targetCol = 3; targetRow = row + 1; }
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

  const bulkCount = bulkText.split('\n').filter(l => l.trim()).length;

  /* ── loading state ── */
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

  const modalFromDisabled = !form.schedDate;
  const modalToDisabled = !form.schedDate;
  const modalSlots = form.schedDate ? getFilteredSlots(form.schedDate, editingId) : [];
  const modalToSlotList = getToSlots(form.schedTimeFrom, form.schedDate, editingId);

  return (
    <div>
      <div className="page-header">
        <div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowBulk(v => !v)}>+ Bulk Add</button>
        </div>
      </div>

      {/* Bulk Add */}
      {showBulk && (
        <div className="glass-card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--secondary)' }}>&#9889; Bulk Quick Capture</div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>Enter one task per line. All will be added as Medium priority to Someday List.</p>
          <textarea className="form-textarea" rows={4} value={bulkText} onChange={e => setBulkText(e.target.value)}
            placeholder={"Call Rahul about CCTV project\nReview quarterly projections\nSend invoice to TechServ"} style={{ width: '100%', border: '2px dashed var(--accent)' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={saveBulkTasks}>&#10003; Add All Tasks</button>
            <button className="btn btn-outline btn-sm" onClick={() => setShowBulk(false)}>Cancel</button>
            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{bulkCount} tasks to add</span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {[
          { key: 'today', label: 'Today', count: todayCount, color: '#0D6E6E', bg: '#E6F4F4', icon: '📅' },
          { key: 'tomorrow', label: 'Tomorrow', count: tomorrowCount, color: '#7C3AED', bg: '#F3EFFE', icon: '🗓️' },
          { key: 'upcoming', label: 'Upcoming', count: upcomingCount, color: '#D97706', bg: '#FEF3C7', icon: '🔮' },
          { key: 'notscheduled', label: 'Not Scheduled', count: notScheduledCount, color: '#DC2626', bg: '#FEF2F2', icon: '⏳' },
        ].map(card => (
          <div key={card.key} onClick={() => setFilterDate(f => f === card.key ? '' : card.key)}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
              background: filterDate === card.key ? card.color : card.bg,
              border: `2px solid ${filterDate === card.key ? card.color : 'transparent'}`,
              transition: 'all 0.2s', boxShadow: filterDate === card.key ? `0 4px 14px ${card.color}40` : '0 1px 4px rgba(0,0,0,0.07)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
            <span style={{ fontSize: 22 }}>{card.icon}</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: filterDate === card.key ? '#fff' : card.color }}>{card.count}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: filterDate === card.key ? 'rgba(255,255,255,0.85)' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input type="text" className="form-input" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 220 }} />
        <select className="form-select" value={filterSendTo} onChange={e => setFilterSendTo(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="">All Routes</option><option value="Someday List">Someday List</option><option value="Information System">Information System</option>
        </select>
        <select className="form-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ maxWidth: 140 }}>
          <option value="">All Priority</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
        </select>
        <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="">All Status</option><option value="Scheduled">Scheduled</option><option value="Waiting">Waiting</option><option value="Completed">Completed</option>
        </select>
        {(search || filterSendTo || filterPriority || filterStatus || filterDate) && (
          <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setFilterSendTo(''); setFilterPriority(''); setFilterStatus(''); setFilterDate(''); }}
            style={{ marginLeft: 4, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
            ✕ Clear Filter
          </button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{filtered.length} tasks</div>
      </div>

      {/* ── Split filtered into active vs completed ── */}
      {(() => {
        const activeRows = filtered.filter(r => r.slStatus !== 'Completed');
        const completedRows = filtered.filter(r => r.slStatus === 'Completed');

        // shared sticky action th style
        const stickyTh = {
          minWidth: 60, width: 60,
          position: 'sticky', right: 0, zIndex: 3,
          background: '#1a5f5f', boxShadow: '-2px 0 6px rgba(0,0,0,0.12)',
        };
        const stickyTd = (bg = '#fff') => ({
          textAlign: 'center', position: 'sticky', right: 0, zIndex: 1,
          background: bg, boxShadow: '-2px 0 5px rgba(0,0,0,0.07)',
        });

        // shared table header
        const TableHead = ({ showCheck = true }) => (
          <thead>
            <tr>
              {showCheck && <th style={{ minWidth: 28, width: 28 }}><input type="checkbox" className="ss-check" onChange={e => toggleSelectAll(e.target.checked)} /></th>}
              <th style={{ minWidth: 28, width: 28 }}>#</th>
              <th style={{ minWidth: 130, width: 130 }}>Created</th>
              <th style={{ minWidth: 200 }}>Description</th>
              <th style={{ minWidth: 80, width: 80 }}>Priority</th>
              <th style={{ minWidth: 115, width: 115 }}>Schedule Date</th>
              <th style={{ minWidth: 100, width: 100 }}>Deadline</th>
              <th style={{ minWidth: 115, width: 115 }}>Send To</th>
              <th style={{ minWidth: 90, width: 90 }}>Batch</th>
              <th style={{ minWidth: 85, width: 85 }}>SL Status</th>
              <th style={{ minWidth: 100, width: 100 }}>From</th>
              <th style={{ minWidth: 100, width: 100 }}>To</th>
              <th style={{ minWidth: 75, width: 75 }}>Duration</th>
              <th style={{ minWidth: 110, width: 110 }}>Created By</th>
              <th style={{ minWidth: 110, width: 110 }}>Notes</th>
              <th style={stickyTh}>Actions</th>
            </tr>
          </thead>
        );

        return (
          <>
          {/* ══ GRID 1 — Active Tasks ══════════════════════════════ */}
          <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid #e0e8f0', marginBottom: 20 }}>
            {/* toolbar */}
            <div className="ss-toolbar">
              <div className="ss-toolbar-left">
                <input type="checkbox" className="ss-check" onChange={e => toggleSelectAll(e.target.checked)} checked={selected.size > 0 && selected.size === filtered.filter(r => r.slStatus !== 'Completed').length} />
                <button className={'ss-del-btn' + (selected.size > 0 ? ' active' : '')} onClick={requestDeleteSelected} disabled={selected.size === 0}>&#10005; Delete</button>
                {selected.size > 0 && (
                  <button style={{
                    padding: '6px 14px', fontSize: 11, fontWeight: 600, border: '1.5px solid var(--info)',
                    color: 'var(--info)', background: 'var(--info-bg)', borderRadius: 8, cursor: 'pointer',
                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                    onMouseOver={e => { e.currentTarget.style.background = 'var(--info)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'var(--info-bg)'; e.currentTarget.style.color = 'var(--info)'; }}
                    onClick={bulkSendToInfoSystem}
                  >&#8594; Send to Info System</button>
                )}
                {selected.size > 0 && <span className="ss-sel-count">{selected.size} selected</span>}
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#0369a1', background: '#e0f2fe', borderRadius: 20, padding: '2px 12px' }}>
                  📋 Active — {activeRows.length} task{activeRows.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '55vh', overflowY: 'auto' }}>
              <table className="ss-table">
                <TableHead showCheck={true} />
                <tbody ref={tbodyRef} onKeyDown={handleKeyDown}>
                  {activeRows.length === 0 ? (
                    <tr><td colSpan={16} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                      {rows.length === 0 ? <>&#9889; No tasks captured yet. Click "Bulk Add" to get started!</> : 'No active tasks match your filters.'}
                    </td></tr>
                  ) : activeRows.map((row, idx) => {
                    const isVirtual = !!row._isVirtualRecurring;
                    const hasSchedDate = !!row.schedDate;
                    const fromSlots = hasSchedDate && !isVirtual ? getFilteredSlots(row.schedDate, row.id) : [];
                    const toSlotList = !isVirtual ? getToSlots(row.schedTimeFrom, row.schedDate, row.id) : [];
                    const hasRecurConflict = !isVirtual && recurringConflicts.has(row.id);

                    return (
                      <tr key={row.id}
                        style={isVirtual ? { background: 'rgba(99,102,241,0.06)', opacity: 0.85 } : undefined}
                      >
                        <td data-row={idx} data-col={0} style={{ textAlign: 'center' }}>
                          {!isVirtual && <input type="checkbox" className="ss-check" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} />}
                        </td>
                        <td data-row={idx} data-col={1} className="ss-num">
                          {isVirtual ? <span title="Recurring task" style={{fontSize:11}}>🔄</span> : idx + 1}
                          {hasRecurConflict && <span title="Conflicts with a recurring task" style={{ color: '#f59e0b', marginLeft: 4, cursor: 'help', fontSize: 13 }}>&#9888;</span>}
                        </td>
                        <td data-row={idx} data-col={2} style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {isVirtual
                            ? <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600, background: 'rgba(99,102,241,0.1)', padding: '2px 6px', borderRadius: 6 }}>{row._recurFreq || 'Recurring'}</span>
                            : formatCreated(row.date, row.time)
                          }
                        </td>
                        <td data-row={idx} data-col={3} style={{ height: 'auto', verticalAlign: 'top', padding: isVirtual ? '6px 8px' : 0 }}>
                          {isVirtual
                            ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{row.description}</span>
                            : <textarea className="ss-cell ss-desc-cell" defaultValue={row.description} title={row.description} rows={1}
                                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                onBlur={e => { if (e.target.value !== row.description) handleCellChange(row.id, 'description', e.target.value); }} />
                          }
                        </td>
                        <td data-row={idx} data-col={4}>
                          {isVirtual
                            ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>{row.priority}</span>
                            : <select className="ss-cell" value={row.priority || ''} onChange={e => handleCellChange(row.id, 'priority', e.target.value)}>
                                <option value="">-</option>
                                {(masters?.priority || ['High','Medium','Low']).map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                          }
                        </td>
                        <td data-row={idx} data-col={5}>
                          {isVirtual
                            ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>{row.schedDate}</span>
                            : <input type="date" className="ss-cell ss-date-only" value={row.schedDate || ''} onChange={e => handleCellChange(row.id, 'schedDate', e.target.value)} />
                          }
                        </td>
                        <td data-row={idx} data-col={6}>
                          {isVirtual
                            ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>-</span>
                            : <input type="date" className="ss-cell ss-date-only" value={row.deadline || ''} onChange={e => handleCellChange(row.id, 'deadline', e.target.value)} />
                          }
                        </td>
                        <td data-row={idx} data-col={7}>
                          {isVirtual
                            ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>{row.sendTo}</span>
                            : <select className="ss-cell" value={row.sendTo || ''} onChange={e => handleCellChange(row.id, 'sendTo', e.target.value)}>
                                <option value="Someday List">Someday List</option><option value="Information System">Information System</option>
                              </select>
                          }
                        </td>
                        <td data-row={idx} data-col={8}>
                          {isVirtual
                            ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>{row.batchType || '-'}</span>
                            : <select className="ss-cell" value={row.batchType || ''} onChange={e => handleCellChange(row.id, 'batchType', e.target.value)}>
                                <option value="">-</option>
                                {(masters?.batchType || []).map(b => <option key={b} value={b}>{b}</option>)}
                              </select>
                          }
                        </td>
                        <td data-row={idx} data-col={9}>
                          {isVirtual
                            ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>{row.slStatus}</span>
                            : <select className="ss-cell" value={row.slStatus || ''} onChange={e => handleCellChange(row.id, 'slStatus', e.target.value)}>
                                {(masters?.schedStatus || ['Scheduled','Waiting','Completed','Skipped']).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                          }
                        </td>
                        <td data-row={idx} data-col={10}>
                          {isVirtual
                            ? <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>{row.schedTimeFrom || '-'}</span>
                            : <select className="ss-cell" value={row.schedTimeFrom || ''} disabled={!hasSchedDate}
                                style={!hasSchedDate ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                                onChange={e => handleCellChange(row.id, 'schedTimeFrom', e.target.value)}>
                                <option value="">-</option>
                                {fromSlots.map(s => <option key={s.slot} value={s.slot} disabled={s.disabled}>{s.label}</option>)}
                              </select>
                          }
                        </td>
                        <td data-row={idx} data-col={11}>
                          {isVirtual
                            ? <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>{row.schedTimeTo || '-'}</span>
                            : <select className="ss-cell" value={row.schedTimeTo || ''} disabled={!hasSchedDate}
                                style={!hasSchedDate ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                                onChange={e => handleCellChange(row.id, 'schedTimeTo', e.target.value)}>
                                <option value="">-</option>
                                {Array.isArray(toSlotList) && toSlotList.length > 0 && typeof toSlotList[0] === 'object'
                                  ? toSlotList.map(s => <option key={s.slot} value={s.slot} disabled={s.disabled}>{s.label}</option>)
                                  : (toSlotList || []).map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                          }
                        </td>
                        <td data-row={idx} data-col={12} style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, padding: '0 8px', whiteSpace: 'nowrap' }}>
                          {calcDuration(row.schedTimeFrom, row.schedTimeTo)}
                        </td>
                        <td data-row={idx} data-col={13} style={{ fontSize: 11, color: 'var(--muted)', padding: '0 8px', whiteSpace: 'nowrap' }}>
                          {row.createdBy || '-'}
                        </td>
                        <td data-row={idx} data-col={14}>
                          {isVirtual
                            ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>-</span>
                            : <input className="ss-cell" defaultValue={row.notes || ''}
                                onBlur={e => { if (e.target.value !== (row.notes || '')) handleCellChange(row.id, 'notes', e.target.value); }} />
                          }
                        </td>
                        <td data-row={idx} data-col={15} style={stickyTd('#fff')}>
                          {!isVirtual && <button className="ss-del" title="Delete" onClick={() => setDeleteId(row.id)}>&#10005;</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ══ GRID 2 — Completed Tasks (read-only) ══════════════ */}
          {completedRows.length > 0 && (
            <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid #a7f3d0' }}>
              {/* header */}
              <div style={{
                padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
                background: 'linear-gradient(90deg, #d1fae5 0%, #ecfdf5 100%)',
                borderBottom: '1px solid #a7f3d0',
              }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#065f46' }}>Completed Tasks</div>
                  <div style={{ fontSize: 10, color: '#059669' }}>Tasks marked as done — read only view</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#fff', background: '#10b981', borderRadius: 20, padding: '3px 14px' }}>
                  {completedRows.length} completed
                </span>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: '40vh', overflowY: 'auto' }}>
                <table className="ss-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 28, width: 28 }}>#</th>
                      <th style={{ minWidth: 130, width: 130 }}>Completed On</th>
                      <th style={{ minWidth: 220 }}>Description</th>
                      <th style={{ minWidth: 80, width: 80 }}>Priority</th>
                      <th style={{ minWidth: 115, width: 115 }}>Schedule Date</th>
                      <th style={{ minWidth: 115, width: 115 }}>Send To</th>
                      <th style={{ minWidth: 90, width: 90 }}>Batch</th>
                      <th style={{ minWidth: 100, width: 100 }}>From</th>
                      <th style={{ minWidth: 100, width: 100 }}>To</th>
                      <th style={{ minWidth: 75, width: 75 }}>Duration</th>
                      <th style={{ minWidth: 110, width: 110 }}>Created By</th>
                      <th style={{ minWidth: 130, width: 130 }}>Notes</th>
                      <th style={{ ...stickyTh, background: '#065f46' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedRows.map((row, idx) => (
                      <tr key={row.id} style={{ background: 'rgba(16,185,129,0.04)' }}>
                        <td style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{formatCreated(row.date, row.time)}</td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', textDecoration: 'line-through', opacity: 0.75 }}>
                            {row.description}
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: '#10b981', padding: '1px 7px', borderRadius: 8, display: 'inline-block', marginTop: 2 }}>Done</span>
                        </td>
                        <td><span className={`badge badge-${(row.priority||'low').toLowerCase()}`}>{row.priority||'Low'}</span></td>
                        <td style={{ fontSize: 11, color: '#6b7280' }}>{row.schedDate || '-'}</td>
                        <td style={{ fontSize: 11, color: '#6b7280' }}>{row.sendTo || '-'}</td>
                        <td style={{ fontSize: 11, color: '#6b7280' }}>{row.batchType || '-'}</td>
                        <td style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>{row.schedTimeFrom || '-'}</td>
                        <td style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>{row.schedTimeTo || '-'}</td>
                        <td style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>{calcDuration(row.schedTimeFrom, row.schedTimeTo)}</td>
                        <td style={{ fontSize: 11, color: '#6b7280' }}>{row.createdBy || '-'}</td>
                        <td style={{ fontSize: 11, color: '#6b7280' }}>{row.notes || '-'}</td>
                        <td style={stickyTd('#f0fdf4')}>
                          <button className="ss-del" title="Delete" onClick={() => setDeleteId(row.id)} style={{ color: '#dc2626' }}>&#10005;</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </>
        );
      })()}

      {/* Add/Edit Task Modal */}
      <div className={'modal-overlay' + (modalOpen ? ' show' : '')} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
        <div className="modal">
          <div className="modal-header">
            <h3>{editingId ? 'Edit Task' : 'Add New Task'}</h3>
            <button className="modal-close" onClick={closeModal}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Task Description *</label>
              <input type="text" className="form-input" value={form.description} onChange={e => handleFormChange('description', e.target.value)} placeholder="Enter task description" autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={form.priority} onChange={e => handleFormChange('priority', e.target.value)}>
                  {(masters?.priority || ['High','Medium','Low']).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Batch Type</label>
                <select className="form-select" value={form.batchType} onChange={e => handleFormChange('batchType', e.target.value)}>
                  <option value="">Select...</option>
                  {(masters?.batchType || []).map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Send To</label>
                <select className="form-select" value={form.sendTo} onChange={e => handleFormChange('sendTo', e.target.value)}>
                  <option value="Someday List">Someday List</option><option value="Information System">Information System</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">SL Status</label>
                <select className="form-select" value={form.slStatus} onChange={e => handleFormChange('slStatus', e.target.value)}>
                  {(masters?.schedStatus || ['Scheduled','Waiting','Completed','Skipped']).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Schedule Date</label>
                <input type="date" className="form-input" value={form.schedDate} onChange={e => handleFormChange('schedDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Time From</label>
                <select className="form-select" value={form.schedTimeFrom}
                  disabled={modalFromDisabled}
                  style={modalFromDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                  onChange={e => handleFormChange('schedTimeFrom', e.target.value)}>
                  <option value="">Select slot...</option>
                  {modalSlots.map(s => (
                    <option key={s.slot} value={s.slot} disabled={s.disabled}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Time To</label>
                <select className="form-select" value={form.schedTimeTo}
                  disabled={modalToDisabled}
                  style={modalToDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                  onChange={e => handleFormChange('schedTimeTo', e.target.value)}>
                  <option value="">Select slot...</option>
                  {Array.isArray(modalToSlotList) && modalToSlotList.length > 0 && typeof modalToSlotList[0] === 'object'
                    ? modalToSlotList.map(s => <option key={s.slot} value={s.slot} disabled={s.disabled}>{s.label}</option>)
                    : (modalToSlotList || []).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {slotConflict && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, marginBottom: 12, border: '1px solid var(--danger)' }}>
                &#9888; {slotConflict}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Deadline</label>
              <input type="date" className="form-input" value={form.deadline} onChange={e => handleFormChange('deadline', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => handleFormChange('notes', e.target.value)} rows={3} placeholder="Additional notes..." />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!!slotConflict}>{editingId ? 'Update' : 'Add Task'}</button>
          </div>
        </div>
      </div>

      {/* Single Delete Confirmation */}
      <div className={'modal-overlay' + (deleteId ? ' show' : '')} onClick={e => { if (e.target === e.currentTarget) setDeleteId(null); }}>
        <div className="modal" style={{ maxWidth: 440 }}>
          <div className="modal-header">
            <h3>Confirm Delete</h3>
            <button className="modal-close" onClick={() => setDeleteId(null)}>&times;</button>
          </div>
          <div className="modal-body">
            {(() => {
              const task = rows.find(r => r.id === deleteId);
              if (!task) return <p>Are you sure you want to delete this task?</p>;
              const isScheduled = task.schedDate && task.schedTimeFrom;
              return (
                <div>
                  {isScheduled && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#DC2626', marginBottom: 4 }}>&#9888; Scheduled Task</div>
                      <div style={{ fontSize: 11, color: '#7F1D1D' }}>This task is scheduled for <strong>{task.schedDate}</strong> at <strong>{task.schedTimeFrom}</strong>. Deleting it will remove it from the daily schedule.</div>
                    </div>
                  )}
                  <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{task.description}</div>
                    {task.schedDate && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Date: {task.schedDate} {task.schedTimeFrom ? '| Time: ' + task.schedTimeFrom + (task.schedTimeTo ? ' - ' + task.schedTimeTo : '') : ''}</div>}
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Priority: {task.priority} | Send To: {task.sendTo}</div>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>Are you sure you want to delete this task? This cannot be undone.</p>
                </div>
              );
            })()}
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setDeleteId(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Delete Task</button>
          </div>
        </div>
      </div>

      {/* Bulk Delete Confirmation */}
      <div className={'modal-overlay' + (bulkDeleteConfirm ? ' show' : '')} onClick={e => { if (e.target === e.currentTarget) setBulkDeleteConfirm(null); }}>
        <div className="modal" style={{ maxWidth: 520 }}>
          <div className="modal-header">
            <h3>Delete {bulkDeleteConfirm?.all?.length || 0} Tasks</h3>
            <button className="modal-close" onClick={() => setBulkDeleteConfirm(null)}>&times;</button>
          </div>
          <div className="modal-body">
            {bulkDeleteConfirm?.scheduled?.length > 0 && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#DC2626', marginBottom: 8 }}>&#9888; Warning: {bulkDeleteConfirm.scheduled.length} scheduled task{bulkDeleteConfirm.scheduled.length > 1 ? 's' : ''} will be deleted</div>
                <div style={{ fontSize: 11, color: '#7F1D1D', marginBottom: 8 }}>The following tasks have scheduled dates/times and will be removed from the daily schedule:</div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {bulkDeleteConfirm.scheduled.map((t, i) => (
                    <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: i < bulkDeleteConfirm.scheduled.length - 1 ? '1px solid #FECACA' : 'none' }}>
                      <span style={{ background: '#DC2626', color: 'white', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{t.schedDate}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#7F1D1D' }}>{t.description}</span>
                      {t.schedTimeFrom && <span style={{ fontSize: 10, color: '#991B1B', marginLeft: 'auto', flexShrink: 0 }}>{t.schedTimeFrom}{t.schedTimeTo ? ' - ' + t.schedTimeTo : ''}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {bulkDeleteConfirm && bulkDeleteConfirm.all.length > (bulkDeleteConfirm.scheduled?.length || 0) && (
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {bulkDeleteConfirm.all.length - (bulkDeleteConfirm.scheduled?.length || 0)} unscheduled task{bulkDeleteConfirm.all.length - (bulkDeleteConfirm.scheduled?.length || 0) > 1 ? 's' : ''} will also be deleted.
                </div>
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>This action cannot be undone. Are you sure?</p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setBulkDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={confirmBulkDelete}>Delete {bulkDeleteConfirm?.all?.length || 0} Tasks</button>
          </div>
        </div>
      </div>
    </div>
  );
}
