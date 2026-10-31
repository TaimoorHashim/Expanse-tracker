/**
 * Authentication client logic for Login & Register pages
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Check if already authenticated; if so, redirect to dashboard
  try {
    const me = await apiFetch('/api/auth/me');
    if (me && me.user) {
      window.location.href = '/dashboard.html';
      return;
    }
  } catch {
    // Not logged in, proceed normally
  }

  // Password toggle show/hide buttons
  document.querySelectorAll('.password-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.closest('.input-wrapper').querySelector('input');
      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
      } else {
        input.type = 'password';
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
      }
    });
  });

  const errorAlert = document.getElementById('error-alert');
  const successAlert = document.getElementById('success-alert');

  function showError(msg) {
    if (errorAlert) {
      errorAlert.textContent = msg;
      errorAlert.style.display = 'flex';
    }
    if (successAlert) successAlert.style.display = 'none';
  }

  function showSuccess(msg) {
    if (successAlert) {
      successAlert.textContent = msg;
      successAlert.style.display = 'flex';
    }
    if (errorAlert) errorAlert.style.display = 'none';
  }

  // Login form handler
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      try {
        await apiFetch('/api/auth/login', {
          method: 'POST',
          body: { email, password }
        });
        showSuccess('Login successful! Redirecting...');
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 600);
      } catch (err) {
        showError(err.message || 'Login failed');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    });
  }

  // Register form handler
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;
      const submitBtn = registerForm.querySelector('button[type="submit"]');

      if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';

      try {
        await apiFetch('/api/auth/register', {
          method: 'POST',
          body: { email, password }
        });
        showSuccess('Account created! Redirecting to dashboard...');
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 600);
      } catch (err) {
        showError(err.message || 'Registration failed');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
      }
    });
  }
});
