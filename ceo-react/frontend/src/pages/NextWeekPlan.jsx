import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useApp } from '../App';

const TIME_SLOTS = [
  '7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM',
  '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM',
  '4:00 PM','4:30 PM','5:00 PM','5:30 PM','6:00 PM','6:30 PM','7:00 PM',
  '7:30 PM','8:00 PM','8:30 PM','9:00 PM','9:30 PM','10:00 PM','10:30 PM','11:00 PM','11:30 PM'
];

export default function NextWeekPlan() {
  const { showToast } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  const loadData = useCallback(async (offset) => {
    setLoading(true);
    try {
      const res = await api.getNextWeekPlan(offset);
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
  }, [showToast]);

  useEffect(() => {
    loadData(weekOffset);
  }, [weekOffset, loadData]);

  function goThisWeek() { setWeekOffset(0); }
  function goPrev() { setWeekOffset(w => w - 1); }
  function goNext() { setWeekOffset(w => w + 1); }

  function getTaskForSlot(dayIndex, timeSlot) {
    if (!data || !data.grid || !data.grid[dayIndex]) return null;
    const daySlots = data.grid[dayIndex];
    const slot = daySlots.find(s => s.time === timeSlot);
    return slot && slot.task ? slot.task : null;
  }

  function getTaskDisplay(task) {
    if (!task) return null;
    if (typeof task === 'string') return task;
    return task.task || task.title || task.description || '';
  }

  function isHighPriority(task) {
    if (!task || typeof task === 'string') return false;
    const p = (task.priority || '').toLowerCase();
    return p === 'high' || p === 'urgent' || p === 'critical';
  }

  if (loading && !data) {
    return (
      <div>
        <div className="page-header"><div><h2>Week Plan</h2></div></div>
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
        <div className="page-header"><div><h2>Week Plan</h2></div></div>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Unable to load plan data.</p>
          <button className="btn btn-primary" onClick={() => loadData(weekOffset)}>Retry</button>
        </div>
      </div>
    );
  }

  const { weekDates = [], unscheduled = [] } = data;

  return (
    <div>
      <div className="page-header">
        <div><h2>Week Plan</h2>
          <p>{weekDates.length > 0 ? `${weekDates[0].date} - ${weekDates[weekDates.length - 1].date}` : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn btn-outline btn-sm" onClick={goPrev} title="Previous Week">&larr; Prev</button>
          <button className="btn btn-primary btn-sm" onClick={goThisWeek} disabled={weekOffset === 0}>This Week</button>
          <button className="btn btn-outline btn-sm" onClick={goNext} title="Next Week">Next &rarr;</button>
          <button className="btn btn-outline btn-sm" onClick={() => loadData(weekOffset)} title="Refresh" style={{ marginLeft: 8 }}>Refresh</button>
        </div>
      </div>

      {/* NWP Grid */}
      <div className="glass-card" style={{ overflow: 'hidden', marginBottom: '1.5rem' }}>
        <div className="nwp-grid">
          {/* Header row */}
          <div className="nwp-header">Time</div>
          {weekDates.map((wd, i) => (
            <div key={i} className="nwp-header">
              <div>{wd.dayName}</div>
              <div style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>{wd.date}</div>
            </div>
          ))}

          {/* Time slot rows */}
          {TIME_SLOTS.map(slot => (
            <React.Fragment key={slot}>
              <div className="nwp-time">{slot}</div>
              {weekDates.map((_, dayIdx) => {
                const task = getTaskForSlot(dayIdx, slot);
                const display = getTaskDisplay(task);
                const highPri = isHighPriority(task);
                return (
                  <div
                    key={dayIdx}
                    className={`nwp-cell${display ? ' has-task' : ''}`}
                    style={display ? {
                      background: highPri ? 'rgba(239, 68, 68, 0.12)' : 'var(--success-bg)',
                      color: highPri ? '#dc2626' : 'inherit',
                    } : undefined}
                    title={display || ''}
                  >
                    {display ? (
                      <span style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.3,
                        wordBreak: 'break-word',
                      }}>
                        {display}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Unscheduled Tasks Panel */}
      {unscheduled.length > 0 && (
        <div className="glass-card">
          <div className="glass-card-header">
            <span>Unscheduled Tasks</span>
            <span className="badge badge-warning" style={{ marginLeft: 8 }}>{unscheduled.length}</span>
          </div>
          <div style={{ padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {unscheduled.map((task, i) => {
                const label = typeof task === 'string' ? task : (task.task || task.title || JSON.stringify(task));
                const date = typeof task === 'object' ? (task.schedDate || task.date || '') : '';
                return (
                  <div key={i} style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.15)',
                    borderRadius: 6,
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.82rem',
                    flex: '1 1 250px',
                    maxWidth: 400,
                  }}>
                    <div style={{ fontWeight: 500 }}>{label}</div>
                    {date && <div style={{ fontSize: '0.72rem', opacity: 0.6, marginTop: 2 }}>{date}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '1rem', opacity: 0.5 }}>
          <div className="spinner" style={{ width: 20, height: 20 }} />
        </div>
      )}
    </div>
  );
}
