import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { useApp } from '../App';

const TIME_SLOTS = [
  '7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM',
  '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM',
  '4:00 PM','4:30 PM','5:00 PM','5:30 PM','6:00 PM','6:30 PM','7:00 PM'
];

export default function QuickCapture() {
  const { showToast } = useApp();
  const [rows, setRows] = useState([]);
  const [masters, setMasters] = useState(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterSendTo, setFilterSendTo] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [selected, setSelected] = useState(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(getEmptyForm());
  const [slotConflict, setSlotConflict] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { loadData(); }, []);

  function getEmptyForm() {
    return { description: '', priority: 'Medium', batchType: '', sendTo: 'Someday List', slStatus: 'Scheduled', schedDate: '', schedTimeFrom: '', schedTimeTo: '', deadline: '', notes: '' };
  }

  async function loadData() {
    setLoading(true);
    try {
      const [captureRes, mastersRes] = await Promise.all([api.getQuickCapture(), api.getMasters()]);
      if (captureRes.success) setRows(captureRes.rows || []);
      if (mastersRes.success) setMasters(mastersRes.masters);
    } catch { showToast('Error loading data', 'error'); }
    setLoading(false);
  }

  // Build booked slots map: { "2026-04-05|9:00 AM": taskId }
  const bookedSlots = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      if (r.schedDate && r.schedTimeFrom) {
        const key = r.schedDate + '|' + r.schedTimeFrom;
        map[key] = r.id;
      }
    });
    return map;
  }, [rows]);

  // Check slot conflict when date or timeFrom changes
  function checkSlotConflict(date, timeFrom, currentId) {
    if (!date || !timeFrom) { setSlotConflict(''); return false; }
    const key = date + '|' + timeFrom;
    const existingId = bookedSlots[key];
    if (existingId && existingId !== currentId) {
      const existing = rows.find(r => r.id === existingId);
      setSlotConflict(`Slot already booked: "${existing?.description || 'Task #' + existingId}" is scheduled at ${timeFrom} on ${date}`);
      return true;
    }
    setSlotConflict('');
    return false;
  }

  // Get available "To" slots based on selected "From"
  function getToSlots(fromSlot) {
    if (!fromSlot) return TIME_SLOTS;
    const fromIdx = TIME_SLOTS.indexOf(fromSlot);
    if (fromIdx < 0) return TIME_SLOTS;
    return TIME_SLOTS.slice(fromIdx + 1);
  }

  const filtered = rows.filter(r => {
    if (search && !(r.description || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSendTo && r.sendTo !== filterSendTo) return false;
    if (filterPriority && r.priority !== filterPriority) return false;
    if (filterStatus && r.slStatus !== filterStatus) return false;
    return true;
  });

  async function handleCellChange(id, field, value) {
    // Check slot conflict for time changes
    if (field === 'schedTimeFrom' || field === 'schedDate') {
      const row = rows.find(r => r.id === id);
      const date = field === 'schedDate' ? value : (row?.schedDate || '');
      const time = field === 'schedTimeFrom' ? value : (row?.schedTimeFrom || '');
      if (date && time) {
        const key = date + '|' + time;
        const existingId = bookedSlots[key];
        if (existingId && existingId !== id) {
          const existing = rows.find(r => r.id === existingId);
          showToast(`Slot already booked by "${existing?.description}"`, 'warning');
          return;
        }
      }
    }
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    try { await api.updateTask(id, { [field]: value }); } catch { showToast('Failed to save', 'error'); }
  }

  function openAddModal() {
    setEditingId(null);
    setForm(getEmptyForm());
    setSlotConflict('');
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditingId(null); setSlotConflict(''); }

  function handleFormChange(field, value) {
    const updated = { ...form, [field]: value };
    setForm(updated);
    // Auto-check slot conflict
    if (field === 'schedDate' || field === 'schedTimeFrom') {
      checkSlotConflict(
        field === 'schedDate' ? value : form.schedDate,
        field === 'schedTimeFrom' ? value : form.schedTimeFrom,
        editingId
      );
    }
    // Auto-set To slot to next 30 min after From
    if (field === 'schedTimeFrom' && value) {
      const fromIdx = TIME_SLOTS.indexOf(value);
      if (fromIdx >= 0 && fromIdx < TIME_SLOTS.length - 1) {
        updated.schedTimeTo = TIME_SLOTS[fromIdx + 1];
        setForm(updated);
      }
    }
  }

  async function handleSave() {
    if (!form.description.trim()) { showToast('Task description is required', 'warning'); return; }
    // Final slot conflict check
    if (form.schedDate && form.schedTimeFrom) {
      const hasConflict = checkSlotConflict(form.schedDate, form.schedTimeFrom, editingId);
      if (hasConflict) { showToast('Cannot save - time slot already booked!', 'error'); return; }
    }
    try {
      const res = editingId ? await api.updateTask(editingId, form) : await api.addTask(form);
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
    for (const line of lines) {
      try {
        const res = await api.addTask({ description: line, priority: 'Medium', sendTo: 'Someday List', slStatus: 'Scheduled' });
        if (res.success) added++;
      } catch {}
    }
    showToast(`${added} tasks added`, 'success');
    setBulkText(''); setShowBulk(false); loadData();
  }

  function toggleSelect(id) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleSelectAll(checked) { setSelected(checked ? new Set(filtered.map(r => r.id)) : new Set()); }
  async function deleteSelected() {
    for (const id of selected) { try { await api.deleteTask(id); } catch {} }
    showToast(`${selected.size} tasks deleted`, 'success'); setSelected(new Set()); loadData();
  }

  const bulkCount = bulkText.split('\n').filter(l => l.trim()).length;

  if (loading) {
    return (
      <div>
        <div className="page-header"><div><h2>Quick Capture</h2><p>Capture tasks quickly</p></div></div>
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Quick Capture</h2><p>Capture tasks quickly &mdash; click any cell to edit inline</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setShowBulk(v => !v)}>+ Bulk Add</button>
          <button className="btn btn-primary btn-sm" onClick={openAddModal}>+ Add Task</button>
        </div>
      </div>

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
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{filtered.length} tasks</div>
      </div>

      {/* Spreadsheet Table */}
      <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid #e0e8f0' }}>
        <div className="ss-toolbar">
          <div className="ss-toolbar-left">
            <input type="checkbox" className="ss-check" onChange={e => toggleSelectAll(e.target.checked)} checked={selected.size > 0 && selected.size === filtered.length} />
            <button className={`ss-del-btn${selected.size > 0 ? ' active' : ''}`} onClick={deleteSelected} disabled={selected.size === 0}>&#10005; Delete</button>
            {selected.size > 0 && <span className="ss-sel-count">{selected.size} selected</span>}
          </div>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
          <table className="ss-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}><input type="checkbox" className="ss-check" onChange={e => toggleSelectAll(e.target.checked)} /></th>
                <th style={{ width: 28 }}>#</th>
                <th style={{ minWidth: 200 }}>Description</th>
                <th style={{ width: 80 }}>Priority</th>
                <th style={{ width: 95 }}>Sched Date</th>
                <th style={{ width: 95 }}>Deadline</th>
                <th style={{ width: 115 }}>Send To</th>
                <th style={{ width: 95 }}>Batch</th>
                <th style={{ width: 85 }}>SL Status</th>
                <th style={{ width: 100 }}>From</th>
                <th style={{ width: 100 }}>To</th>
                <th style={{ width: 120 }}>Notes</th>
                <th style={{ width: 50 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={13} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                  {rows.length === 0 ? <>&#9889; No tasks captured yet. Click "Bulk Add" or "Add Task" to get started!</> : 'No tasks match your filters.'}
                </td></tr>
              ) : filtered.map((row, idx) => (
                <tr key={row.id} className={row.slStatus === 'Completed' ? 'ss-row-done' : ''}>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" className="ss-check" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} /></td>
                  <td className="ss-num">{idx + 1}</td>
                  <td><input className="ss-cell" defaultValue={row.description} onBlur={e => { if (e.target.value !== row.description) handleCellChange(row.id, 'description', e.target.value); }} /></td>
                  <td>
                    <select className="ss-cell" value={row.priority || ''} onChange={e => handleCellChange(row.id, 'priority', e.target.value)}>
                      <option value="">-</option>
                      {(masters?.priority || ['High','Medium','Low']).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td><input type="date" className="ss-cell ss-date-only" value={row.schedDate || ''} onChange={e => handleCellChange(row.id, 'schedDate', e.target.value)} /></td>
                  <td><input type="date" className="ss-cell ss-date-only" value={row.deadline || ''} onChange={e => handleCellChange(row.id, 'deadline', e.target.value)} /></td>
                  <td>
                    <select className="ss-cell" value={row.sendTo || ''} onChange={e => handleCellChange(row.id, 'sendTo', e.target.value)}>
                      <option value="Someday List">Someday List</option><option value="Information System">Information System</option>
                    </select>
                  </td>
                  <td>
                    <select className="ss-cell" value={row.batchType || ''} onChange={e => handleCellChange(row.id, 'batchType', e.target.value)}>
                      <option value="">-</option>
                      {(masters?.batchType || []).map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="ss-cell" value={row.slStatus || ''} onChange={e => handleCellChange(row.id, 'slStatus', e.target.value)}>
                      {(masters?.schedStatus || ['Scheduled','Waiting','Completed','Skipped']).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="ss-cell" value={row.schedTimeFrom || ''} onChange={e => handleCellChange(row.id, 'schedTimeFrom', e.target.value)}>
                      <option value="">-</option>
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="ss-cell" value={row.schedTimeTo || ''} onChange={e => handleCellChange(row.id, 'schedTimeTo', e.target.value)}>
                      <option value="">-</option>
                      {getToSlots(row.schedTimeFrom).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td><input className="ss-cell" defaultValue={row.notes || ''} onBlur={e => { if (e.target.value !== (row.notes||'')) handleCellChange(row.id, 'notes', e.target.value); }} /></td>
                  <td style={{ textAlign: 'center' }}><button className="ss-del" title="Delete" onClick={() => setDeleteId(row.id)}>&#10005;</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Task Modal */}
      <div className={`modal-overlay${modalOpen ? ' show' : ''}`} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
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
                <label className="form-label">Sched Date</label>
                <input type="date" className="form-input" value={form.schedDate} onChange={e => handleFormChange('schedDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Time From</label>
                <select className="form-select" value={form.schedTimeFrom} onChange={e => handleFormChange('schedTimeFrom', e.target.value)}>
                  <option value="">Select slot...</option>
                  {TIME_SLOTS.map(t => {
                    const isBooked = form.schedDate && bookedSlots[form.schedDate + '|' + t] && bookedSlots[form.schedDate + '|' + t] !== editingId;
                    return <option key={t} value={t} disabled={isBooked}>{t}{isBooked ? ' (Booked)' : ''}</option>;
                  })}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Time To</label>
                <select className="form-select" value={form.schedTimeTo} onChange={e => handleFormChange('schedTimeTo', e.target.value)}>
                  <option value="">Select slot...</option>
                  {getToSlots(form.schedTimeFrom).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {/* Slot conflict warning */}
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

      {/* Delete Confirmation */}
      <div className={`modal-overlay${deleteId ? ' show' : ''}`} onClick={e => { if (e.target === e.currentTarget) setDeleteId(null); }}>
        <div className="modal" style={{ maxWidth: 400 }}>
          <div className="modal-header">
            <h3>Confirm Delete</h3>
            <button className="modal-close" onClick={() => setDeleteId(null)}>&times;</button>
          </div>
          <div className="modal-body"><p>Are you sure you want to delete this task? This action cannot be undone.</p></div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setDeleteId(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}
