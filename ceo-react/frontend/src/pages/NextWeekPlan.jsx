import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useApp } from '../App';

const TIME_SLOTS = [];
for (let h = 7; h <= 19; h++) {
  const hour12 = h > 12 ? h - 12 : h;
  const ampm = h >= 12 ? 'PM' : 'AM';
  TIME_SLOTS.push({
    label: `${hour12}:00 ${ampm}`,
    key: `${String(h).padStart(2, '0')}:00`,
  });
}

export default function NextWeekPlan() {
  const { showToast } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.getNextWeekPlan();
      if (res.success) {
        setData(res);
      } else {
        showToast('Failed to load week plan', 'error');
      }
    } catch {
      showToast('Error loading week plan', 'error');
    } finally {
      setLoading(false);
    }
  }

  function getTaskForSlot(dayIndex, timeKey) {
    if (!data || !data.grid || !data.grid[dayIndex]) return null;
    const daySlots = data.grid[dayIndex];
    const slot = daySlots.find(s => s.timeKey === timeKey || s.time === timeKey);
    return slot && slot.task ? slot.task : null;
  }

  if (loading) {
    return (
      <div>
        <div className="page-header"><h1>Next Week Plan</h1></div>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" />
          <p style={{ marginTop: '1rem', opacity: 0.7 }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <div className="page-header"><h1>Next Week Plan</h1></div>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Unable to load plan data.</p>
          <button className="btn btn-primary" onClick={loadData}>Retry</button>
        </div>
      </div>
    );
  }

  const { weekDates = [], unscheduled = [] } = data;

  return (
    <div>
      <div className="page-header">
        <h1>Next Week Plan</h1>
        <button className="btn btn-outline" onClick={loadData}>Refresh</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem' }}>
        {/* Main Grid */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div className="glass-card-header">
            <span>Weekly Schedule</span>
          </div>
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ width: 90, position: 'sticky', left: 0, background: 'inherit', zIndex: 1 }}>Time</th>
                  {weekDates.map((wd, i) => (
                    <th key={i} style={{ textAlign: 'center', minWidth: 100 }}>
                      <div style={{ fontWeight: 600 }}>{wd.dayName}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{wd.date}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map(slot => (
                  <tr key={slot.key}>
                    <td style={{
                      fontWeight: 500,
                      fontSize: '0.8rem',
                      whiteSpace: 'nowrap',
                      opacity: 0.7,
                      position: 'sticky',
                      left: 0,
                      background: 'inherit',
                      zIndex: 1,
                    }}>
                      {slot.label}
                    </td>
                    {weekDates.map((_, dayIdx) => {
                      const task = getTaskForSlot(dayIdx, slot.key);
                      return (
                        <td key={dayIdx} style={{
                          textAlign: 'center',
                          padding: '0.4rem',
                          verticalAlign: 'top',
                          minHeight: 40,
                        }}>
                          {task ? (
                            <div style={{
                              background: 'rgba(99, 102, 241, 0.1)',
                              border: '1px solid rgba(99, 102, 241, 0.2)',
                              borderRadius: 6,
                              padding: '0.3rem 0.5rem',
                              fontSize: '0.78rem',
                              lineHeight: 1.3,
                              wordBreak: 'break-word',
                            }}>
                              {task}
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Unscheduled Panel */}
        <div className="glass-card" style={{ alignSelf: 'flex-start' }}>
          <div className="glass-card-header">
            <span>Unscheduled</span>
            <span className="badge badge-warning" style={{ marginLeft: 6 }}>{unscheduled.length}</span>
          </div>
          <div style={{ padding: '0.75rem 1rem' }}>
            {unscheduled.length === 0 ? (
              <p style={{ opacity: 0.5, textAlign: 'center', padding: '1rem 0', fontSize: '0.85rem' }}>
                All tasks scheduled
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {unscheduled.map((task, i) => (
                  <div key={i} style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.15)',
                    borderRadius: 6,
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.82rem',
                  }}>
                    {typeof task === 'string' ? task : task.task || task.title || JSON.stringify(task)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
