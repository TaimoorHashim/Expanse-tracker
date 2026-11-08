const express = require('express');
const ExcelJS = require('exceljs');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/export
 * Generates an Excel spreadsheet with the user's data
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Family Expense & Debt Tracker';
    workbook.created = new Date();

    // 1. Expenses Sheet
    const expenseSheet = workbook.addWorksheet('Expenses');
    expenseSheet.columns = [
      { header: 'Date', key: 'expense_date', width: 14 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Description', key: 'description', width: 35 },
      { header: 'Amount (PKR)', key: 'amount', width: 16 }
    ];

    const [expenses] = await pool.query(
      'SELECT expense_date, category, description, amount FROM expenses WHERE user_id = ? ORDER BY expense_date DESC',
      [userId]
    );

    expenses.forEach(exp => {
      expenseSheet.addRow({
        expense_date: exp.expense_date,
        category: exp.category,
        description: exp.description || '',
        amount: parseFloat(exp.amount)
      });
    });

    // 2. Money Received Sheet
    const incomeSheet = workbook.addWorksheet('Money Received');
    incomeSheet.columns = [
      { header: 'Date', key: 'received_date', width: 14 },
      { header: 'Source', key: 'source', width: 25 },
      { header: 'Note', key: 'note', width: 35 },
      { header: 'Amount (PKR)', key: 'amount', width: 16 }
    ];

    const [income] = await pool.query(
      'SELECT received_date, source, note, amount FROM money_received WHERE user_id = ? ORDER BY received_date DESC',
      [userId]
    );

    income.forEach(inc => {
      incomeSheet.addRow({
        received_date: inc.received_date,
        source: inc.source,
        note: inc.note || '',
        amount: parseFloat(inc.amount)
      });
    });

    // 3. Debts Sheet
    const debtsSheet = workbook.addWorksheet('Debts');
    debtsSheet.columns = [
      { header: 'Person', key: 'person_name', width: 25 },
      { header: 'Direction', key: 'direction', width: 16 },
      { header: 'Principal (PKR)', key: 'principal', width: 16 },
      { header: 'Total Repaid (PKR)', key: 'total_repaid', width: 16 },
      { header: 'Remaining (PKR)', key: 'remaining_balance', width: 16 },
      { header: 'Debt Date', key: 'debt_date', width: 14 },
      { header: 'Due Date', key: 'due_date', width: 14 },
      { header: 'Note', key: 'note', width: 35 }
    ];

    const [debts] = await pool.query(
      `SELECT
         d.id,
         d.person_name,
         d.direction,
         d.principal,
         d.debt_date,
         d.due_date,
         d.note,
         COALESCE(SUM(r.amount), 0) AS total_repaid,
         ROUND(d.principal - COALESCE(SUM(r.amount), 0), 2) AS remaining_balance
       FROM debts d
       LEFT JOIN debt_repayments r ON d.id = r.debt_id AND d.user_id = r.user_id
       WHERE d.user_id = ?
       GROUP BY d.id
       ORDER BY d.debt_date DESC`,
      [userId]
    );

    debts.forEach(d => {
      debtsSheet.addRow({
        person_name: d.person_name,
        direction: d.direction === 'I_OWE' ? 'I Owe' : 'Owed To Me',
        principal: parseFloat(d.principal),
        total_repaid: parseFloat(d.total_repaid),
        remaining_balance: parseFloat(d.remaining_balance),
        debt_date: d.debt_date,
        due_date: d.due_date || 'N/A',
        note: d.note || ''
      });
    });

    // Style headers for all sheets
    [expenseSheet, incomeSheet, debtsSheet].forEach(sheet => {
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="family-tracker-${new Date().toISOString().slice(0, 10)}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
