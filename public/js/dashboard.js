/**
 * Dashboard Frontend Controller
 * Handles authentication verification, CRUD operations, metrics updates,
 * and data table interactions.
 */

document.addEventListener('DOMContentLoaded', async () => {
  let currentUser = null;
  let selectedMonth = '';

  // Initialize selected month to current month YYYY-MM
  const now = new Date();
  selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const filterMonthInput = document.getElementById('filter-month');
  if (filterMonthInput) {
    filterMonthInput.value = selectedMonth;
    filterMonthInput.addEventListener('change', e => {
      selectedMonth = e.target.value;
      loadAllData();
    });
  }

  // 1. Verify Authentication
  try {
    const authData = await apiFetch('/api/auth/me');
    if (!authData || !authData.user) {
      window.location.href = '/index.html';
      return;
    }
    currentUser = authData.user;
    document.getElementById('user-email-display').textContent = currentUser.email;
  } catch {
    window.location.href = '/index.html';
    return;
  }

  // 2. Setup Navigation Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // 3. Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout error', err);
    } finally {
      window.location.href = '/index.html';
    }
  });

  // 4. Export Excel
  document.getElementById('btn-export-excel').addEventListener('click', async () => {
    const btn = document.getElementById('btn-export-excel');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Generating Excel...';

    try {
      const blob = await apiFetch('/api/export');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-tracker-${selectedMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + (err.message || 'Unknown error'));
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });

  // ==================== MODAL HELPERS ====================
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  }

  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });

  document.querySelectorAll('.modal-close-btn, .modal-cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) modal.classList.remove('active');
    });
  });

  // ==================== BUDGET LOGIC ====================
  const btnOpenBudget = document.getElementById('btn-open-budget-modal');
  const formBudget = document.getElementById('form-budget');
  const budgetMonthInput = document.getElementById('budget-month');
  const budgetAmountInput = document.getElementById('budget-amount');

  btnOpenBudget.addEventListener('click', async () => {
    budgetMonthInput.value = selectedMonth;
    try {
      const budgetData = await apiFetch(`/api/budgets?month=${selectedMonth}`);
      budgetAmountInput.value = budgetData && budgetData.budget ? parseFloat(budgetData.budget) : '';
    } catch {
      budgetAmountInput.value = '';
    }
    openModal('modal-budget');
  });

  formBudget.addEventListener('submit', async e => {
    e.preventDefault();
    const month = budgetMonthInput.value;
    const budget = parseFloat(budgetAmountInput.value);

    try {
      await apiFetch('/api/budgets', {
        method: 'POST',
        body: { month, budget }
      });
      closeModal('modal-budget');
      loadAllData();
    } catch (err) {
      alert('Error saving budget: ' + err.message);
    }
  });

  // ==================== EXPENSES LOGIC ====================
  const btnOpenExpense = document.getElementById('btn-open-expense-modal');
  const formExpense = document.getElementById('form-expense');
  const expenseIdInput = document.getElementById('expense-id');
  const expenseDateInput = document.getElementById('expense-date');
  const expenseCategoryInput = document.getElementById('expense-category');
  const expenseAmountInput = document.getElementById('expense-amount');
  const expenseDescInput = document.getElementById('expense-desc');
  const modalExpenseTitle = document.getElementById('modal-expense-title');

  btnOpenExpense.addEventListener('click', () => {
    formExpense.reset();
    expenseIdInput.value = '';
    modalExpenseTitle.textContent = 'Add Expense';
    expenseDateInput.value = new Date().toISOString().slice(0, 10);
    openModal('modal-expense');
  });

  window.editExpense = function(exp) {
    expenseIdInput.value = exp.id;
    expenseDateInput.value = exp.expense_date.slice(0, 10);
    expenseCategoryInput.value = exp.category;
    expenseAmountInput.value = exp.amount;
    expenseDescInput.value = exp.description || '';
    modalExpenseTitle.textContent = 'Edit Expense';
    openModal('modal-expense');
  };

  window.deleteExpense = async function(id) {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });
      loadAllData();
    } catch (err) {
      alert('Failed to delete expense: ' + err.message);
    }
  };

  formExpense.addEventListener('submit', async e => {
    e.preventDefault();
    const id = expenseIdInput.value;
    const payload = {
      expense_date: expenseDateInput.value,
      category: expenseCategoryInput.value,
      amount: parseFloat(expenseAmountInput.value),
      description: expenseDescInput.value
    };

    try {
      if (id) {
        await apiFetch(`/api/expenses/${id}`, { method: 'PUT', body: payload });
      } else {
        await apiFetch('/api/expenses', { method: 'POST', body: payload });
      }
      closeModal('modal-expense');
      loadAllData();
    } catch (err) {
      alert('Error saving expense: ' + err.message);
    }
  });

  // ==================== MONEY RECEIVED LOGIC ====================
  const btnOpenIncome = document.getElementById('btn-open-income-modal');
  const formIncome = document.getElementById('form-income');
  const incomeIdInput = document.getElementById('income-id');
  const incomeDateInput = document.getElementById('income-date');
  const incomeSourceInput = document.getElementById('income-source');
  const incomeAmountInput = document.getElementById('income-amount');
  const incomeNoteInput = document.getElementById('income-note');
  const modalIncomeTitle = document.getElementById('modal-income-title');

  btnOpenIncome.addEventListener('click', () => {
    formIncome.reset();
    incomeIdInput.value = '';
    modalIncomeTitle.textContent = 'Add Money Received';
    incomeDateInput.value = new Date().toISOString().slice(0, 10);
    openModal('modal-income');
  });

  window.editIncome = function(inc) {
    incomeIdInput.value = inc.id;
    incomeDateInput.value = inc.received_date.slice(0, 10);
    incomeSourceInput.value = inc.source;
    incomeAmountInput.value = inc.amount;
    incomeNoteInput.value = inc.note || '';
    modalIncomeTitle.textContent = 'Edit Money Received';
    openModal('modal-income');
  };

  window.deleteIncome = async function(id) {
    if (!confirm('Are you sure you want to delete this received income record?')) return;
    try {
      await apiFetch(`/api/received/${id}`, { method: 'DELETE' });
      loadAllData();
    } catch (err) {
      alert('Failed to delete entry: ' + err.message);
    }
  };

  formIncome.addEventListener('submit', async e => {
    e.preventDefault();
    const id = incomeIdInput.value;
    const payload = {
      received_date: incomeDateInput.value,
      source: incomeSourceInput.value,
      amount: parseFloat(incomeAmountInput.value),
      note: incomeNoteInput.value
    };

    try {
      if (id) {
        await apiFetch(`/api/received/${id}`, { method: 'PUT', body: payload });
      } else {
        await apiFetch('/api/received', { method: 'POST', body: payload });
      }
      closeModal('modal-income');
      loadAllData();
    } catch (err) {
      alert('Error saving entry: ' + err.message);
    }
  });

  // ==================== DEBTS LOGIC ====================
  const btnOpenDebt = document.getElementById('btn-open-debt-modal');
  const formDebt = document.getElementById('form-debt');
  const debtIdInput = document.getElementById('debt-id');
  const debtPersonInput = document.getElementById('debt-person');
  const debtDirectionInput = document.getElementById('debt-direction');
  const debtPrincipalInput = document.getElementById('debt-principal');
  const debtDateInput = document.getElementById('debt-date');
  const debtDueDateInput = document.getElementById('debt-due-date');
  const debtNoteInput = document.getElementById('debt-note');
  const modalDebtTitle = document.getElementById('modal-debt-title');

  btnOpenDebt.addEventListener('click', () => {
    formDebt.reset();
    debtIdInput.value = '';
    modalDebtTitle.textContent = 'Add Debt Record';
    debtDateInput.value = new Date().toISOString().slice(0, 10);
    openModal('modal-debt');
  });

  window.editDebt = function(d) {
    debtIdInput.value = d.id;
    debtPersonInput.value = d.person_name;
    debtDirectionInput.value = d.direction;
    debtPrincipalInput.value = d.principal;
    debtDateInput.value = d.debt_date.slice(0, 10);
    debtDueDateInput.value = d.due_date ? d.due_date.slice(0, 10) : '';
    debtNoteInput.value = d.note || '';
    modalDebtTitle.textContent = 'Edit Debt Record';
    openModal('modal-debt');
  };

  window.deleteDebt = async function(id) {
    if (!confirm('Are you sure you want to delete this debt? All associated repayments will also be removed.')) return;
    try {
      await apiFetch(`/api/debts/${id}`, { method: 'DELETE' });
      loadAllData();
    } catch (err) {
      alert('Failed to delete debt: ' + err.message);
    }
  };

  formDebt.addEventListener('submit', async e => {
    e.preventDefault();
    const id = debtIdInput.value;
    const payload = {
      person_name: debtPersonInput.value,
      direction: debtDirectionInput.value,
      principal: parseFloat(debtPrincipalInput.value),
      debt_date: debtDateInput.value,
      due_date: debtDueDateInput.value || null,
      note: debtNoteInput.value
    };

    try {
      if (id) {
        await apiFetch(`/api/debts/${id}`, { method: 'PUT', body: payload });
      } else {
        await apiFetch('/api/debts', { method: 'POST', body: payload });
      }
      closeModal('modal-debt');
      loadAllData();
    } catch (err) {
      alert('Error saving debt: ' + err.message);
    }
  });

  // ==================== DEBT REPAYMENTS LOGIC ====================
  const formRepayment = document.getElementById('form-repayment');
  const repaymentDebtIdInput = document.getElementById('repayment-debt-id');
  const repaymentDebtInfo = document.getElementById('repayment-debt-info');
  const repaymentDateInput = document.getElementById('repayment-date');
  const repaymentAmountInput = document.getElementById('repayment-amount');
  const repaymentNoteInput = document.getElementById('repayment-note');

  // Currency formatting helper
  function formatPKR(val) {
    const num = parseFloat(val) || 0;
    return `PKR ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  window.openRepaymentModal = function(debtId, personName, direction, remaining) {
    repaymentDebtIdInput.value = debtId;
    const dirText = direction === 'I_OWE' ? 'You owe' : 'Owed to you';
    repaymentDebtInfo.textContent = `${personName} (${dirText}) — Remaining: ${formatPKR(remaining)}`;
    repaymentDateInput.value = new Date().toISOString().slice(0, 10);
    repaymentAmountInput.value = '';
    repaymentNoteInput.value = '';
    openModal('modal-repayment');
  };

  formRepayment.addEventListener('submit', async e => {
    e.preventDefault();
    const debtId = repaymentDebtIdInput.value;
    const payload = {
      paid_on: repaymentDateInput.value,
      amount: parseFloat(repaymentAmountInput.value),
      note: repaymentNoteInput.value
    };

    try {
      await apiFetch(`/api/debts/${debtId}/repayments`, {
        method: 'POST',
        body: payload
      });
      closeModal('modal-repayment');
      loadAllData();
    } catch (err) {
      alert('Error recording repayment: ' + err.message);
    }
  });

  // ==================== DATA LOADING & RENDERING ====================
  async function loadAllData() {
    await Promise.all([
      loadSummary(),
      loadExpenses(),
      loadIncome(),
      loadDebts()
    ]);
  }

  // 1. KPI Summary
  async function loadSummary() {
    try {
      const summary = await apiFetch(`/api/reports/summary?month=${selectedMonth}`);
      if (!summary) return;

      const budget = parseFloat(summary.budget) || 0;
      const totalExpenses = parseFloat(summary.totalExpenses) || 0;
      const remainingBudget = parseFloat(summary.remainingBudget) || 0;
      const totalReceived = parseFloat(summary.totalReceived) || 0;
      const netSavings = parseFloat(summary.netSavings) || 0;

      // Budget KPI
      document.getElementById('kpi-budget').textContent = formatPKR(budget);
      document.getElementById('kpi-budget-sub').textContent = budget > 0 ? 'Allocated monthly budget' : 'No budget set for this month';

      // Expenses KPI
      document.getElementById('kpi-expenses').textContent = formatPKR(totalExpenses);
      document.getElementById('kpi-expenses-sub').textContent = `${summary.expenseCount} transactions recorded`;

      // Progress bar
      const progressBar = document.getElementById('kpi-budget-progress');
      if (budget > 0) {
        const pct = Math.min(100, Math.round((totalExpenses / budget) * 100));
        progressBar.style.width = `${pct}%`;
        progressBar.style.backgroundColor = totalExpenses > budget ? '#f43f5e' : (pct > 80 ? '#f59e0b' : '#6366f1');
      } else {
        progressBar.style.width = '0%';
      }

      // Remaining Budget KPI
      const kpiRemaining = document.getElementById('kpi-remaining');
      kpiRemaining.textContent = formatPKR(remainingBudget);
      kpiRemaining.style.color = remainingBudget < 0 ? '#fb7185' : '#34d399';
      document.getElementById('kpi-remaining-sub').textContent = remainingBudget < 0 ? 'Over budget!' : 'Available balance';

      // Income KPI
      document.getElementById('kpi-income').textContent = formatPKR(totalReceived);
      document.getElementById('kpi-income-sub').textContent = `Net Savings: ${formatPKR(netSavings)}`;

      // Debts KPI
      const iOwe = parseFloat(summary.debts.totalIOwe) || 0;
      const owedToMe = parseFloat(summary.debts.totalOwedToMe) || 0;
      const netDebt = owedToMe - iOwe;
      const kpiDebts = document.getElementById('kpi-debts-owed');
      kpiDebts.textContent = `${netDebt < 0 ? '-' : (netDebt > 0 ? '+' : '')}${formatPKR(Math.abs(netDebt))}`;
      kpiDebts.style.color = netDebt >= 0 ? '#34d399' : '#fb7185';
      document.getElementById('kpi-debts-sub').textContent = `I Owe: ${formatPKR(iOwe)} | Owed To Me: ${formatPKR(owedToMe)}`;

      // Render Categories Analytics
      renderCategoriesAnalytics(summary.categoryBreakdown || [], totalExpenses);
    } catch (err) {
      console.error('Error loading summary:', err);
    }
  }

  // 2. Expenses Table
  async function loadExpenses() {
    const tbody = document.getElementById('expenses-table-body');
    const badge = document.getElementById('expenses-count-badge');
    try {
      const expenses = await apiFetch(`/api/expenses?month=${selectedMonth}`);
      badge.textContent = `${expenses.length} items`;

      if (expenses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No expenses found for ${selectedMonth}. Click 'Add Expense' above to create one.</td></tr>`;
        return;
      }

      tbody.innerHTML = expenses.map(exp => {
        const expJson = JSON.stringify(exp).replace(/"/g, '&quot;');
        return `
          <tr>
            <td><strong>${exp.expense_date.slice(0, 10)}</strong></td>
            <td><span class="badge badge-expense">${escapeHtml(exp.category)}</span></td>
            <td>${exp.description ? escapeHtml(exp.description) : '<span style="color:var(--text-dim)">-</span>'}</td>
            <td style="font-weight: 700; color: #fb7185;">${formatPKR(exp.amount)}</td>
            <td style="text-align: right;">
              <button class="btn btn-secondary btn-sm" onclick="editExpense(${expJson})" style="margin-right: 6px;">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteExpense(${exp.id})">Delete</button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="color:#fb7185;">Error loading expenses: ${err.message}</td></tr>`;
    }
  }

  // 3. Money Received Table
  async function loadIncome() {
    const tbody = document.getElementById('income-table-body');
    const badge = document.getElementById('income-count-badge');
    try {
      const incomeList = await apiFetch(`/api/received?month=${selectedMonth}`);
      badge.textContent = `${incomeList.length} items`;

      if (incomeList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No income logged for ${selectedMonth}. Click 'Add Money Received' to record income.</td></tr>`;
        return;
      }

      tbody.innerHTML = incomeList.map(inc => {
        const incJson = JSON.stringify(inc).replace(/"/g, '&quot;');
        return `
          <tr>
            <td><strong>${inc.received_date.slice(0, 10)}</strong></td>
            <td><span class="badge badge-income">${escapeHtml(inc.source)}</span></td>
            <td>${inc.note ? escapeHtml(inc.note) : '<span style="color:var(--text-dim)">-</span>'}</td>
            <td style="font-weight: 700; color: #34d399;">${formatPKR(inc.amount)}</td>
            <td style="text-align: right;">
              <button class="btn btn-secondary btn-sm" onclick="editIncome(${incJson})" style="margin-right: 6px;">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteIncome(${inc.id})">Delete</button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="color:#fb7185;">Error loading income: ${err.message}</td></tr>`;
    }
  }

  // 4. Debts Table
  async function loadDebts() {
    const tbody = document.getElementById('debts-table-body');
    const badge = document.getElementById('debts-count-badge');
    try {
      const debts = await apiFetch('/api/debts');
      badge.textContent = `${debts.length} active`;

      if (debts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No debts or loans tracked. Click 'Add Debt' above to add one.</td></tr>`;
        return;
      }

      tbody.innerHTML = debts.map(d => {
        const dJson = JSON.stringify(d).replace(/"/g, '&quot;');
        const isIOwe = d.direction === 'I_OWE';
        const dirBadge = isIOwe
          ? `<span class="badge badge-debt-owe">I Owe</span>`
          : `<span class="badge badge-debt-owed">Owed To Me</span>`;
        const rem = parseFloat(d.remaining_balance);
        const isPaid = rem <= 0;

        return `
          <tr>
            <td><strong>${escapeHtml(d.person_name)}</strong></td>
            <td>${dirBadge}</td>
            <td>${formatPKR(d.principal)}</td>
            <td style="color: #34d399;">${formatPKR(d.total_repaid)}</td>
            <td style="font-weight: 700; color: ${isPaid ? '#34d399' : (isIOwe ? '#fb7185' : '#60a5fa')}">
              ${isPaid ? '<span class="badge badge-income">Paid Off</span>' : formatPKR(rem)}
            </td>
            <td>${d.due_date ? d.due_date.slice(0, 10) : '<span style="color:var(--text-dim)">N/A</span>'}</td>
            <td>${d.note ? escapeHtml(d.note) : '<span style="color:var(--text-dim)">-</span>'}</td>
            <td style="text-align: right; white-space: nowrap;">
              ${!isPaid ? `<button class="btn btn-success btn-sm" onclick="openRepaymentModal(${d.id}, '${escapeJs(d.person_name)}', '${d.direction}', ${rem})" style="margin-right: 6px;">+ Repay</button>` : ''}
              <button class="btn btn-secondary btn-sm" onclick="editDebt(${dJson})" style="margin-right: 6px;">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteDebt(${d.id})">Delete</button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="color:#fb7185;">Error loading debts: ${err.message}</td></tr>`;
    }
  }

  // 5. Analytics Category Breakdown
  function renderCategoriesAnalytics(categories, totalExpenses) {
    const container = document.getElementById('analytics-categories-container');
    if (!categories || categories.length === 0) {
      container.innerHTML = `<div class="empty-state">No expenses recorded for ${selectedMonth} yet.</div>`;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        ${categories.map(cat => `
          <div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.92rem;">
              <span style="font-weight: 600; color: #ffffff;">${escapeHtml(cat.category)}</span>
              <span style="color: var(--text-muted);">${formatPKR(cat.total)} (${cat.percentage}%)</span>
            </div>
            <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden;">
              <div style="width: ${cat.percentage}%; height: 100%; background: linear-gradient(90deg, #6366f1, #a855f7); border-radius: 999px;"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeJs(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
  }

  // Initial data load
  loadAllData();
});
