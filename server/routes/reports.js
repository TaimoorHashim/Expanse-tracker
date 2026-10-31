const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/reports/summary
 * Query: ?month=YYYY-MM
 */
router.get('/summary', async (req, res, next) => {
  try {
    let month = req.query.month;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      const now = new Date();
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const [year, m] = month.split('-').map(Number);
    const nextMonthYear = m === 12 ? year + 1 : year;
    const nextMonth = m === 12 ? 1 : m + 1;
    const monthStart = `${year}-${String(m).padStart(2, '0')}-01`;
    const nextMonthStart = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const userId = req.user.id;

    // 1. Budget
    const [budgetRows] = await pool.query(
      'SELECT budget FROM monthly_finances WHERE user_id = ? AND month_start = ?',
      [userId, monthStart]
    );
    const budget = budgetRows.length > 0 ? parseFloat(budgetRows[0].budget) : 0;

    // 2. Expenses this month
    const [expenseSumRows] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_expenses, COUNT(*) AS count
       FROM expenses
       WHERE user_id = ? AND expense_date >= ? AND expense_date < ?`,
      [userId, monthStart, nextMonthStart]
    );
    const totalExpenses = parseFloat(expenseSumRows[0].total_expenses);
    const expenseCount = parseInt(expenseSumRows[0].count, 10);

    // 3. Money Received this month
    const [receivedSumRows] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_received, COUNT(*) AS count
       FROM money_received
       WHERE user_id = ? AND received_date >= ? AND received_date < ?`,
      [userId, monthStart, nextMonthStart]
    );
    const totalReceived = parseFloat(receivedSumRows[0].total_received);
    const receivedCount = parseInt(receivedSumRows[0].count, 10);

    // 4. Expenses by category this month
    const [categoryRows] = await pool.query(
      `SELECT category, SUM(amount) AS total, COUNT(*) AS count
       FROM expenses
       WHERE user_id = ? AND expense_date >= ? AND expense_date < ?
       GROUP BY category
       ORDER BY total DESC`,
      [userId, monthStart, nextMonthStart]
    );

    const categoryBreakdown = categoryRows.map(row => {
      const catTotal = parseFloat(row.total);
      return {
        category: row.category,
        total: catTotal.toFixed(2),
        count: row.count,
        percentage: totalExpenses > 0 ? ((catTotal / totalExpenses) * 100).toFixed(1) : '0.0'
      };
    });

    // 5. Debt Summary
    const [debtRows] = await pool.query(
      `SELECT
         d.direction,
         ROUND(SUM(d.principal - COALESCE(repaid.sum_paid, 0)), 2) AS remaining_total
       FROM debts d
       LEFT JOIN (
         SELECT debt_id, user_id, SUM(amount) AS sum_paid
         FROM debt_repayments
         GROUP BY debt_id, user_id
       ) repaid ON d.id = repaid.debt_id AND d.user_id = repaid.user_id
       WHERE d.user_id = ?
       GROUP BY d.direction`,
      [userId]
    );

    let totalIOwe = 0;
    let totalOwedToMe = 0;
    for (const d of debtRows) {
      const rem = parseFloat(d.remaining_total) || 0;
      if (d.direction === 'I_OWE') {
        totalIOwe = Math.max(0, rem);
      } else if (d.direction === 'OWED_TO_ME') {
        totalOwedToMe = Math.max(0, rem);
      }
    }

    res.json({
      month,
      budget: budget.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      remainingBudget: (budget - totalExpenses).toFixed(2),
      isOverBudget: totalExpenses > budget && budget > 0,
      totalReceived: totalReceived.toFixed(2),
      netSavings: (totalReceived - totalExpenses).toFixed(2),
      expenseCount,
      receivedCount,
      debts: {
        totalIOwe: totalIOwe.toFixed(2),
        totalOwedToMe: totalOwedToMe.toFixed(2),
        netDebtPosition: (totalOwedToMe - totalIOwe).toFixed(2)
      },
      categoryBreakdown
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
