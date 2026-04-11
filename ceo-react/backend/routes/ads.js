const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/ads/active — get the currently active ad (public, for company users)
router.get('/active', async (req, res) => {
  try {
    const result = await query(
      `SELECT TOP 1 * FROM InternalAds WHERE IsActive = 1 ORDER BY CreatedAt DESC`
    );
    if (result.recordset.length === 0) {
      return res.json({ success: true, ad: null });
    }
    res.json({ success: true, ad: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ads — all ads (CEO admin)
router.get('/', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM InternalAds ORDER BY CreatedAt DESC`);
    res.json({ success: true, ads: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ads — create new ad
router.post('/', async (req, res) => {
  try {
    const { content, bgColor, textColor, speed, fontSize, fontWeight } = req.body;
    if (!content) return res.json({ success: false, error: 'Content is required' });
    await query(
      `INSERT INTO InternalAds (Content, IsActive, BgColor, TextColor, Speed, FontSize, FontWeight, CreatedBy)
       VALUES (@content, 0, @bgColor, @textColor, @speed, @fontSize, @fontWeight, @createdBy)`,
      {
        content,
        bgColor: bgColor || '#1e293b',
        textColor: textColor || '#ffffff',
        speed: parseInt(speed) || 40,
        fontSize: parseInt(fontSize) || 13,
        fontWeight: fontWeight || 'normal',
        createdBy: req.body.createdBy || 'ceo',
      }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/ads/:id — update ad content/style
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, bgColor, textColor, speed, fontSize, fontWeight } = req.body;
    await query(
      `UPDATE InternalAds SET
        Content = @content, BgColor = @bgColor, TextColor = @textColor,
        Speed = @speed, FontSize = @fontSize, FontWeight = @fontWeight
       WHERE ID = @id`,
      {
        id,
        content: content || '',
        bgColor: bgColor || '#1e293b',
        textColor: textColor || '#ffffff',
        speed: parseInt(speed) || 40,
        fontSize: parseInt(fontSize) || 13,
        fontWeight: fontWeight || 'normal',
      }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/ads/:id/activate — set this ad as the active one (deactivates others)
router.patch('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    // Deactivate all ads first
    await query(`UPDATE InternalAds SET IsActive = 0`);
    if (isActive) {
      await query(`UPDATE InternalAds SET IsActive = 1 WHERE ID = @id`, { id });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/ads/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM InternalAds WHERE ID = @id', { id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
