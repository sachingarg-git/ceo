const express = require('express');
const router = express.Router();
const { query } = require('../db');

router.get('/', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayISO = formatDateISO(today);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    // QC stats
    const qcAll = await query('SELECT * FROM QuickCapture');
    const qcData = qcAll.recordset;
    const qcTotal = qcData.length;
    let toSomeday = 0, toInfoSystem = 0, highPriority = 0;
    let scheduledToday = 0, waitingToday = 0, completedToday = 0, overdue = 0;

    qcData.forEach(r => {
      if (r.SendTo === 'Someday List') toSomeday++;
      if (r.SendTo === 'Information System') toInfoSystem++;
      if (r.Priority === 'High') highPriority++;

      if (r.SendTo === 'Someday List' && r.SchedDate) {
        if (r.SchedDate === todayISO) {
          if (r.SLStatus === 'Scheduled') scheduledToday++;
          if (r.SLStatus === 'Waiting') waitingToday++;
          if (r.SLStatus === 'Completed') completedToday++;
        }
        if (r.SchedDate < todayISO && r.SLStatus !== 'Completed' && r.SLStatus !== 'Cancelled') {
          overdue++;
        }
      }
    });

    // RT stats
    const rtAll = await query('SELECT * FROM RecurringTasks');
    const rtData = rtAll.recordset;
    const rtTotal = rtData.length;
    let rtActive = 0, rtPaused = 0, rtDueToday = 0, rtDueTomorrow = 0;

    rtData.forEach(r => {
      if (r.Status === 'Active') rtActive++;
      if (r.Status === 'Paused') rtPaused++;
      if (r.Status === 'Active') {
        const nextOcc = computeNextOccurrence(r.Frequency, r.Weekday, r.WeekPosition, r.FixedDate);
        if (nextOcc && sameDay(nextOcc, today)) rtDueToday++;
        if (nextOcc && sameDay(nextOcc, tomorrow)) rtDueTomorrow++;
      }
    });

    // SL stats
    const { computeSomedayList } = require('./schedule');
    const sl = await computeSomedayList();

    // Monthly report
    const drResult = await query("SELECT SLStatus FROM QuickCapture WHERE SendTo = 'Someday List' AND SchedDate IS NOT NULL AND SchedDate != ''");
    let mTotalSch = 0, mTotalComp = 0;
    drResult.recordset.forEach(r => {
      const slSt = r.SLStatus || '';
      if (slSt === 'Scheduled' || slSt === 'Completed') { mTotalSch++; if (slSt === 'Completed') mTotalComp++; }
    });

    res.json({
      success: true,
      quickCapture: { total: qcTotal, toSomeday, toInfoSystem, highPriority },
      somedayList: { total: sl.totalTasks, scheduledToday, waiting: waitingToday, completed: completedToday, overdue },
      today: { scheduled: scheduledToday, waiting: waitingToday },
      recurringTasks: { total: rtTotal, active: rtActive, paused: rtPaused, dueToday: rtDueToday, dueTomorrow: rtDueTomorrow },
      monthlyReport: { daysTracked: 0, avgCompletion: 0 },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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
  return null;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

module.exports = router;
