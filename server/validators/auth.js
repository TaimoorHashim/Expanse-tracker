const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function validateEmail(email) {
  if (typeof email !== 'string') {
    return { valid: false, error: 'Email must be a string' };
  }
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return { valid: false, error: 'Email is required' };
  }
  if (trimmed.length > 254) {
    return { valid: false, error: 'Email cannot exceed 254 characters' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  return { valid: true, email: trimmed };
}

function validatePassword(password) {
  if (typeof password !== 'string') {
    return { valid: false, error: 'Password must be a string' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password cannot exceed 128 characters' };
  }
  return { valid: true };
}

function validateAuthInput(req, res, next) {
  const { email, password } = req.body || {};
  const emailRes = validateEmail(email);
  if (!emailRes.valid) {
    return res.status(400).json({ error: emailRes.error });
  }

  const passRes = validatePassword(password);
  if (!passRes.valid) {
    return res.status(400).json({ error: passRes.error });
  }

  // Attach normalized email to req.body
  req.body.normalizedEmail = emailRes.email;
  next();
}

module.exports = {
  validateEmail,
  validatePassword,
  validateAuthInput
};
