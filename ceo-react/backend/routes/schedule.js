const express = require('express');
const router = express.Router();
const { query } = require('../db');

const TIME_SLOTS = [
  '7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM',
  '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM',
  '4:00 PM','4:30 PM','5:00 PM','5:30 PM','6:00 PM','6:30 PM','7:00 PM'
];

// GET /api/someday-list (computed)
router.get('/someday-list', async (req, res) => {
  try {
    const result = await computeSomedayList();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/daily-schedule/:date
router.get('/daily-schedule/:date', async (req, res) => {
  try {
    const dateStr = req.params.date;

    // Get someday list tasks (QC Someday + RT)
    const sl = await computeSomedayList();
    const slTasks = sl.tasks || [];

    // Also get ALL QC tasks for this date (including Information System sendTo)
    const allQcResult = await query(
      "SELECT * FROM QuickCapture WHERE SchedDate = @date ORDER BY ID ASC",
      { date: dateStr }
    );

    // DS done flags for this date
    const dsResult2 = await query(
      "SELECT Source, SourceRow, Done FROM DailySchedule WHERE Date = @date AND Source != '_DAY'",
      { date: dateStr }
    );
    const doneFlags = {};
    dsResult2.recordset.forEach(r => { doneFlags[r.Source + '|' + r.SourceRow] = r.Done; });

    // Build extra QC tasks not in Someday List (i.e. sendTo='Information System')
    const slTaskIds = new Set(slTasks.filter(t => t.source === 'QC').map(t => t.rowNum));
    const extraQcTasks = allQcResult.recordset
      .filter(r => !slTaskIds.has(r.ID) && r.SchedTimeFrom)
      .map(r => {
        let finalStatus = r.SLStatus || 'Scheduled';
        if (doneFlags['QC|' + r.ID] === 'Yes') finalStatus = 'Completed';
        return {
          seq: 0, source: 'QC', rowNum: r.ID, task: r.Task || '',
          priority: r.Priority || '', batchType: r.BatchType || '',
          baseStatus: r.SLStatus || 'Scheduled', finalStatus,
          schedDate: r.SchedDate || '', schedTime: r.SchedTimeFrom || '',
          timeKey: r.SchedDate + '|' + (r.SchedTimeFrom || ''),
          sendTo: r.SendTo || '', notes: r.Notes || '', isDue: false,
        };
      });

    // Merge all tasks
    const allTasks = [...slTasks, ...extraQcTasks];

    // Build time grid from ALL tasks
    const timeGrid = TIME_SLOTS.map(slot => {
      const slotKey = dateStr + '|' + slot;
      const matchedTask = allTasks.find(t => t.timeKey === slotKey) || null;
      return { time: slot, timeKey: slotKey, task: matchedTask };
    });

    // Scheduled: tasks for this date with status Scheduled or Completed
    const scheduled = allTasks.filter(t => t.schedDate === dateStr && (t.baseStatus === 'Scheduled' || t.finalStatus === 'Completed'));
    // Waiting: tasks with status Waiting for this date OR with no schedDate (always show)
    const waitingForDate = allTasks.filter(t => t.schedDate === dateStr && t.baseStatus === 'Waiting');
    // Also get unscheduled waiting tasks (no date set - show on every day)
    const unschedWaitResult = await query(
      "SELECT * FROM QuickCapture WHERE SLStatus = 'Waiting' AND (SchedDate IS NULL OR SchedDate = '') ORDER BY ID ASC"
    );
    const unschedWaiting = unschedWaitResult.recordset.map(r => ({
      seq: 0, source: 'QC', rowNum: r.ID, task: r.Task || '',
      priority: r.Priority || '', batchType: r.BatchType || '',
      baseStatus: 'Waiting', finalStatus: 'Waiting',
      schedDate: '', schedTime: '', timeKey: '',
      sendTo: r.SendTo || '', notes: r.Notes || '', isDue: false,
    }));
    const waiting = [...waitingForDate, ...unschedWaiting];

    // Day rating
    const dsResult = await query(
      "SELECT DayRating FROM DailySchedule WHERE Date = @date AND Source = '_DAY'",
      { date: dateStr }
    );
    const dayRating = dsResult.recordset.length > 0 ? dsResult.recordset[0].DayRating || '' : '';

    // Actually done notes
    const notesResult = await query(
      "SELECT ActuallyDone FROM DailySchedule WHERE Date = @date AND Source = '_DAY'",
      { date: dateStr }
    );
    const actuallyDone = notesResult.recordset.length > 0 ? notesResult.recordset[0].ActuallyDone || '' : '';

    res.json({
      success: true,
      date: dateStr,
      timeGrid,
      scheduled,
      waiting,
      dayRating,
      actuallyDone,
      totalScheduled: scheduled.length,
      totalWaiting: waiting.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/mark-done
router.post('/mark-done', async (req, res) => {
  try {
    const { date, source, sourceRow, done } = req.body;
    const dateStr = date || formatDateISO(new Date());
    const doneVal = done || 'Yes';
    const now = new Date();
    const timeStr = formatTimeNow(now);

    const existing = await query(
      "SELECT ID FROM DailySchedule WHERE Date = @date AND Source = @source AND SourceRow = @sourceRow",
      { date: dateStr, source: source || '', sourceRow: String(sourceRow || '') }
    );

    if (existing.recordset.length > 0) {
      await query(
        "UPDATE DailySchedule SET Done = @done, DoneTime = @doneTime WHERE ID = @id",
        { done: doneVal, doneTime: timeStr, id: existing.recordset[0].ID }
      );
    } else {
      await query(
        "INSERT INTO DailySchedule (Date, Source, SourceRow, Done, DoneTime) VALUES (@date, @source, @sourceRow, @done, @doneTime)",
        { date: dateStr, source: source || '', sourceRow: String(sourceRow || ''), done: doneVal, doneTime: timeStr }
      );
    }
    res.json({ success: true, message: 'Task marked as ' + doneVal });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/day-rating
router.post('/day-rating', async (req, res) => {
  try {
    const { date, rating } = req.body;
    const dateStr = date || formatDateISO(new Date());

    const existing = await query(
      "SELECT ID FROM DailySchedule WHERE Date = @date AND Source = '_DAY'",
      { date: dateStr }
    );

    if (existing.recordset.length > 0) {
      await query(
        "UPDATE DailySchedule SET DayRating = @rating WHERE ID = @id",
        { rating: rating || '', id: existing.recordset[0].ID }
      );
    } else {
      await query(
        "INSERT INTO DailySchedule (Date, Source, DayRating) VALUES (@date, '_DAY', @rating)",
        { date: dateStr, rating: rating || '' }
      );
    }
    res.json({ success: true, message: 'Day rating set' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ds-notes
router.post('/ds-notes', async (req, res) => {
  try {
    const { date, notes } = req.body;
    const dateStr = date || formatDateISO(new Date());

    const existing = await query(
      "SELECT ID FROM DailySchedule WHERE Date = @date AND Source = '_DAY'",
      { date: dateStr }
    );

    if (existing.recordset.length > 0) {
      await query(
        "UPDATE DailySchedule SET ActuallyDone = @notes WHERE ID = @id",
        { notes: notes || '', id: existing.recordset[0].ID }
      );
    } else {
      await query(
        "INSERT INTO DailySchedule (Date, Source, ActuallyDone) VALUES (@date, '_DAY', @notes)",
        { date: dateStr, notes: notes || '' }
      );
    }
    res.json({ success: true, message: 'Notes saved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---- Compute Someday List (ported from GS) ----
async function computeSomedayList() {
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const todayISO = formatDateISO(today);

  // QC tasks where SendTo = 'Someday List'
  const qcResult = await query(
    "SELECT * FROM QuickCapture WHERE SendTo = 'Someday List' ORDER BY ID ASC"
  );

  // RT active tasks
  const rtResult = await query(
    "SELECT * FROM RecurringTasks WHERE Status = 'Active' ORDER BY ID ASC"
  );

  // DS done flags for today
  const dsResult = await query(
    "SELECT Source, SourceRow, Done FROM DailySchedule WHERE Date = @date AND Source != '_DAY'",
    { date: todayISO }
  );
  const doneFlags = {};
  dsResult.recordset.forEach(r => {
    doneFlags[r.Source + '|' + r.SourceRow] = r.Done;
  });

  // Process recurring tasks
  const dueRecurring = [];
  rtResult.recordset.forEach(r => {
    const freq = r.Frequency || '';
    const weekday = r.Weekday || '';
    const weekPos = r.WeekPosition || '';
    const fixedDate = r.FixedDate || '';
    const nextOcc = computeNextOccurrence(freq, weekday, weekPos, fixedDate);
    const isDue = nextOcc ? (sameDay(nextOcc, today) || sameDay(nextOcc, tomorrow)) : false;

    if (isDue) {
      dueRecurring.push({
        source: 'RT',
        rowNum: r.ID,
        task: r.Task || '',
        priority: r.Priority || '',
        batchType: r.BatchType || '',
        slStatus: r.SLStatus || 'Scheduled',
        frequency: freq,
        timeSlot: r.TimeSlot || '',
        nextOccurrence: nextOcc ? formatDateDD(nextOcc) : '',
        nextOccurrenceISO: nextOcc ? formatDateISO(nextOcc) : '',
        isDue: true,
        dueRank: sameDay(nextOcc, today) ? 0 : 1,
        notes: r.Notes || '',
      });
    }
  });

  dueRecurring.sort((a, b) => a.dueRank !== b.dueRank ? a.dueRank - b.dueRank : a.task.localeCompare(b.task));

  // Process QC tasks
  const qcTasks = qcResult.recordset.map((r, i) => ({
    source: 'QC',
    rowNum: r.ID,
    task: r.Task || '',
    priority: r.Priority || '',
    batchType: r.BatchType || '',
    slStatus: r.SLStatus || 'Scheduled',
    schedDate: r.SchedDate || '',
    schedTime: r.SchedTimeFrom || '',
    notes: r.Notes || '',
    sdNum: i + 1,
  }));

  // Build unified list
  const unified = [];
  let schNum = 0, waitNum = 0, seq = 0;

  dueRecurring.forEach(rt => {
    seq++;
    const isScheduled = rt.slStatus === 'Scheduled';
    const isWaiting = rt.slStatus === 'Waiting';
    if (isScheduled) schNum++;
    if (isWaiting) waitNum++;

    let finalStatus = rt.slStatus;
    const doneKey = 'RT|' + rt.rowNum;
    if (doneFlags[doneKey] === 'Yes') finalStatus = 'Completed';

    const rtTime = rt.timeSlot || '';
    unified.push({
      seq, source: 'RT', rowNum: rt.rowNum, task: rt.task,
      priority: rt.priority, batchType: rt.batchType,
      baseStatus: rt.slStatus, finalStatus,
      schNum: isScheduled ? schNum : null,
      waitNum: isWaiting ? waitNum : null,
      schedDate: rt.nextOccurrenceISO || '',
      schedTime: rtTime,
      timeKey: rt.nextOccurrenceISO ? rt.nextOccurrenceISO + '|' + rtTime : '',
      frequency: rt.frequency, nextOccurrence: rt.nextOccurrence,
      isDue: true, notes: rt.notes, nwRank: 0,
    });
  });

  qcTasks.forEach(qc => {
    seq++;
    const isScheduled = qc.slStatus === 'Scheduled';
    const isWaiting = qc.slStatus === 'Waiting';
    if (isScheduled) schNum++;
    if (isWaiting) waitNum++;

    let finalStatus = qc.slStatus;
    const doneKey = 'QC|' + qc.rowNum;
    if (doneFlags[doneKey] === 'Yes') finalStatus = 'Completed';

    const timeKey = qc.schedDate ? (qc.schedDate + '|' + (qc.schedTime || '')) : '';

    unified.push({
      seq, source: 'QC', rowNum: qc.rowNum, task: qc.task,
      priority: qc.priority, batchType: qc.batchType,
      baseStatus: qc.slStatus, finalStatus,
      schNum: isScheduled ? schNum : null,
      waitNum: isWaiting ? waitNum : null,
      schedDate: qc.schedDate, schedTime: qc.schedTime || '',
      timeKey, frequency: '', nextOccurrence: '',
      isDue: false, notes: qc.notes, nwRank: qc.sdNum,
    });
  });

  return {
    success: true,
    arc: dueRecurring.length,
    totalScheduled: schNum,
    totalWaiting: waitNum,
    totalTasks: unified.length,
    tasks: unified,
  };
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
    const result = new Date(today); result.setDate(result.getDate() + diff);
    return result;
  }
  if (freq === 'Monthly') {
    const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const targetDayIdx = dayNames.indexOf(weekday);
    if (targetDayIdx < 0) return null;
    const jsDayTarget = (targetDayIdx + 1) % 7;
    const posMap = { First:1, Second:2, Third:3, Fourth:4, Last:99 };
    const posNum = posMap[weekPos] || 1;
    for (let mOff = 0; mOff <= 2; mOff++) {
      let year = today.getFullYear(), month = today.getMonth() + mOff;
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
  if (freq === 'Fixed Date') return parseLocalDate(fixedDate);
  return null;
}

function findNthWeekdayInMonth(year, month, jsDayTarget, posNum) {
  if (posNum === 99) {
    const lastDay = new Date(year, month + 1, 0);
    const diff = (lastDay.getDay() - jsDayTarget + 7) % 7;
    const result = new Date(year, month, lastDay.getDate() - diff);
    result.setHours(0,0,0,0); return result;
  }
  const first = new Date(year, month, 1);
  const offset = (jsDayTarget - first.getDay() + 7) % 7;
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

function formatDateISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function formatDateDD(d) {
  return String(d.getDate()).padStart(2,'0') + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear();
}

function formatTimeNow(d) {
  let h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return h + ':' + String(m).padStart(2,'0') + ' ' + ap;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

module.exports = router;
module.exports.computeSomedayList = computeSomedayList;
