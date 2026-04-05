const express = require('express');
const router = express.Router();
const { query, sql } = require('../db');

// GET all quick capture tasks
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM QuickCapture ORDER BY ID ASC');
    const rows = result.recordset.map((r, i) => ({
      id: r.ID,
      _rowNum: r.ID,
      date: r.Date || '',
      time: r.Time || '',
      description: r.Task || '',
      priority: r.Priority || 'Medium',
      batchType: r.BatchType || '',
      sendTo: r.SendTo || 'Someday List',
      slStatus: r.SLStatus || 'Scheduled',
      schedDate: r.SchedDate || '',
      schedTimeFrom: r.SchedTimeFrom || '',
      schedTimeTo: r.SchedTimeTo || '',
      notes: r.Notes || '',
      deadline: r.Deadline || '',
      status: r.Status || 'Not Started',
      doneDate: r.DoneDate || '',
    }));

    // Compute SD# and IS#
    let sdCount = 0, isCount = 0;
    rows.forEach(r => {
      if (r.sendTo === 'Someday List') { sdCount++; r.sdNum = sdCount; }
      if (r.sendTo === 'Information System') { isCount++; r.isNum = isCount; }
    });

    res.json({ success: true, rows, totalRows: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST add task
router.post('/', async (req, res) => {
  try {
    const b = req.body;
    const now = new Date();
    const dateStr = b.date || formatDateISO(now);
    const timeStr = b.time || formatTimeNow(now);

    const result = await query(
      `INSERT INTO QuickCapture (Date, Time, Task, Priority, BatchType, SendTo, SLStatus, SchedDate, SchedTimeFrom, SchedTimeTo, Deadline, Notes, Status)
       OUTPUT INSERTED.ID
       VALUES (@date, @time, @task, @priority, @batchType, @sendTo, @slStatus, @schedDate, @schedTimeFrom, @schedTimeTo, @deadline, @notes, @status)`,
      {
        date: dateStr,
        time: timeStr,
        task: b.task || b.description || '',
        priority: b.priority || 'Medium',
        batchType: b.batchType || '',
        sendTo: b.sendTo || 'Someday List',
        slStatus: b.slStatus || 'Scheduled',
        schedDate: b.schedDate || '',
        schedTimeFrom: b.schedTimeFrom || b.timeSlot || '',
        schedTimeTo: b.schedTimeTo || '',
        deadline: b.deadline || '',
        notes: b.notes || '',
        status: b.status || 'Not Started',
      }
    );

    res.json({ success: true, id: result.recordset[0].ID, message: 'Task added' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update task
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const b = req.body;

    const sets = [];
    const params = { id };

    const fields = {
      Date: 'date', Time: 'time', Task: 'task', Priority: 'priority',
      BatchType: 'batchType', SendTo: 'sendTo', SLStatus: 'slStatus',
      SchedDate: 'schedDate', SchedTimeFrom: 'schedTimeFrom', SchedTimeTo: 'schedTimeTo',
      Deadline: 'deadline', Notes: 'notes', Status: 'status', DoneDate: 'doneDate',
    };

    // Also accept 'description' as 'task'
    if (b.description !== undefined && b.task === undefined) b.task = b.description;

    for (const [col, key] of Object.entries(fields)) {
      if (b[key] !== undefined) {
        sets.push(`${col} = @${key}`);
        params[key] = b[key];
      }
    }

    if (sets.length === 0) {
      return res.json({ success: true, message: 'No changes' });
    }

    await query(`UPDATE QuickCapture SET ${sets.join(', ')} WHERE ID = @id`, params);
    res.json({ success: true, id, message: 'Task updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE task
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await query('DELETE FROM QuickCapture WHERE ID = @id', { id });
    res.json({ success: true, id, message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function formatDateISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatTimeNow(d) {
  let h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return h + ':' + String(m).padStart(2, '0') + ' ' + ap;
}

module.exports = router;
