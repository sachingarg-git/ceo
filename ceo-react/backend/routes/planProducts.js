const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/plan-products — CEO sees all, companies see only published
router.get('/', async (req, res) => {
  try {
    const companyId = req.companyId; // 0 for CEO, >0 for companies
    const sql = companyId > 0
      ? `SELECT * FROM PlanProducts WHERE IsPublished = 1 ORDER BY SortOrder, Price`
      : `SELECT * FROM PlanProducts ORDER BY SortOrder, CreatedAt DESC`;
    const result = await query(sql);
    res.json({ success: true, products: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/plan-products — CEO creates a plan product
router.post('/', async (req, res) => {
  try {
    const { name, durationDays, price, features, sortOrder } = req.body;
    if (!name) return res.json({ success: false, error: 'Name is required' });
    await query(
      `INSERT INTO PlanProducts (Name, DurationDays, Price, Features, SortOrder, CreatedBy)
       VALUES (@name, @durationDays, @price, @features, @sortOrder, @createdBy)`,
      {
        name,
        durationDays: parseInt(durationDays) || 300,
        price: parseFloat(price) || 0,
        features: features || '',
        sortOrder: parseInt(sortOrder) || 0,
        createdBy: req.body.createdBy || 'ceo',
      }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/plan-products/:id — update (name, price, duration, publish toggle)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, durationDays, price, features, isPublished, sortOrder } = req.body;
    await query(
      `UPDATE PlanProducts SET
        Name = @name,
        DurationDays = @durationDays,
        Price = @price,
        Features = @features,
        IsPublished = @isPublished,
        SortOrder = @sortOrder
       WHERE ID = @id`,
      {
        id,
        name: name || 'Plan',
        durationDays: parseInt(durationDays) || 300,
        price: parseFloat(price) || 0,
        features: features || '',
        isPublished: isPublished ? 1 : 0,
        sortOrder: parseInt(sortOrder) || 0,
      }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/plan-products/:id/publish — toggle publish state
router.patch('/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublished } = req.body;
    await query(
      `UPDATE PlanProducts SET IsPublished = @isPublished WHERE ID = @id`,
      { id, isPublished: isPublished ? 1 : 0 }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/plan-products/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM PlanProducts WHERE ID = @id', { id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/plan-products/:id/activate — company user activates a published plan
router.post('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    if (!companyId || companyId === 0) {
      return res.json({ success: false, error: 'Company ID required' });
    }

    // Get the plan product
    const prodRes = await query(
      `SELECT * FROM PlanProducts WHERE ID = @id AND IsPublished = 1`,
      { id }
    );
    if (prodRes.recordset.length === 0) {
      return res.json({ success: false, error: 'Plan not found or not published' });
    }
    const prod = prodRes.recordset[0];

    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = (() => {
      const d = new Date(startDate + 'T00:00:00');
      d.setDate(d.getDate() + prod.DurationDays);
      return d.toISOString().slice(0, 10);
    })();

    // Deactivate existing plans
    await query(
      `UPDATE CompanyPlans SET IsActive = 0 WHERE CompanyID = @companyId AND IsActive = 1`,
      { companyId }
    );

    // Insert new plan
    await query(
      `INSERT INTO CompanyPlans (CompanyID, PlanName, TotalDays, StartDate, EndDate, CreatedBy, IsActive, Notes, Amount)
       VALUES (@companyId, @planName, @totalDays, @startDate, @endDate, 'company', 1, @notes, @amount)`,
      {
        companyId,
        planName: prod.Name,
        totalDays: prod.DurationDays,
        startDate,
        endDate,
        notes: `Activated from plan products`,
        amount: prod.Price,
      }
    );

    const daysLeft = prod.DurationDays; // just activated
    res.json({ success: true, endDate, daysLeft });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
