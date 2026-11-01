// Shared HTTP glue: the session cookie, "who is signed in", and error -> status code.
const crypto = require('node:crypto');
const { AppError } = require('../services/errors');

const COOKIE = 'lb_session';
const STATUS = { VALIDATION: 400, WRONG_CREDENTIALS: 401, EMAIL_TAKEN: 409 };

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function readCookie(req, name) {
  const pair = (req.headers.cookie ?? '').split(';').map((p) => p.trim()).find((p) => p.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}

// The session token from the signed cookie, or null if it is missing or tampered with.
function sessionToken(req, secret) {
  const raw = readCookie(req, COOKIE);
  if (!raw) return null;
  const [token, mac] = raw.split('.');
  const expected = sign(token ?? '', secret);
  if (!mac || mac.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected)) ? token : null;
}

function setSessionCookie(res, token, secret, secure) {
  res.cookie(COOKIE, `${token}.${sign(token, secret)}`, {
    httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

// Puts the signed-in user (or null) on req.user for every request.
function loadUser(auth, secret) {
  return (req, _res, next) => {
    req.sessionToken = sessionToken(req, secret);
    req.user = auth.userForToken(req.sessionToken);
    next();
  };
}

function requireUserApi(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in first' });
  next();
}

// Turns a thrown error into a status code and a sentence a person can read.
function sendError(res, err) {
  if (err instanceof AppError) return res.status(STATUS[err.code] ?? 400).json({ error: err.message });
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

module.exports = { COOKIE, loadUser, requireUserApi, sendError, setSessionCookie, clearSessionCookie };
