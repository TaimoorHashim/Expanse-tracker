const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/received
 * Query params: month (YYYY-MM), source, startDate, endDate
 */
router.get('/', async (req, res, next) => {
  try {
    const { month, source, startDate, endDate } = req.query;
    let query = 'SELECT id, received_date, source, note, amount, created_at FROM money_received WHERE user_id = ?';
    const params = [req.user.id];

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      query += ' AND received_date >= ? AND received_date < ?';
      const [year, m] = month.split('-').map(Number);
      const nextMonthYear = m === 12 ? year + 1 : year;
      const nextMonth = m === 12 ? 1 : m + 1;
      const start = `${year}-${String(m).padStart(2, '0')}-01`;
      const end = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;
      params.push(start, end);
    } else if (startDate && endDate) {
      query += ' AND received_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    if (source) {
      query += ' AND source LIKE ?';
      params.push(`%${source}%`);
    }

    query += ' ORDER BY received_date DESC, id DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/received
 */
router.post('/', async (req, res, next) => {
  try {
    const { received_date, source, note, amount } = req.body;

    if (!received_date || !/^\d{4}-\d{2}-\d{2}$/.test(received_date)) {
      return res.status(400).json({ error: 'Valid received date (YYYY-MM-DD) is required' });
    }

    if (!source || typeof source !== 'string' || !source.trim()) {
      return res.status(400).json({ error: 'Source is required' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero' });
    }

    const trimmedSource = source.trim().substring(0, 100);
    const trimmedNote = note ? String(note).trim().substring(0, 255) : null;

    const [result] = await pool.query(
      `INSERT INTO money_received (user_id, received_date, source, note, amount)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, received_date, trimmedSource, trimmedNote, numAmount]
    );

    res.status(201).json({
      id: result.insertId,
      received_date,
      source: trimmedSource,
      note: trimmedNote,
      amount: numAmount.toFixed(2)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/received/:id
 */
router.put('/:id', async (req, res, next) => {
  try {
    const receivedId = parseInt(req.params.id, 10);
    const { received_date, source, note, amount } = req.body;

    if (isNaN(receivedId)) {
      return res.status(400).json({ error: 'Invalid received entry ID' });
    }

    if (!received_date || !/^\d{4}-\d{2}-\d{2}$/.test(received_date)) {
      return res.status(400).json({ error: 'Valid received date (YYYY-MM-DD) is required' });
    }

    if (!source || typeof source !== 'string' || !source.trim()) {
      return res.status(400).json({ error: 'Source is required' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero' });
    }

    const trimmedSource = source.trim().substring(0, 100);
    const trimmedNote = note ? String(note).trim().substring(0, 255) : null;

    const [result] = await pool.query(
      `UPDATE money_received
       SET received_date = ?, source = ?, note = ?, amount = ?
       WHERE id = ? AND user_id = ?`,
      [received_date, trimmedSource, trimmedNote, numAmount, receivedId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Entry not found or access denied' });
    }

    res.json({
      id: receivedId,
      received_date,
      source: trimmedSource,
      note: trimmedNote,
      amount: numAmount.toFixed(2)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/received/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const receivedId = parseInt(req.params.id, 10);
    if (isNaN(receivedId)) {
      return res.status(400).json({ error: 'Invalid entry ID' });
    }

    const [result] = await pool.query(
      'DELETE FROM money_received WHERE id = ? AND user_id = ?',
      [receivedId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Entry not found or access denied' });
    }

    res.json({ message: 'Entry deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
