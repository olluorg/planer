// The encrypted database upload has a much larger limit; credentials do not need it.
const AUTH_BODY_LIMIT = 16 * 1024;

function readCredentials(body, requireSalt = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const { email, password, salt } = body;
  if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return null;
  if (typeof password !== 'string' || !password) return null;
  if (requireSalt && (typeof salt !== 'string' || !salt)) return null;
  return { email: email.trim().toLowerCase(), password, salt };
}

module.exports = { AUTH_BODY_LIMIT, readCredentials };
