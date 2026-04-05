const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET masters data grouped by type
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM Masters ORDER BY MasterType, SortOrder ASC');
    const grouped = {};
    result.recordset.forEach(r => {
      if (!grouped[r.MasterType]) grouped[r.MasterType] = [];
      grouped[r.MasterType].push(r.MasterValue);
    });
    res.json({ success: true, masters: grouped });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST update masters
router.post('/', async (req, res) => {
  try {
    const data = req.body.data;
    if (!data) return res.json({ success: false, error: 'No data provided' });

    // Clear and reseed
    await query('DELETE FROM Masters');

    for (const [type, values] of Object.entries(data)) {
      if (!Array.isArray(values)) continue;
      for (let i = 0; i < values.length; i++) {
        await query(
          'INSERT INTO Masters (MasterType, MasterValue, SortOrder) VALUES (@type, @value, @order)',
          { type, value: values[i], order: i }
        );
      }
    }

    res.json({ success: true, message: 'Masters updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
