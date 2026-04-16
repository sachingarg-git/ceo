import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api';
import { useApp } from '../App';

const TIME_SLOTS = [
  '7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM',
  '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM',
  '4:00 PM','4:30 PM','5:00 PM','5:30 PM','6:00 PM','6:30 PM','7:00 PM',
  '7:30 PM','8:00 PM','8:30 PM','9:00 PM','9:30 PM','10:00 PM','10:30 PM','11:00 PM','11:30 PM'
];

/* ── helpers ── */
function parseSlotMin(slot) {
  if (!slot) return null;
  const m = slot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1]), min = parseInt(m[2]);
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function nthWeekdayOfMonth(date, weekday, weekPosition) {
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const targetDay = days.indexOf(weekday);
  if (targetDay < 0) return false;
  const jsTarget = (targetDay + 1) % 7;
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

function doesRecurOn(rt, dateStr) {
  if (!rt || (rt.status || '').toLowerCase() !== 'active') return false;
  const date = new Date(dateStr + 'T00:00:00');
  const freq = rt.frequency;
  if (!freq) return false;

  const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const dayOfWeekIdx = (date.getDay() + 6) % 7; // Mon=0
  // Support comma-separated multi-day e.g. "Monday,Saturday"
  const weekdays = rt.weekday ? rt.weekday.split(',').map(d => d.trim()).filter(Boolean) : [];

  if (freq === 'Daily') {
    if (weekdays.length > 0) {
      if (rt.weekPosition && weekdays.length === 1)
        return nthWeekdayOfMonth(date, weekdays[0], rt.weekPosition);
      return weekdays.some(d => dayNames.indexOf(d) === dayOfWeekIdx);
    }
    return true;
  }
  if (freq === 'Weekly') {
    if (weekdays.length === 0) return false;
    const matchesDay = weekdays.some(d => dayNames.indexOf(d) === dayOfWeekIdx);
    if (!matchesDay) return false;
    if (rt.weekPosition && weekdays.length === 1)
      return nthWeekdayOfMonth(date, weekdays[0], rt.weekPosition);
    return true;
  }
  if (freq === 'Monthly') {
    if (rt.fixedDate) {
      const fd = new Date(rt.fixedDate + 'T00:00:00');
      return date.getDate() === fd.getDate();
    }
    return nthWeekdayOfMonth(date, weekdays[0] || '', rt.weekPosition);
  }
  if (freq === 'Yearly') {
    if (!rt.fixedDate) return false;
    const fd = new Date(rt.fixedDate + 'T00:00:00');
    return date.getMonth() === fd.getMonth() && date.getDate() === fd.getDate();
  }
  if (freq === 'Fixed Date') return dateStr === rt.fixedDate;
  return false;
}

// Build set of booked slot-minutes for a date from a time range
function addRangeToSet(set, fromSlot, toSlot) {
  const fromMin = parseSlotMin(fromSlot);
  if (fromMin === null) return;
  const toMin = toSlot ? parseSlotMin(toSlot) : fromMin + 30;
  const endMin = toMin !== null ? toMin : fromMin + 30;
  for (let m = fromMin; m < endMin; m += 30) set.add(m);
}

export default function NextWeekPlan() {
  const { showToast } = useApp();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [qcRows, setQcRows]     = useState([]);
  const [rtRows, setRtRows]     = useState([]);

  const loadData = useCallback(async (offset) => {
    setLoading(true);
    try {
      const [res, qcRes, rtRes] = await Promise.all([
        api.getNextWeekPlan(offset),
        api.getQuickCapture(),
        api.getRecurringTasks(),
      ]);
      if (res.success) setData(res);
      else showToast('Failed to load week plan', 'error');
      if (qcRes.success) setQcRows(qcRes.rows || []);
      if (rtRes.success) setRtRows(rtRes.rows || []);
    } catch {
      showToast('Error loading week plan', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(weekOffset); }, [weekOffset, loadData]);

  function goThisWeek() { setWeekOffset(0); }
  function goPrev()     { setWeekOffset(w => w - 1); }
  function goNext()     { setWeekOffset(w => w + 1); }

  function getTaskForSlot(dayIndex, timeSlot) {
    if (!data?.grid?.[dayIndex]) return null;
    const slot = data.grid[dayIndex].find(s => s.time === timeSlot);
    return slot?.task || null;
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

  /* ── Build booked slot map ── */
  // dateISO → { mins: Set<number>, sources: Set<'QC'|'RT'>, names: Map<minute, {rt?, qc?}> }
  const bookedMap = useMemo(() => {
    const map = {};
    const ensure = (d) => {
      if (!map[d]) map[d] = { mins: new Set(), sources: new Set(), names: new Map() };
    };
    const addName = (d, m, source, name) => {
      if (!map[d].names.has(m)) map[d].names.set(m, {});
      const entry = map[d].names.get(m);
      // Store only the start-slot name (first occurrence wins per source)
      if (source === 'RT' && !entry.rt) entry.rt = name;
      if (source === 'QC' && !entry.qc) entry.qc = name;
    };

    // QC rows: match by schedDate
    qcRows.forEach(r => {
      if (!r.schedDate || !r.schedTimeFrom) return;
      ensure(r.schedDate);
      const from = parseSlotMin(r.schedTimeFrom);
      if (from === null) return;
      const to = r.schedTimeTo ? parseSlotMin(r.schedTimeTo) : from + 30;
      const end = to !== null ? to : from + 30;
      for (let m = from; m < end; m += 30) {
        map[r.schedDate].mins.add(m);
        map[r.schedDate].sources.add('QC');
        addName(r.schedDate, m, 'QC', r.description || r.task || '');
      }
    });

    // RT rows: check each week day
    const weekDates = data?.weekDates || [];
    weekDates.forEach(wd => {
      if (!wd.dateISO) return;
      rtRows.forEach(rt => {
        if (!rt.timeSlot || (rt.status || '').toLowerCase() !== 'active') return;
        if (!doesRecurOn(rt, wd.dateISO)) return;
        ensure(wd.dateISO);
        const from = parseSlotMin(rt.timeSlot);
        if (from === null) return;
        const to = rt.timeTo ? parseSlotMin(rt.timeTo) : from + 30;
        const end = to !== null ? to : from + 30;
        for (let m = from; m < end; m += 30) {
          map[wd.dateISO].mins.add(m);
          map[wd.dateISO].sources.add('RT');
          addName(wd.dateISO, m, 'RT', rt.task || rt.name || '');
        }
      });
    });

    return map;
  }, [qcRows, rtRows, data]);

  function getBookedInfo(dateISO, slot) {
    const slotMin = parseSlotMin(slot);
    if (slotMin === null || !bookedMap[dateISO]) return null;
    if (!bookedMap[dateISO].mins.has(slotMin)) return null;
    const entry = bookedMap[dateISO].names?.get(slotMin) || {};
    return { sources: bookedMap[dateISO].sources, rtName: entry.rt || '', qcName: entry.qc || '' };
  }

  /* ── Loading / error states ── */
  if (loading && !data) {
    return (
      <div>
        <div className="page-header"><div></div></div>
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
        <div className="page-header"><div></div></div>
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
        <div>
          <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>
            Week: {weekDates.length > 0 ? `${weekDates[0].date} - ${weekDates[weekDates.length - 1].date}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn btn-outline btn-sm" onClick={goPrev}>&larr; Prev</button>
          <button className="btn btn-primary btn-sm" onClick={goThisWeek} disabled={weekOffset === 0}>This Week</button>
          <button className="btn btn-outline btn-sm" onClick={goNext}>Next &rarr;</button>
          <button className="btn btn-outline btn-sm" onClick={() => loadData(weekOffset)} style={{ marginLeft: 8 }}>Refresh</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 10, fontSize: 11, color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#3b82f6', display: 'inline-block' }} />
          Quick Capture booked
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} />
          Recurring booked
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#8b5cf6', display: 'inline-block' }} />
          Both booked
        </span>
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
              {weekDates.map((wd, dayIdx) => {
                const task       = getTaskForSlot(dayIdx, slot);
                const display    = getTaskDisplay(task);
                const highPri    = isHighPriority(task);
                const booked     = getBookedInfo(wd.dateISO, slot);
                const hasQC      = booked?.sources?.has('QC');
                const hasRT      = booked?.sources?.has('RT');
                const both       = hasQC && hasRT;
                const rtName     = booked?.rtName || '';
                const qcName     = booked?.qcName || '';

                // Left strip colour: purple if both, blue if QC only, amber if RT only
                const stripColor = booked
                  ? (both ? '#8b5cf6' : hasQC ? '#3b82f6' : '#f59e0b')
                  : null;

                const tooltipParts = [];
                if (hasQC) tooltipParts.push('Quick Capture booked');
                if (hasRT) tooltipParts.push('Recurring booked');
                if (display) tooltipParts.unshift(display);

                return (
                  <div
                    key={dayIdx}
                    className={`nwp-cell${display ? ' has-task' : ''}`}
                    style={{
                      position: 'relative',
                      background: display
                        ? (highPri ? 'rgba(239,68,68,0.12)' : 'var(--success-bg)')
                        : booked ? (both ? 'rgba(139,92,246,0.06)' : hasQC ? 'rgba(59,130,246,0.06)' : 'rgba(245,158,11,0.06)')
                        : undefined,
                      color: display && highPri ? '#dc2626' : 'inherit',
                      paddingLeft: booked ? 10 : undefined,
                    }}
                    title={tooltipParts.join(' · ')}
                  >
                    {/* Left colour strip for booked slots */}
                    {booked && (
                      <span style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: 3, borderRadius: '2px 0 0 2px',
                        background: stripColor,
                      }} />
                    )}

                    {display ? (
                      <span style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.3,
                        wordBreak: 'break-word',
                        fontSize: '0.75rem',
                      }}>
                        {display}
                      </span>
                    ) : booked ? (
                      <span style={{
                        display: 'flex', alignItems: 'flex-start', gap: 3,
                        fontSize: '0.7rem', fontWeight: 600,
                        color: stripColor, lineHeight: 1.25,
                        overflow: 'hidden',
                      }}>
                        {/* Icon */}
                        <span style={{ flexShrink: 0, fontSize: 10, marginTop: 1 }}>
                          {both ? '🔄' : hasRT ? '🔄' : '📋'}
                        </span>
                        {/* Task name — RT name takes priority, fallback to QC name */}
                        <span style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          wordBreak: 'break-word',
                          flex: 1,
                        }}>
                          {rtName || qcName}
                        </span>
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
                const date  = typeof task === 'object' ? (task.schedDate || task.date || '') : '';
                return (
                  <div key={i} style={{
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.15)',
                    borderRadius: 6, padding: '0.5rem 0.75rem',
                    fontSize: '0.82rem', flex: '1 1 250px', maxWidth: 400,
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
