const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/expenses
 * Query params: month (YYYY-MM), category, startDate, endDate
 */
router.get('/', async (req, res, next) => {
  try {
    const { month, category, startDate, endDate } = req.query;
    let query = 'SELECT id, expense_date, category, description, amount, created_at FROM expenses WHERE user_id = ?';
    const params = [req.user.id];

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      query += ' AND expense_date >= ? AND expense_date < ?';
      const [year, m] = month.split('-').map(Number);
      const nextMonthYear = m === 12 ? year + 1 : year;
      const nextMonth = m === 12 ? 1 : m + 1;
      const start = `${year}-${String(m).padStart(2, '0')}-01`;
      const end = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;
      params.push(start, end);
    } else if (startDate && endDate) {
      query += ' AND expense_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY expense_date DESC, id DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/expenses
 */
router.post('/', async (req, res, next) => {
  try {
    const { expense_date, category, description, amount } = req.body;

    if (!expense_date || !/^\d{4}-\d{2}-\d{2}$/.test(expense_date)) {
      return res.status(400).json({ error: 'Valid expense date (YYYY-MM-DD) is required' });
    }

    if (!category || typeof category !== 'string' || !category.trim()) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero' });
    }

    const trimmedCategory = category.trim().substring(0, 50);
    const trimmedDesc = description ? String(description).trim().substring(0, 255) : null;

    const [result] = await pool.query(
      `INSERT INTO expenses (user_id, expense_date, category, description, amount)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, expense_date, trimmedCategory, trimmedDesc, numAmount]
    );

    res.status(201).json({
      id: result.insertId,
      expense_date,
      category: trimmedCategory,
      description: trimmedDesc,
      amount: numAmount.toFixed(2)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/expenses/:id
 */
router.put('/:id', async (req, res, next) => {
  try {
    const expenseId = parseInt(req.params.id, 10);
    const { expense_date, category, description, amount } = req.body;

    if (isNaN(expenseId)) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    if (!expense_date || !/^\d{4}-\d{2}-\d{2}$/.test(expense_date)) {
      return res.status(400).json({ error: 'Valid expense date (YYYY-MM-DD) is required' });
    }

    if (!category || typeof category !== 'string' || !category.trim()) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero' });
    }

    const trimmedCategory = category.trim().substring(0, 50);
    const trimmedDesc = description ? String(description).trim().substring(0, 255) : null;

    const [result] = await pool.query(
      `UPDATE expenses
       SET expense_date = ?, category = ?, description = ?, amount = ?
       WHERE id = ? AND user_id = ?`,
      [expense_date, trimmedCategory, trimmedDesc, numAmount, expenseId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Expense not found or access denied' });
    }

    res.json({
      id: expenseId,
      expense_date,
      category: trimmedCategory,
      description: trimmedDesc,
      amount: numAmount.toFixed(2)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/expenses/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const expenseId = parseInt(req.params.id, 10);
    if (isNaN(expenseId)) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    const [result] = await pool.query(
      'DELETE FROM expenses WHERE id = ? AND user_id = ?',
      [expenseId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Expense not found or access denied' });
    }

    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
