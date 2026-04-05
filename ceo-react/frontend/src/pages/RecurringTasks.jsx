import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api';
import { useApp } from '../App';

const STATUS_FILTERS = ['Active', 'Paused', 'Stopped', 'All'];
const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Yearly', 'Fixed Date'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEK_POSITIONS = ['First', 'Second', 'Third', 'Fourth', 'Last'];
const TASK_STATUSES = ['Active', 'Paused', 'Stopped'];

const EMPTY_FORM = {
  task: '',
  priority: 'Medium',
  batchType: '',
  frequency: 'Daily',
  weekday: '',
  weekPosition: '',
  fixedDate: '',
  status: 'Active',
  notes: '',
  timeSlot: '',
};

function statusBadgeClass(status) {
  if (!status) return 'badge';
  const s = status.toLowerCase();
  if (s === 'active') return 'badge badge-active';
  if (s === 'paused') return 'badge badge-paused';
  if (s === 'stopped') return 'badge badge-stopped';
  return 'badge';
}

function priorityBadgeClass(priority) {
  if (!priority) return 'badge badge-low';
  const p = priority.toLowerCase();
  if (p === 'high' || p === 'h') return 'badge badge-high';
  if (p === 'medium' || p === 'med' || p === 'm') return 'badge badge-medium';
  return 'badge badge-low';
}

function showWeekday(freq) {
  return freq === 'Weekly' || freq === 'Monthly';
}

function showWeekPosition(freq) {
  return freq === 'Monthly';
}

function showFixedDate(freq) {
  return freq === 'Yearly' || freq === 'Fixed Date';
}

export default function RecurringTasks() {
  const { showToast } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = add, object = edit
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [masters, setMasters] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getRecurringTasks();
      if (res.success) {
        setRows(res.rows || []);
      } else {
        showToast('Failed to load recurring tasks', 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
    api.getMasters().then(res => {
      if (res.success || res.data) setMasters(res.data || res);
    }).catch(() => {});
  }, [loadData]);

  const filteredRows = useMemo(() => {
    if (filter === 'All') return rows;
    return rows.filter(r => (r.status || '').toLowerCase() === filter.toLowerCase());
  }, [rows, filter]);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      task: row.task || row.name || '',
      priority: row.priority || 'Medium',
      batchType: row.batchType || '',
      frequency: row.frequency || 'Daily',
      weekday: row.weekday || '',
      weekPosition: row.weekPosition || '',
      fixedDate: row.fixedDate || '',
      status: row.status || 'Active',
      notes: row.notes || '',
      timeSlot: row.timeSlot || '',
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.task.trim()) {
      showToast('Task name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      let res;
      if (editing) {
        res = await api.updateRecurring(editing.id, payload);
      } else {
        res = await api.addRecurring(payload);
      }
      if (res.success) {
        showToast(editing ? 'Task updated' : 'Task added', 'success');
        closeModal();
        loadData();
      } else {
        showToast(res.message || 'Failed to save', 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    if (!window.confirm(`Delete recurring task "${row.task || row.name}"?`)) return;
    try {
      const res = await api.deleteRecurring(row.id);
      if (res.success) {
        showToast('Task deleted', 'success');
        loadData();
      } else {
        showToast(res.message || 'Failed to delete', 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  function scheduleDetails(row) {
    const parts = [];
    if (row.frequency) parts.push(row.frequency);
    if (row.weekday) parts.push(row.weekday);
    if (row.weekPosition) parts.push(row.weekPosition);
    if (row.fixedDate) parts.push(row.fixedDate);
    return parts.join(' / ') || '-';
  }

  const priorityOptions = masters?.priorities || ['High', 'Medium', 'Low'];
  const batchTypeOptions = masters?.batchTypes || [];

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading Recurring Tasks...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Recurring Tasks</h1>
          <p className="page-subtitle">Manage tasks that repeat on a schedule</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            + Add Task
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
        <span style={{ marginLeft: 12, fontSize: 13, opacity: 0.6 }}>
          {filteredRows.length} task{filteredRows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Data Table */}
      <div className="glass-card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th style={{ width: 90 }}>Priority</th>
                <th style={{ width: 100 }}>Frequency</th>
                <th style={{ width: 160 }}>Schedule Details</th>
                <th style={{ width: 90 }}>Status</th>
                <th style={{ width: 130 }}>Next Occurrence</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, opacity: 0.5 }}>
                    No recurring tasks found
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => (
                  <tr
                    key={row.id}
                    className={row._isDue ? 'row-due' : ''}
                    style={row._isDue ? { background: 'rgba(255, 193, 7, 0.08)' } : undefined}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 500 }}>{row.task || row.name}</span>
                        {row._isDue && (
                          <span className="badge badge-high" style={{ fontSize: 10 }}>DUE</span>
                        )}
                      </div>
                      {row.notes && (
                        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{row.notes}</div>
                      )}
                    </td>
                    <td>
                      <span className={priorityBadgeClass(row.priority)}>
                        {row.priority || 'Low'}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{row.frequency || '-'}</td>
                    <td style={{ fontSize: 12 }}>{scheduleDetails(row)}</td>
                    <td>
                      <span className={statusBadgeClass(row.status)}>
                        {row.status || '-'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {row._nextOccurrence || '-'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-outline btn-xs" onClick={() => openEdit(row)}>
                          Edit
                        </button>
                        <button className="btn btn-danger btn-xs" onClick={() => handleDelete(row)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Recurring Task' : 'Add Recurring Task'}</h3>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <div className="modal-body">
              {/* Task Name */}
              <div className="form-group">
                <label className="form-label">Task Name *</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.task}
                  onChange={e => updateField('task', e.target.value)}
                  placeholder="Enter task name"
                  autoFocus
                />
              </div>

              {/* Priority + Batch Type */}
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-select"
                    value={form.priority}
                    onChange={e => updateField('priority', e.target.value)}
                  >
                    {priorityOptions.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Batch Type</label>
                  {batchTypeOptions.length > 0 ? (
                    <select
                      className="form-select"
                      value={form.batchType}
                      onChange={e => updateField('batchType', e.target.value)}
                    >
                      <option value="">-- None --</option>
                      {batchTypeOptions.map(bt => (
                        <option key={bt} value={bt}>{bt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="form-input"
                      type="text"
                      value={form.batchType}
                      onChange={e => updateField('batchType', e.target.value)}
                      placeholder="e.g. Morning, Afternoon"
                    />
                  )}
                </div>
              </div>

              {/* Frequency */}
              <div className="form-group">
                <label className="form-label">Frequency</label>
                <select
                  className="form-select"
                  value={form.frequency}
                  onChange={e => updateField('frequency', e.target.value)}
                >
                  {FREQUENCIES.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              {/* Conditional: Weekday */}
              {showWeekday(form.frequency) && (
                <div className="form-group">
                  <label className="form-label">Weekday</label>
                  <select
                    className="form-select"
                    value={form.weekday}
                    onChange={e => updateField('weekday', e.target.value)}
                  >
                    <option value="">-- Select --</option>
                    {WEEKDAYS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Conditional: Week Position */}
              {showWeekPosition(form.frequency) && (
                <div className="form-group">
                  <label className="form-label">Week Position</label>
                  <select
                    className="form-select"
                    value={form.weekPosition}
                    onChange={e => updateField('weekPosition', e.target.value)}
                  >
                    <option value="">-- Select --</option>
                    {WEEK_POSITIONS.map(wp => (
                      <option key={wp} value={wp}>{wp}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Conditional: Fixed Date */}
              {showFixedDate(form.frequency) && (
                <div className="form-group">
                  <label className="form-label">Fixed Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.fixedDate}
                    onChange={e => updateField('fixedDate', e.target.value)}
                  />
                </div>
              )}

              {/* Time Slot */}
              <div className="form-group">
                <label className="form-label">Time Slot</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.timeSlot}
                  onChange={e => updateField('timeSlot', e.target.value)}
                  placeholder="e.g. 09:00 or Morning"
                />
              </div>

              {/* Status */}
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={form.status}
                  onChange={e => updateField('status', e.target.value)}
                >
                  {TASK_STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  value={form.notes}
                  onChange={e => updateField('notes', e.target.value)}
                  placeholder="Optional notes"
                  rows={3}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Update Task' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
