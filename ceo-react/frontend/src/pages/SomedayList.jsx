import React, { useState, useEffect, useMemo } from 'react';
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

export default function SomedayList() {
  const { showToast } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.getSomedayList();
      if (res.success) {
        setData(res);
      } else {
        showToast('Failed to load Someday List', 'error');
      }
    } catch (err) {
      showToast('Error loading Someday List: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const filteredTasks = useMemo(() => {
    if (!data?.tasks) return [];
    return data.tasks.filter(t => matchesFilter(t, filter));
  }, [data, filter]);

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
        <div className="glass-card" style={{ flex: 1, minWidth: 140, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{data?.totalTasks ?? 0}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Total Tasks</div>
        </div>
        <div className="glass-card" style={{ flex: 1, minWidth: 140, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{data?.totalScheduled ?? 0}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Scheduled</div>
        </div>
        <div className="glass-card" style={{ flex: 1, minWidth: 140, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{data?.totalWaiting ?? 0}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Waiting</div>
        </div>
        <div className="glass-card" style={{ flex: 1, minWidth: 140, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{data?.arc ?? 0}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Active Recurring</div>
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
          Showing {filteredTasks.length} of {data?.tasks?.length ?? 0}
        </span>
      </div>

      {/* Data Table */}
      <div className="glass-card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Task</th>
                <th style={{ width: 90 }}>Priority</th>
                <th style={{ width: 100 }}>Batch Type</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 140 }}>Schedule</th>
                <th style={{ width: 70 }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, opacity: 0.5 }}>
                    No tasks match the current filter
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task, idx) => (
                  <tr
                    key={task.seq ?? idx}
                    className={task.isDue ? 'row-due' : ''}
                    style={task.isDue ? { background: 'rgba(255, 193, 7, 0.08)' } : undefined}
                  >
                    <td>{task.seq ?? idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{task.task}</div>
                      {task.notes && (
                        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{task.notes}</div>
                      )}
                    </td>
                    <td>
                      <span className={priorityBadgeClass(task.priority)}>
                        {task.priority || 'Low'}
                      </span>
                    </td>
                    <td>{task.batchType || '-'}</td>
                    <td>
                      <span className={statusBadgeClass(task.finalStatus || task.baseStatus)}>
                        {task.finalStatus || task.baseStatus || '-'}
                      </span>
                    </td>
                    <td>
                      {task.schedDate ? (
                        <div>
                          <div style={{ fontSize: 12 }}>{task.schedDate}</div>
                          {task.schedTime && (
                            <div style={{ fontSize: 11, opacity: 0.6 }}>{task.schedTime}</div>
                          )}
                        </div>
                      ) : task.frequency ? (
                        <div style={{ fontSize: 12 }}>
                          {task.frequency}
                          {task.nextOccurrence && (
                            <div style={{ fontSize: 11, opacity: 0.6 }}>Next: {task.nextOccurrence}</div>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <span className={`badge ${task.source === 'QC' ? 'badge-qc' : 'badge-rt'}`}>
                        {task.source || '-'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
