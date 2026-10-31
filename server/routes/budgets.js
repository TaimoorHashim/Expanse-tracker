const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

/**
 * Normalizes input date/month string to YYYY-MM-01
 */
function normalizeMonthStart(monthStr) {
  if (!monthStr || typeof monthStr !== 'string') return null;
  const match = monthStr.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-01`;
}

/**
 * GET /api/budgets
 * Query: ?month=YYYY-MM (optional)
 */
router.get('/', async (req, res, next) => {
  try {
    const { month } = req.query;
    if (month) {
      const monthStart = normalizeMonthStart(month);
      if (!monthStart) {
        return res.status(400).json({ error: 'Invalid month format. Expected YYYY-MM' });
      }

      const [rows] = await pool.query(
        'SELECT id, month_start, budget FROM monthly_finances WHERE user_id = ? AND month_start = ?',
        [req.user.id, monthStart]
      );

      const budgetRow = rows[0] || { month_start: monthStart, budget: '0.00' };
      return res.json(budgetRow);
    }

    const [rows] = await pool.query(
      'SELECT id, month_start, budget FROM monthly_finances WHERE user_id = ? ORDER BY month_start DESC',
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/budgets
 * Body: { month: 'YYYY-MM', budget: 1500.00 }
 */
router.post('/', async (req, res, next) => {
  try {
    const { month, budget } = req.body;
    const monthStart = normalizeMonthStart(month);

    if (!monthStart) {
      return res.status(400).json({ error: 'Valid month (YYYY-MM) is required' });
    }

    const numBudget = parseFloat(budget);
    if (isNaN(numBudget) || numBudget < 0) {
      return res.status(400).json({ error: 'Budget must be a non-negative number' });
    }

    await pool.query(
      `INSERT INTO monthly_finances (user_id, month_start, budget)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE budget = VALUES(budget)`,
      [req.user.id, monthStart, numBudget]
    );

    res.status(200).json({
      message: 'Budget saved successfully',
      month_start: monthStart,
      budget: numBudget.toFixed(2)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
