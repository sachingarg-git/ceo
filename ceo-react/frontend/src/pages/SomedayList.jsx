import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api';
import { useApp } from '../App';

const STATUS_FILTERS = ['All', 'Scheduled', 'Waiting', 'Completed'];

function priorityBadgeClass(priority) {
  if (!priority) return 'badge badge-low';
  const p = priority.toLowerCase();
  if (p === 'high' || p === 'h') return 'badge badge-high';
  if (p === 'medium' || p === 'med' || p === 'm') return 'badge badge-medium';
  return 'badge badge-low';
}

function statusBadgeClass(status) {
  if (!status) return 'badge';
  const s = status.toLowerCase();
  if (s.includes('scheduled') || s.includes('sch')) return 'badge badge-scheduled';
  if (s.includes('waiting') || s.includes('wait')) return 'badge badge-waiting';
  if (s.includes('completed') || s.includes('done')) return 'badge badge-completed';
  return 'badge';
}

function matchesFilter(task, filter) {
  if (filter === 'All') return true;
  const status = (task.finalStatus || task.baseStatus || '').toLowerCase();
  if (filter === 'Scheduled') return status.includes('scheduled') || status.includes('sch');
  if (filter === 'Waiting') return status.includes('waiting') || status.includes('wait');
  if (filter === 'Completed') return status.includes('completed') || status.includes('done');
  return true;
}

function formatDate(val) {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return val;
  }
}

function formatDateTime(val) {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return val;
  }
}

/**
 * Extract just the time portion from a timeKey like "2026-04-07|7:00 AM"
 * or return schedTimeTo if available, otherwise return the raw value.
 */
function formatTimeTo(task) {
  // Prefer schedTimeTo if it exists and is a plain time string
  if (task.schedTimeTo) {
    // If schedTimeTo itself contains a pipe (date|time), extract time part
    if (typeof task.schedTimeTo === 'string' && task.schedTimeTo.includes('|')) {
      return task.schedTimeTo.split('|')[1]?.trim() || task.schedTimeTo;
    }
    return task.schedTimeTo;
  }
  // Fall back to timeKey, extracting time after pipe
  if (task.timeKey) {
    if (typeof task.timeKey === 'string' && task.timeKey.includes('|')) {
      return task.timeKey.split('|')[1]?.trim() || task.timeKey;
    }
    return task.timeKey;
  }
  return '-';
}

/** Build a set of "date|timeSlot" keys from QC tasks for conflict detection */
function buildQcSlotMap(qcTasks) {
  const map = {};
  if (!qcTasks) return map;
  qcTasks.forEach(t => {
    if (t.schedDate && t.schedTimeFrom) {
      const dateKey = typeof t.schedDate === 'string' ? t.schedDate.split('T')[0] : t.schedDate;
      map[dateKey + '|' + t.schedTimeFrom] = t.description || t.task || 'QC Task';
    }
  });
  return map;
}

/** Check if an RT task conflicts with any QC task on the same date/time */
function hasConflict(task, qcSlotMap) {
  if (task.source !== 'RT') return false;
  if (!task.schedDate || !task.schedTime) return false;
  const dateKey = typeof task.schedDate === 'string' ? task.schedDate.split('T')[0] : task.schedDate;
  const key = dateKey + '|' + task.schedTime;
  return !!qcSlotMap[key];
}

function getConflictInfo(task, qcSlotMap) {
  if (task.source !== 'RT') return null;
  if (!task.schedDate || !task.schedTime) return null;
  const dateKey = typeof task.schedDate === 'string' ? task.schedDate.split('T')[0] : task.schedDate;
  const key = dateKey + '|' + task.schedTime;
  return qcSlotMap[key] || null;
}

export default function SomedayList() {
  const { showToast } = useApp();
  const [data, setData] = useState(null);
  const [qcTasks, setQcTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [markingDone, setMarkingDone] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [slRes, qcRes] = await Promise.all([
        api.getSomedayList(),
        api.getQuickCapture(),
      ]);
      if (slRes.success) {
        setData(slRes);
      } else {
        showToast('Failed to load Someday List', 'error');
      }
      if (qcRes.success) {
        setQcTasks(qcRes.rows || []);
      }
    } catch (err) {
      showToast('Error loading Someday List: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleMarkDone(task) {
    const isDone = task.finalStatus === 'Completed';
    const key = `${task.source}-${task.rowNum}`;
    setMarkingDone(prev => ({ ...prev, [key]: true }));
    try {
      const schedDate = task.schedDate ? (typeof task.schedDate === 'string' ? task.schedDate.split('T')[0] : task.schedDate) : '';
      const res = await api.markDone({
        date: schedDate,
        source: task.source,
        sourceRow: task.rowNum,
        done: isDone ? 'No' : 'Yes',
      });
      if (res.success) {
        showToast(isDone ? 'Task unmarked' : 'Task marked done', 'success');
        loadData();
      } else {
        showToast('Failed to update task', 'error');
      }
    } catch {
      showToast('Error updating task', 'error');
    }
    setMarkingDone(prev => ({ ...prev, [key]: false }));
  }

  const qcSlotMap = useMemo(() => buildQcSlotMap(qcTasks), [qcTasks]);

  const completedCount = useMemo(() => {
    if (!data?.tasks) return 0;
    return data.tasks.filter(t => {
      const s = (t.finalStatus || t.baseStatus || '').toLowerCase();
      return s.includes('completed') || s.includes('done');
    }).length;
  }, [data]);

  const filteredTasks = useMemo(() => {
    if (!data?.tasks) return [];
    let tasks = data.tasks.filter(t => matchesFilter(t, filter));
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      tasks = tasks.filter(t =>
        (t.task || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q) ||
        (t.batchType || '').toLowerCase().includes(q) ||
        (t.priority || '').toLowerCase().includes(q) ||
        (t.source || '').toLowerCase().includes(q) ||
        (t.frequency || '').toLowerCase().includes(q)
      );
    }
    return tasks;
  }, [data, filter, search]);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading Someday List...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Someday List</h1>
          <p className="page-subtitle">Computed task list from Quick Capture and Recurring Tasks</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={loadData}>
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="summary-bar" style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="glass-card" style={{ flex: 1, minWidth: 130, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent, #4f8cff)' }}>{data?.totalTasks ?? 0}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Total Tasks</div>
        </div>
        <div className="glass-card" style={{ flex: 1, minWidth: 130, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#2196f3' }}>{data?.totalScheduled ?? 0}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Scheduled</div>
        </div>
        <div className="glass-card" style={{ flex: 1, minWidth: 130, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#ff9800' }}>{data?.totalWaiting ?? 0}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Waiting</div>
        </div>
        <div className="glass-card" style={{ flex: 1, minWidth: 130, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#4caf50' }}>{completedCount}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Completed</div>
        </div>
        <div className="glass-card" style={{ flex: 1, minWidth: 130, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#9c27b0' }}>{data?.arc ?? 0}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Active Recurring</div>
        </div>
      </div>

      {/* Filter Bar + Search */}
      <div className="filter-bar" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
        <div style={{ flex: 1, minWidth: 200, marginLeft: 8 }}>
          <input
            className="form-input"
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '6px 12px', fontSize: 13 }}
          />
        </div>
        <span style={{ fontSize: 13, opacity: 0.6, whiteSpace: 'nowrap' }}>
          Showing {filteredTasks.length} of {data?.tasks?.length ?? 0}
        </span>
      </div>

      {/* Data Table */}
      <div className="glass-card">
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 45 }}>#</th>
                <th style={{ width: 70 }}>Source</th>
                <th style={{ width: 140 }}>Created</th>
                <th>Description</th>
                <th style={{ width: 80 }}>Priority</th>
                <th style={{ width: 100 }}>Sched Date</th>
                <th style={{ width: 90 }}>Deadline</th>
                <th style={{ width: 90 }}>Send To</th>
                <th style={{ width: 90 }}>Batch Type</th>
                <th style={{ width: 100 }}>SL Status</th>
                <th style={{ width: 80 }}>From</th>
                <th style={{ width: 80 }}>To</th>
                <th style={{ width: 90 }}>Frequency</th>
                <th style={{ width: 110 }}>Next Occurrence</th>
                <th style={{ width: 140 }}>Notes</th>
                <th style={{ width: 90 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={16} style={{ textAlign: 'center', padding: 32, opacity: 0.5 }}>
                    No tasks match the current filter
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task, idx) => {
                  const isRecurring = task.source === 'RT';
                  const isDue = task.isDue;
                  const isDone = task.finalStatus === 'Completed';
                  const conflict = hasConflict(task, qcSlotMap);
                  const conflictInfo = conflict ? getConflictInfo(task, qcSlotMap) : null;
                  const doneKey = `${task.source}-${task.rowNum}`;

                  const rowStyle = {};
                  if (isDone) {
                    rowStyle.background = 'rgba(16, 185, 129, 0.06)';
                    rowStyle.opacity = 0.7;
                  } else if (isRecurring) {
                    rowStyle.background = 'rgba(255, 235, 59, 0.08)';
                  }
                  if (isDue && !isDone) {
                    rowStyle.background = 'rgba(255, 152, 0, 0.1)';
                  }

                  return (
                    <tr
                      key={task.seq ?? idx}
                      style={Object.keys(rowStyle).length > 0 ? rowStyle : undefined}
                    >
                      <td>{task.seq ?? task.rowNum ?? idx + 1}</td>
                      <td>
                        <span
                          className={`badge ${task.source === 'QC' ? 'badge-qc' : 'badge-rt'}`}
                          style={{
                            fontSize: 10,
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontWeight: 600,
                            background: task.source === 'QC' ? '#e3f2fd' : '#fff8e1',
                            color: task.source === 'QC' ? '#1565c0' : '#f57f17',
                          }}
                        >
                          {task.source || '-'}
                        </span>
                        {isDue && !isDone && (
                          <span
                            style={{
                              display: 'inline-block',
                              marginLeft: 4,
                              fontSize: 9,
                              padding: '1px 6px',
                              borderRadius: 8,
                              fontWeight: 700,
                              background: '#ff5722',
                              color: '#fff',
                              verticalAlign: 'middle',
                            }}
                          >
                            DUE
                          </span>
                        )}
                        {conflict && (
                          <span
                            style={{
                              display: 'inline-block',
                              marginLeft: 4,
                              fontSize: 9,
                              padding: '1px 6px',
                              borderRadius: 8,
                              fontWeight: 700,
                              background: '#d32f2f',
                              color: '#fff',
                              verticalAlign: 'middle',
                              cursor: 'help',
                            }}
                            title={conflictInfo ? `Conflicts with: ${conflictInfo}` : 'Time slot conflict with QC task'}
                          >
                            CONFLICT
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {task.createdDate ? formatDateTime(task.createdDate) : formatDate(task.schedDate) || '-'}
                      </td>
                      <td>
                        <div style={{
                          fontWeight: 500,
                          textDecoration: isDone ? 'line-through' : 'none',
                          color: isDone ? 'var(--muted)' : undefined,
                        }}>
                          {task.task}
                        </div>
                        {isDone && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: '#fff', background: '#10b981',
                            padding: '1px 7px', borderRadius: 8, display: 'inline-block', marginTop: 2,
                          }}>Done</span>
                        )}
                      </td>
                      <td>
                        <span className={priorityBadgeClass(task.priority)}>
                          {task.priority || 'Low'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{formatDate(task.schedDate) || '-'}</td>
                      <td style={{ fontSize: 12 }}>{formatDate(task.deadline) || '-'}</td>
                      <td style={{ fontSize: 12 }}>{task.sendTo || '-'}</td>
                      <td style={{ fontSize: 12 }}>{task.batchType || '-'}</td>
                      <td>
                        <span className={statusBadgeClass(task.finalStatus || task.baseStatus)}>
                          {task.finalStatus || task.baseStatus || '-'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{task.schedTime || task.schedTimeFrom || '-'}</td>
                      <td style={{ fontSize: 12 }}>{formatTimeTo(task)}</td>
                      <td style={{ fontSize: 12 }}>
                        {task.frequency ? (
                          <span style={{ fontStyle: 'italic' }}>{task.frequency}</span>
                        ) : '-'}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {task.nextOccurrence ? formatDate(task.nextOccurrence) : '-'}
                      </td>
                      <td>
                        {task.notes ? (
                          <div
                            style={{ fontSize: 11, opacity: 0.7, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={task.notes}
                          >
                            {task.notes}
                          </div>
                        ) : (
                          <span style={{ opacity: 0.4 }}>-</span>
                        )}
                      </td>
                      <td>
                        <button
                          style={{
                            fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 8, border: 'none',
                            cursor: markingDone[doneKey] ? 'wait' : 'pointer',
                            background: isDone ? '#10b981' : '#f0f0f0',
                            color: isDone ? '#fff' : 'var(--text-secondary)',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                          }}
                          disabled={markingDone[doneKey]}
                          onClick={() => handleMarkDone(task)}
                          title={isDone ? 'Click to unmark' : 'Click to mark done'}
                        >
                          {markingDone[doneKey] ? '...' : isDone ? 'Undo' : 'Mark Done'}
                        </button>
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
