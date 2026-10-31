const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/debts
 * Returns all debts with calculated total_paid and balance_remaining
 */
router.get('/', async (req, res, next) => {
  try {
    const { direction } = req.query;
    let query = `
      SELECT
        d.id,
        d.person_name,
        d.direction,
        d.principal,
        d.debt_date,
        d.due_date,
        d.note,
        d.created_at,
        COALESCE(SUM(r.amount), 0) AS total_repaid,
        ROUND(d.principal - COALESCE(SUM(r.amount), 0), 2) AS remaining_balance
      FROM debts d
      LEFT JOIN debt_repayments r ON d.id = r.debt_id AND d.user_id = r.user_id
      WHERE d.user_id = ?
    `;
    const params = [req.user.id];

    if (direction && ['I_OWE', 'OWED_TO_ME'].includes(direction)) {
      query += ' AND d.direction = ?';
      params.push(direction);
    }

    query += ' GROUP BY d.id ORDER BY d.debt_date DESC, d.id DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/debts
 */
router.post('/', async (req, res, next) => {
  try {
    const { person_name, direction, principal, debt_date, due_date, note } = req.body;

    if (!person_name || typeof person_name !== 'string' || !person_name.trim()) {
      return res.status(400).json({ error: 'Person name is required' });
    }

    if (!['I_OWE', 'OWED_TO_ME'].includes(direction)) {
      return res.status(400).json({ error: "Direction must be either 'I_OWE' or 'OWED_TO_ME'" });
    }

    const numPrincipal = parseFloat(principal);
    if (isNaN(numPrincipal) || numPrincipal <= 0) {
      return res.status(400).json({ error: 'Principal amount must be greater than zero' });
    }

    if (!debt_date || !/^\d{4}-\d{2}-\d{2}$/.test(debt_date)) {
      return res.status(400).json({ error: 'Valid debt date (YYYY-MM-DD) is required' });
    }

    const validDueDate = (due_date && /^\d{4}-\d{2}-\d{2}$/.test(due_date)) ? due_date : null;
    const trimmedPerson = person_name.trim().substring(0, 100);
    const trimmedNote = note ? String(note).trim().substring(0, 255) : null;

    const [result] = await pool.query(
      `INSERT INTO debts (user_id, person_name, direction, principal, debt_date, due_date, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, trimmedPerson, direction, numPrincipal, debt_date, validDueDate, trimmedNote]
    );

    res.status(201).json({
      id: result.insertId,
      person_name: trimmedPerson,
      direction,
      principal: numPrincipal.toFixed(2),
      debt_date,
      due_date: validDueDate,
      note: trimmedNote,
      total_repaid: '0.00',
      remaining_balance: numPrincipal.toFixed(2)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/debts/:id
 */
router.put('/:id', async (req, res, next) => {
  try {
    const debtId = parseInt(req.params.id, 10);
    const { person_name, direction, principal, debt_date, due_date, note } = req.body;

    if (isNaN(debtId)) {
      return res.status(400).json({ error: 'Invalid debt ID' });
    }

    if (!person_name || typeof person_name !== 'string' || !person_name.trim()) {
      return res.status(400).json({ error: 'Person name is required' });
    }

    if (!['I_OWE', 'OWED_TO_ME'].includes(direction)) {
      return res.status(400).json({ error: "Direction must be either 'I_OWE' or 'OWED_TO_ME'" });
    }

    const numPrincipal = parseFloat(principal);
    if (isNaN(numPrincipal) || numPrincipal <= 0) {
      return res.status(400).json({ error: 'Principal amount must be greater than zero' });
    }

    if (!debt_date || !/^\d{4}-\d{2}-\d{2}$/.test(debt_date)) {
      return res.status(400).json({ error: 'Valid debt date (YYYY-MM-DD) is required' });
    }

    const validDueDate = (due_date && /^\d{4}-\d{2}-\d{2}$/.test(due_date)) ? due_date : null;
    const trimmedPerson = person_name.trim().substring(0, 100);
    const trimmedNote = note ? String(note).trim().substring(0, 255) : null;

    const [result] = await pool.query(
      `UPDATE debts
       SET person_name = ?, direction = ?, principal = ?, debt_date = ?, due_date = ?, note = ?
       WHERE id = ? AND user_id = ?`,
      [trimmedPerson, direction, numPrincipal, debt_date, validDueDate, trimmedNote, debtId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Debt not found or access denied' });
    }

    res.json({
      id: debtId,
      person_name: trimmedPerson,
      direction,
      principal: numPrincipal.toFixed(2),
      debt_date,
      due_date: validDueDate,
      note: trimmedNote
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/debts/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const debtId = parseInt(req.params.id, 10);
    if (isNaN(debtId)) {
      return res.status(400).json({ error: 'Invalid debt ID' });
    }

    const [result] = await pool.query(
      'DELETE FROM debts WHERE id = ? AND user_id = ?',
      [debtId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Debt not found or access denied' });
    }

    res.json({ message: 'Debt deleted successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/debts/:id/repayments
 */
router.get('/:id/repayments', async (req, res, next) => {
  try {
    const debtId = parseInt(req.params.id, 10);
    if (isNaN(debtId)) {
      return res.status(400).json({ error: 'Invalid debt ID' });
    }

    // Verify ownership of debt first
    const [debt] = await pool.query('SELECT id FROM debts WHERE id = ? AND user_id = ?', [debtId, req.user.id]);
    if (debt.length === 0) {
      return res.status(404).json({ error: 'Debt not found or access denied' });
    }

    const [rows] = await pool.query(
      'SELECT id, debt_id, paid_on, amount, note, created_at FROM debt_repayments WHERE debt_id = ? AND user_id = ? ORDER BY paid_on DESC, id DESC',
      [debtId, req.user.id]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/debts/:id/repayments
 */
router.post('/:id/repayments', async (req, res, next) => {
  try {
    const debtId = parseInt(req.params.id, 10);
    if (isNaN(debtId)) {
      return res.status(400).json({ error: 'Invalid debt ID' });
    }

    const { paid_on, amount, note } = req.body;

    if (!paid_on || !/^\d{4}-\d{2}-\d{2}$/.test(paid_on)) {
      return res.status(400).json({ error: 'Valid repayment date (YYYY-MM-DD) is required' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Repayment amount must be greater than zero' });
    }

    // Ensure debt belongs to this user
    const [debts] = await pool.query('SELECT id, principal FROM debts WHERE id = ? AND user_id = ?', [debtId, req.user.id]);
    if (debts.length === 0) {
      return res.status(404).json({ error: 'Debt not found or access denied' });
    }

    const trimmedNote = note ? String(note).trim().substring(0, 255) : null;

    const [result] = await pool.query(
      `INSERT INTO debt_repayments (debt_id, user_id, paid_on, amount, note)
       VALUES (?, ?, ?, ?, ?)`,
      [debtId, req.user.id, paid_on, numAmount, trimmedNote]
    );

    res.status(201).json({
      id: result.insertId,
      debt_id: debtId,
      paid_on,
      amount: numAmount.toFixed(2),
      note: trimmedNote
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/debts/repayments/:repaymentId
 */
router.delete('/repayments/:repaymentId', async (req, res, next) => {
  try {
    const repaymentId = parseInt(req.params.repaymentId, 10);
    if (isNaN(repaymentId)) {
      return res.status(400).json({ error: 'Invalid repayment ID' });
    }

    const [result] = await pool.query(
      'DELETE FROM debt_repayments WHERE id = ? AND user_id = ?',
      [repaymentId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Repayment not found or access denied' });
    }

    res.json({ message: 'Repayment deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
