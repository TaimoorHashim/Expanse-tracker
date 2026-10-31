const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../server/app');
const pool = require('../server/db');

describe('Cross-User Data Isolation Tests', () => {
  let server;
  let baseUrl;

  const emailA = `isolation_a_${Date.now()}@example.com`;
  const emailB = `isolation_b_${Date.now()}@example.com`;
  const password = 'Password123!';

  let cookieA = null;
  let cookieB = null;

  let expenseAId = null;
  let incomeAId = null;
  let debtAId = null;

  before(async () => {
    // Start test server on random port
    await new Promise(resolve => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });

    // Cleanup previous isolation users
    await pool.query('DELETE FROM users WHERE email LIKE ?', ['isolation_%']);

    // Register User A
    const resA = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailA, password })
    });
    cookieA = resA.headers.get('set-cookie').split(';')[0];

    // Register User B
    const resB = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailB, password })
    });
    cookieB = resB.headers.get('set-cookie').split(';')[0];

    // User A creates an Expense
    const expRes = await fetch(`${baseUrl}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
      body: JSON.stringify({
        expense_date: '2026-10-15',
        category: 'Groceries',
        amount: 85.50,
        description: 'User A private expense'
      })
    });
    const expData = await expRes.json();
    expenseAId = expData.id;

    // User A creates an Income record
    const incRes = await fetch(`${baseUrl}/api/received`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
      body: JSON.stringify({
        received_date: '2026-10-10',
        source: 'Salary',
        amount: 3000.00,
        note: 'User A private salary'
      })
    });
    const incData = await incRes.json();
    incomeAId = incData.id;

    // User A creates a Debt
    const debtRes = await fetch(`${baseUrl}/api/debts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
      body: JSON.stringify({
        person_name: 'Uncle Bob',
        direction: 'I_OWE',
        principal: 500.00,
        debt_date: '2026-10-01'
      })
    });
    const debtData = await debtRes.json();
    debtAId = debtData.id;
  });

  after(async () => {
    // Cleanup test users (cascades to all user records)
    await pool.query('DELETE FROM users WHERE email LIKE ?', ['isolation_%']);
    await new Promise(resolve => server.close(resolve));
  });

  test("User B cannot view User A's expenses in GET /api/expenses", async () => {
    const res = await fetch(`${baseUrl}/api/expenses`, {
      headers: { 'Cookie': cookieB }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.length, 0, "User B's list should not contain User A's expenses");
  });

  test("User B cannot modify User A's expense", async () => {
    const res = await fetch(`${baseUrl}/api/expenses/${expenseAId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieB },
      body: JSON.stringify({
        expense_date: '2026-10-15',
        category: 'Hacked',
        amount: 1.00
      })
    });
    assert.equal(res.status, 404);
  });

  test("User B cannot delete User A's expense", async () => {
    const res = await fetch(`${baseUrl}/api/expenses/${expenseAId}`, {
      method: 'DELETE',
      headers: { 'Cookie': cookieB }
    });
    assert.equal(res.status, 404);
  });

  test("User B cannot view User A's income in GET /api/received", async () => {
    const res = await fetch(`${baseUrl}/api/received`, {
      headers: { 'Cookie': cookieB }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.length, 0);
  });

  test("User B cannot modify User A's income", async () => {
    const res = await fetch(`${baseUrl}/api/received/${incomeAId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieB },
      body: JSON.stringify({
        received_date: '2026-10-10',
        source: 'Hacked',
        amount: 1.00
      })
    });
    assert.equal(res.status, 404);
  });

  test("User B cannot delete User A's income", async () => {
    const res = await fetch(`${baseUrl}/api/received/${incomeAId}`, {
      method: 'DELETE',
      headers: { 'Cookie': cookieB }
    });
    assert.equal(res.status, 404);
  });

  test("User B cannot view or modify User A's debts", async () => {
    // List check
    const listRes = await fetch(`${baseUrl}/api/debts`, {
      headers: { 'Cookie': cookieB }
    });
    assert.equal(listRes.status, 200);
    const debts = await listRes.json();
    assert.equal(debts.length, 0);

    // Modify attempt
    const updateRes = await fetch(`${baseUrl}/api/debts/${debtAId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieB },
      body: JSON.stringify({
        person_name: 'Hacked Name',
        direction: 'I_OWE',
        principal: 10.00,
        debt_date: '2026-10-01'
      })
    });
    assert.equal(updateRes.status, 404);

    // Repayment attempt
    const repRes = await fetch(`${baseUrl}/api/debts/${debtAId}/repayments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieB },
      body: JSON.stringify({
        paid_on: '2026-10-05',
        amount: 50.00
      })
    });
    assert.equal(repRes.status, 404);
  });
});
