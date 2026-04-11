const express = require('express');
const router = express.Router();
const { query } = require('../db');

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysLeft(endDate) {
  if (!endDate) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end   = new Date(endDate + 'T00:00:00');
  const diff  = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

// GET /api/plans/my — company's own active plan
router.get('/my', async (req, res) => {
  try {
    const companyId = req.companyId;
    const result = await query(
      `SELECT TOP 1 * FROM CompanyPlans WHERE CompanyID = @companyId AND IsActive = 1 ORDER BY CreatedAt DESC`,
      { companyId }
    );
    if (result.recordset.length === 0) {
      return res.json({ success: true, plan: null, daysLeft: 0, expired: false });
    }
    const plan = result.recordset[0];
    const left = daysLeft(plan.EndDate);
    res.json({ success: true, plan, daysLeft: left, expired: left <= 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/plans — all plans (CEO admin only)
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT p.*, c.LegalName AS CompanyName, c.TradeName, c.Username AS CompanyUsername
      FROM CompanyPlans p
      LEFT JOIN Companies c ON c.ID = p.CompanyID
      ORDER BY p.CreatedAt DESC
    `);
    const plans = result.recordset.map(p => ({
      ...p,
      daysLeft: daysLeft(p.EndDate),
      expired: daysLeft(p.EndDate) <= 0,
    }));
    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/plans — create plan for a company (CEO admin)
router.post('/', async (req, res) => {
  try {
    const { companyId, planName, totalDays, startDate, notes, amount } = req.body;
    if (!companyId || !startDate) {
      return res.json({ success: false, error: 'companyId and startDate are required' });
    }
    const days      = parseInt(totalDays) || 300;
    const endDate   = addDays(startDate, days);
    const createdBy = req.body.createdBy || 'ceo';
    const amt       = parseFloat(amount) || 0;

    // Deactivate old active plans for this company
    await query(
      `UPDATE CompanyPlans SET IsActive = 0 WHERE CompanyID = @companyId AND IsActive = 1`,
      { companyId }
    );

    await query(
      `INSERT INTO CompanyPlans (CompanyID, PlanName, TotalDays, StartDate, EndDate, CreatedBy, IsActive, Notes, Amount)
       VALUES (@companyId, @planName, @days, @startDate, @endDate, @createdBy, 1, @notes, @amt)`,
      { companyId, planName: planName || 'Standard Plan', days, startDate, endDate, createdBy, notes: notes || '', amt }
    );
    res.json({ success: true, endDate, daysLeft: daysLeft(endDate) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/plans/:id — update plan (CEO admin)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { planName, totalDays, startDate, isActive, notes } = req.body;
    const days    = parseInt(totalDays) || 300;
    const endDate = startDate ? addDays(startDate, days) : null;

    let setClause = 'PlanName = @planName, TotalDays = @days, Notes = @notes';
    if (startDate) setClause += ', StartDate = @startDate, EndDate = @endDate';
    if (isActive !== undefined) setClause += ', IsActive = @isActive';

    await query(
      `UPDATE CompanyPlans SET ${setClause} WHERE ID = @id`,
      { id, planName: planName || 'Standard Plan', days, notes: notes || '', startDate, endDate, isActive: isActive ? 1 : 0 }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/plans/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM CompanyPlans WHERE ID = @id', { id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
