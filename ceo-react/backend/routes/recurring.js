const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET all recurring tasks
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM RecurringTasks WHERE CompanyID = @companyId ORDER BY ID ASC', { companyId: req.companyId });
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const rows = result.recordset.map(r => {
      const obj = {
        id: r.ID,
        _rowNum: r.ID,
        name: r.Task || '',
        task: r.Task || '',
        priority: r.Priority || 'Medium',
        batchType: r.BatchType || '',
        frequency: r.Frequency || '',
        weekday: r.Weekday || '',
        weekPosition: r.WeekPosition || '',
        fixedDate: r.FixedDate || '',
        slStatus: r.SLStatus || 'Scheduled',
        status: r.Status || 'Active',
        notes: r.Notes || '',
        timeSlot: r.TimeSlot || '',
        dateAdded: r.DateAdded || '',
        dateStopped: r.DateStopped || '',
      };

      if (obj.status === 'Active') {
        const nextOcc = computeNextOccurrence(obj.frequency, obj.weekday, obj.weekPosition, obj.fixedDate);
        obj._nextOccurrence = nextOcc ? formatDate(nextOcc) : '';
        obj._nextOccurrenceISO = nextOcc ? formatDateISO(nextOcc) : '';
        obj._isDue = nextOcc ? (sameDay(nextOcc, today) || sameDay(nextOcc, tomorrow)) : false;
      } else {
        obj._nextOccurrence = '';
        obj._nextOccurrenceISO = '';
        obj._isDue = false;
      }

      return obj;
    });

    res.json({ success: true, rows, totalRows: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST add recurring task
router.post('/', async (req, res) => {
  try {
    const b = req.body;
    const result = await query(
      `INSERT INTO RecurringTasks (Task, Priority, BatchType, Frequency, Weekday, WeekPosition, FixedDate, SLStatus, Status, Notes, TimeSlot, DateAdded, CompanyID)
       OUTPUT INSERTED.ID
       VALUES (@task, @priority, @batchType, @frequency, @weekday, @weekPosition, @fixedDate, @slStatus, @status, @notes, @timeSlot, @dateAdded, @companyId)`,
      {
        task: b.task || b.name || '',
        priority: b.priority || 'Medium',
        batchType: b.batchType || '',
        frequency: b.frequency || 'Daily',
        weekday: b.weekday || '',
        weekPosition: b.weekPosition || '',
        fixedDate: b.fixedDate || '',
        slStatus: b.slStatus || 'Scheduled',
        status: b.status || 'Active',
        notes: b.notes || '',
        timeSlot: b.timeSlot || '',
        dateAdded: formatDateISO(new Date()),
        companyId: req.companyId,
      }
    );
    res.json({ success: true, id: result.recordset[0].ID, message: 'Recurring task added' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update recurring task
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const b = req.body;
    if (b.name !== undefined && b.task === undefined) b.task = b.name;

    const fields = {
      Task: 'task', Priority: 'priority', BatchType: 'batchType',
      Frequency: 'frequency', Weekday: 'weekday', WeekPosition: 'weekPosition',
      FixedDate: 'fixedDate', SLStatus: 'slStatus', Status: 'status',
      Notes: 'notes', TimeSlot: 'timeSlot',
    };

    const sets = [];
    const params = { id, companyId: req.companyId };

    for (const [col, key] of Object.entries(fields)) {
      if (b[key] !== undefined) {
        sets.push(`${col} = @${key}`);
        params[key] = b[key];
      }
    }

    if (b.status === 'Stopped') {
      sets.push('DateStopped = @dateStopped');
      params.dateStopped = formatDateISO(new Date());
    }

    if (sets.length === 0) return res.json({ success: true, message: 'No changes' });

    await query(`UPDATE RecurringTasks SET ${sets.join(', ')} WHERE ID = @id AND CompanyID = @companyId`, params);
    res.json({ success: true, id, message: 'Recurring task updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE recurring task
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await query('DELETE FROM RecurringTasks WHERE ID = @id AND CompanyID = @companyId', { id, companyId: req.companyId });
    res.json({ success: true, id, message: 'Recurring task deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---- Helpers (ported from GS) ----

function formatDateISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function formatDate(d) {
  return String(d.getDate()).padStart(2,'0') + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear();
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function computeNextOccurrence(freq, weekday, weekPos, fixedDate) {
  const today = new Date(); today.setHours(0,0,0,0);

  if (freq === 'Daily') return new Date(today);

  if (freq === 'Weekly') {
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const targetDay = days.indexOf(weekday);
    if (targetDay < 0) return null;
    const currentDay = (today.getDay() + 6) % 7;
    const diff = (targetDay - currentDay + 7) % 7;
    const result = new Date(today);
    result.setDate(result.getDate() + diff);
    return result;
  }

  if (freq === 'Monthly') {
    // If fixedDate is set, use that day-of-month for monthly recurrence
    if (fixedDate) {
      const fd = parseLocalDate(fixedDate);
      if (!fd) return null;
      const dayOfMonth = fd.getDate();
      // Try this month, then next month
      for (let mOff = 0; mOff <= 2; mOff++) {
        let year = today.getFullYear();
        let month = today.getMonth() + mOff;
        if (month > 11) { month -= 12; year++; }
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const day = Math.min(dayOfMonth, daysInMonth);
        const candidate = new Date(year, month, day);
        candidate.setHours(0,0,0,0);
        if (candidate >= today) return candidate;
      }
      return null;
    }
    // Otherwise use weekday + week position
    const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const targetDayIdx = dayNames.indexOf(weekday);
    if (targetDayIdx < 0) return null;
    const jsDayTarget = (targetDayIdx + 1) % 7;
    const posMap = { First: 1, Second: 2, Third: 3, Fourth: 4, Last: 99 };
    const posNum = posMap[weekPos] || 1;

    for (let mOff = 0; mOff <= 2; mOff++) {
      let year = today.getFullYear();
      let month = today.getMonth() + mOff;
      if (month > 11) { month -= 12; year++; }
      const candidate = findNthWeekdayInMonth(year, month, jsDayTarget, posNum);
      if (candidate && candidate >= today) return candidate;
    }
    return null;
  }

  if (freq === 'Yearly') {
    const fd = parseLocalDate(fixedDate);
    if (!fd) return null;
    const thisYear = new Date(today.getFullYear(), fd.getMonth(), fd.getDate());
    thisYear.setHours(0,0,0,0);
    if (thisYear >= today) return thisYear;
    return new Date(today.getFullYear() + 1, fd.getMonth(), fd.getDate());
  }

  if (freq === 'Fixed Date') {
    return parseLocalDate(fixedDate);
  }

  return null;
}

function findNthWeekdayInMonth(year, month, jsDayTarget, posNum) {
  if (posNum === 99) {
    const lastDay = new Date(year, month + 1, 0);
    const diff = (lastDay.getDay() - jsDayTarget + 7) % 7;
    const result = new Date(year, month, lastDay.getDate() - diff);
    result.setHours(0,0,0,0);
    return result;
  }
  const first = new Date(year, month, 1);
  const firstDayOfWeek = first.getDay();
  const offset = (jsDayTarget - firstDayOfWeek + 7) % 7;
  const nthDate = 1 + offset + (posNum - 1) * 7;
  const candidate = new Date(year, month, nthDate);
  candidate.setHours(0,0,0,0);
  if (candidate.getMonth() !== month) return null;
  return candidate;
}

function parseLocalDate(s) {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

module.exports = router;
