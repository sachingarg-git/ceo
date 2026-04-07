const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/daily-report
router.get('/daily-report', async (req, res) => {
  try {
    const companyId = req.companyId;
    const today = new Date(); today.setHours(0,0,0,0);
    const days = [];

    // Get all DR data
    const drResult = await query('SELECT * FROM DailyReport WHERE CompanyID = @companyId ORDER BY Date DESC', { companyId });
    const drMap = {};
    drResult.recordset.forEach(r => { drMap[r.Date] = r; });

    // Get QC data for counts
    const qcResult = await query("SELECT * FROM QuickCapture WHERE SendTo = 'Someday List' AND CompanyID = @companyId", { companyId });

    let totalScheduled = 0, totalCompleted = 0, totalDays = 0, daysAbove80 = 0, daysBelow50 = 0;

    for (let i = 0; i < 30; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const dISO = formatDateISO(d);

      let scheduled = 0, completed = 0, waitCount = 0;
      qcResult.recordset.forEach(r => {
        if (r.SchedDate !== dISO) return;
        const slSt = r.SLStatus || '';
        if (slSt === 'Scheduled' || slSt === 'Completed') {
          scheduled++;
          if (slSt === 'Completed') completed++;
        }
        if (slSt === 'Waiting') waitCount++;
      });

      const pct = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;
      totalScheduled += scheduled;
      totalCompleted += completed;
      if (scheduled > 0) {
        totalDays++;
        if (pct >= 80) daysAbove80++;
        if (pct < 50) daysBelow50++;
      }

      const manual = drMap[dISO] || {};

      days.push({
        date: dISO,
        dateFormatted: formatDateDD(d),
        scheduled,
        completed,
        completionPct: pct,
        waiting: waitCount,
        dayRating: manual.DayRating || '',
        achievements: manual.Achievements || '',
        notes: manual.Notes || '',
        rowNum: manual.ID || 0,
      });
    }

    const overallPct = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;
    const avgPerDay = totalDays > 0 ? Math.round(totalScheduled / totalDays * 10) / 10 : 0;

    res.json({
      success: true,
      days,
      monthlySummary: {
        totalScheduled, totalCompleted,
        overallCompletionPct: overallPct,
        avgTasksPerDay: avgPerDay,
        daysTracked: totalDays,
        daysAbove80Pct: daysAbove80,
        daysBelow50Pct: daysBelow50,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/daily-report
router.post('/daily-report', async (req, res) => {
  try {
    const b = req.body;
    const companyId = req.companyId;
    const dateStr = b.date || formatDateISO(new Date());

    const existing = await query('SELECT ID FROM DailyReport WHERE Date = @date AND CompanyID = @companyId', { date: dateStr, companyId });

    if (existing.recordset.length > 0) {
      const sets = [];
      const params = { id: existing.recordset[0].ID, companyId };
      if (b.dayRating !== undefined) { sets.push('DayRating = @dayRating'); params.dayRating = b.dayRating; }
      if (b.achievements !== undefined) { sets.push('Achievements = @achievements'); params.achievements = b.achievements; }
      if (b.notes !== undefined) { sets.push('Notes = @notes'); params.notes = b.notes; }
      if (b.scheduled !== undefined) { sets.push('Scheduled = @scheduled'); params.scheduled = b.scheduled; }
      if (b.completed !== undefined) { sets.push('Completed = @completed'); params.completed = b.completed; }
      if (b.completionPct !== undefined) { sets.push('CompletionPct = @completionPct'); params.completionPct = b.completionPct; }
      if (b.waiting !== undefined) { sets.push('Waiting = @waiting'); params.waiting = b.waiting; }
      if (sets.length > 0) {
        await query(`UPDATE DailyReport SET ${sets.join(', ')} WHERE ID = @id AND CompanyID = @companyId`, params);
      }
    } else {
      await query(
        `INSERT INTO DailyReport (Date, DayRating, Scheduled, Completed, CompletionPct, Waiting, Achievements, Notes, CompanyID)
         VALUES (@date, @dayRating, @scheduled, @completed, @completionPct, @waiting, @achievements, @notes, @companyId)`,
        {
          date: dateStr,
          dayRating: b.dayRating || '',
          scheduled: b.scheduled || 0,
          completed: b.completed || 0,
          completionPct: b.completionPct || 0,
          waiting: b.waiting || 0,
          achievements: b.achievements || '',
          notes: b.notes || '',
          companyId,
        }
      );
    }
    res.json({ success: true, message: 'Daily report updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/weekly-scorecard
router.get('/weekly-scorecard', async (req, res) => {
  try {
    const companyId = req.companyId;
    const year = new Date().getFullYear();
    const march1 = new Date(year, 2, 1);
    const march1Day = (march1.getDay() + 6) % 7;
    const week1Start = new Date(march1);
    week1Start.setDate(march1.getDate() - march1Day);
    week1Start.setHours(0,0,0,0);

    // WS manual data
    const wsResult = await query('SELECT * FROM WeeklyScorecard WHERE CompanyID = @companyId ORDER BY WeekNum ASC', { companyId });
    const wsMap = {};
    wsResult.recordset.forEach(r => { wsMap[r.WeekNum] = r; });

    // QC data
    const qcResult = await query("SELECT SchedDate, SLStatus FROM QuickCapture WHERE SendTo = 'Someday List' AND CompanyID = @companyId", { companyId });

    // DR data for ratings
    const drResult = await query('SELECT Date, DayRating FROM DailyReport WHERE CompanyID = @companyId', { companyId });
    const drRatingMap = {};
    drResult.recordset.forEach(r => { drRatingMap[r.Date] = r.DayRating; });

    const ratingValues = { Excellent: 5, Good: 4, Average: 3, Poor: 2, Bad: 1 };
    const weeks = [];

    for (let wk = 1; wk <= 44; wk++) {
      const wkStart = new Date(week1Start);
      wkStart.setDate(wkStart.getDate() + (wk - 1) * 7);
      const wkEnd = new Date(wkStart);
      wkEnd.setDate(wkEnd.getDate() + 6);
      wkEnd.setHours(23,59,59,999);

      const wkStartISO = formatDateISO(wkStart);
      const wkEndISO = formatDateISO(wkEnd);

      let planned = 0, done = 0;
      qcResult.recordset.forEach(r => {
        if (!r.SchedDate || r.SchedDate < wkStartISO || r.SchedDate > wkEndISO) return;
        const slSt = r.SLStatus || '';
        if (slSt === 'Scheduled' || slSt === 'Completed') {
          planned++;
          if (slSt === 'Completed') done++;
        }
      });

      const completionPct = planned > 0 ? Math.round((done / planned) * 100) : 0;

      let ratingSum = 0, ratingCount = 0;
      for (let di = 0; di < 7; di++) {
        const dd = new Date(wkStart); dd.setDate(dd.getDate() + di);
        const ddISO = formatDateISO(dd);
        const rating = drRatingMap[ddISO];
        if (rating && ratingValues[rating]) { ratingSum += ratingValues[rating]; ratingCount++; }
      }
      const avgRating = ratingCount > 0 ? Math.round(ratingSum / ratingCount * 10) / 10 : 0;

      const manual = wsMap[wk] || {};

      weeks.push({
        weekNum: wk,
        startDate: formatDateDD(wkStart),
        startDateISO: wkStartISO,
        endDate: formatDateDD(wkEnd),
        endDateISO: wkEndISO,
        planned, done, completionPct, avgDayRating: avgRating,
        achievements: manual.Achievements || '',
        carryForward: manual.CarryForward || '',
        rowNum: manual.ID || 0,
      });
    }

    res.json({ success: true, year, totalWeeks: 44, weeks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/weekly-scorecard
router.post('/weekly-scorecard', async (req, res) => {
  try {
    const b = req.body;
    const companyId = req.companyId;
    const weekNum = parseInt(b.weekNum);
    if (!weekNum) return res.json({ success: false, error: 'Invalid week number' });

    const existing = await query('SELECT ID FROM WeeklyScorecard WHERE WeekNum = @weekNum AND CompanyID = @companyId', { weekNum, companyId });

    if (existing.recordset.length > 0) {
      const sets = [];
      const params = { id: existing.recordset[0].ID, companyId };
      if (b.achievements !== undefined) { sets.push('Achievements = @achievements'); params.achievements = b.achievements; }
      if (b.carryForward !== undefined) { sets.push('CarryForward = @carryForward'); params.carryForward = b.carryForward; }
      if (sets.length > 0) {
        await query(`UPDATE WeeklyScorecard SET ${sets.join(', ')} WHERE ID = @id AND CompanyID = @companyId`, params);
      }
    } else {
      await query(
        `INSERT INTO WeeklyScorecard (WeekNum, StartDate, EndDate, Planned, Done, CompletionPct, AvgDayRating, Achievements, CarryForward, CompanyID)
         VALUES (@weekNum, @startDate, @endDate, @planned, @done, @completionPct, @avgDayRating, @achievements, @carryForward, @companyId)`,
        {
          weekNum,
          startDate: b.startDate || '',
          endDate: b.endDate || '',
          planned: b.planned || 0,
          done: b.done || 0,
          completionPct: b.completionPct || 0,
          avgDayRating: b.avgDayRating || 0,
          achievements: b.achievements || '',
          carryForward: b.carryForward || '',
          companyId,
        }
      );
    }
    res.json({ success: true, message: 'Weekly scorecard updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/next-week-plan
router.get('/next-week-plan', async (req, res) => {
  try {
    const companyId = req.companyId;
    const weekOffset = parseInt(req.query.weekOffset) || 0;
    const today = new Date(); today.setHours(0,0,0,0);
    const currentDay = (today.getDay() + 6) % 7; // 0=Mon
    // weekOffset=0 means current week (Monday of this week)
    const thisMon = new Date(today); thisMon.setDate(thisMon.getDate() - currentDay);
    const nextMon = new Date(thisMon); nextMon.setDate(nextMon.getDate() + (weekOffset * 7));

    const TIME_SLOTS = [
      '7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM',
      '10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM',
      '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM',
      '4:00 PM','4:30 PM','5:00 PM','5:30 PM','6:00 PM','6:30 PM','7:00 PM',
      '7:30 PM','8:00 PM','8:30 PM','9:00 PM','9:30 PM','10:00 PM','10:30 PM','11:00 PM','11:30 PM'
    ];

    const weekDates = [];
    for (let d = 0; d < 6; d++) {
      const dd = new Date(nextMon); dd.setDate(dd.getDate() + d);
      weekDates.push({
        date: formatDateDD(dd),
        dateISO: formatDateISO(dd),
        dayName: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d],
      });
    }

    // Get someday list
    const { computeSomedayList } = require('./schedule');
    const sl = await computeSomedayList(companyId);
    const tasks = sl.tasks || [];

    const grid = weekDates.map(wd => {
      return TIME_SLOTS.map(slot => {
        const slotKey = wd.dateISO + '|' + slot;
        const matchedTask = tasks.find(t => t.timeKey === slotKey) || null;
        return { time: slot, timeKey: slotKey, task: matchedTask };
      });
    });

    const nwStartISO = weekDates[0].dateISO;
    const nwEndISO = weekDates[5].dateISO;
    const unscheduled = tasks
      .filter(t => t.schedDate >= nwStartISO && t.schedDate <= nwEndISO && (!t.schedTime || t.schedTime === ''))
      .slice(0, 15)
      .sort((a, b) => (a.nwRank || 0) - (b.nwRank || 0));

    res.json({ success: true, weekDates, grid, unscheduled });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function formatDateISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function formatDateDD(d) {
  return String(d.getDate()).padStart(2,'0') + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear();
}

module.exports = router;
