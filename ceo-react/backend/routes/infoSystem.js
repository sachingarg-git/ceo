const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET all info system entries
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM InformationSystem WHERE CompanyID = @companyId ORDER BY ID ASC', { companyId: req.companyId });
    const rows = result.recordset.map(r => ({
      id: r.ID,
      _rowNum: r.ID,
      sourceRow: r.SourceRow || r.ID,
      category: r.Category || '',
      title: r.Title || '',
      content: r.Content || '',
      notes: r.Notes || '',
      dateAdded: r.DateAdded || '',
    }));
    res.json({ success: true, rows, totalRows: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST add/update info system entry
router.post('/', async (req, res) => {
  try {
    const b = req.body;
    const companyId = req.companyId;
    const id = b.id || b.rowNum;

    if (id) {
      const sets = [];
      const params = { id: parseInt(id), companyId };
      if (b.category !== undefined) { sets.push('Category = @category'); params.category = b.category; }
      if (b.title !== undefined) { sets.push('Title = @title'); params.title = b.title; }
      if (b.content !== undefined) { sets.push('Content = @content'); params.content = b.content; }
      if (b.notes !== undefined) { sets.push('Notes = @notes'); params.notes = b.notes; }
      if (sets.length > 0) {
        await query(`UPDATE InformationSystem SET ${sets.join(', ')} WHERE ID = @id AND CompanyID = @companyId`, params);
      }
      res.json({ success: true, id: parseInt(id), message: 'Entry updated' });
    } else {
      const result = await query(
        `INSERT INTO InformationSystem (Category, Title, Content, Notes, DateAdded, CompanyID)
         OUTPUT INSERTED.ID
         VALUES (@category, @title, @content, @notes, @dateAdded, @companyId)`,
        {
          category: b.category || '',
          title: b.title || '',
          content: b.content || '',
          notes: b.notes || '',
          dateAdded: formatDateISO(new Date()),
          companyId,
        }
      );
      res.json({ success: true, id: result.recordset[0].ID, message: 'Entry added' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE info system entry
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await query('DELETE FROM InformationSystem WHERE ID = @id AND CompanyID = @companyId', { id, companyId: req.companyId });
    res.json({ success: true, id, message: 'Entry deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function formatDateISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

module.exports = router;
