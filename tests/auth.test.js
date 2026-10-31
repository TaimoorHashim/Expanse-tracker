const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../server/app');
const pool = require('../server/db');

describe('Authentication & Session Tests', () => {
  let server;
  let baseUrl;
  const testEmail = `test_auth_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let authCookie = null;

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

    // Cleanup previous test users
    await pool.query('DELETE FROM users WHERE email LIKE ?', ['test_auth_%']);
  });

  after(async () => {
    // Cleanup test user
    await pool.query('DELETE FROM users WHERE email LIKE ?', ['test_auth_%']);
    await new Promise(resolve => server.close(resolve));
  });

  test('POST /api/auth/register creates a new user and sets session cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.user.email, testEmail);
    assert.ok(data.user.id);

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Should set session cookie');
    authCookie = setCookie.split(';')[0];
  });

  test('POST /api/auth/register rejects duplicate email', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });

    assert.equal(res.status, 409);
    const data = await res.json();
    assert.match(data.error, /already exists/i);
  });

  test('POST /api/auth/register rejects invalid email or short password', async () => {
    const resShortPass = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'valid@example.com', password: 'short' })
    });
    assert.equal(resShortPass.status, 400);

    const resBadEmail = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notanemail', password: testPassword })
    });
    assert.equal(resBadEmail.status, 400);
  });

  test('GET /api/auth/me returns current user when authenticated', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Cookie': authCookie }
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.email, testEmail);
  });

  test('POST /api/auth/login rejects wrong password', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'WrongPassword999!' })
    });

    assert.equal(res.status, 401);
  });

  test('POST /api/auth/login succeeds with correct credentials', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.email, testEmail);

    const setCookie = res.headers.get('set-cookie');
    authCookie = setCookie.split(';')[0];
  });

  test('POST /api/auth/logout clears session', async () => {
    const resLogout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });
    assert.equal(resLogout.status, 200);

    const resMe = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Cookie': authCookie }
    });
    assert.equal(resMe.status, 401);
  });
});
