// Sign-up, sign-in, sign-out and "who is this session?" rules.
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { AppError } = require('./errors');

const SESSION_DAYS = 7;
const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WRONG = 'Wrong email or password';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function createAuthService({ users, sessions, now = Date.now, bcryptRounds = 10 }) {
  async function startSession(user) {
    const token = crypto.randomBytes(32).toString('hex');
    await sessions.create(hashToken(token), user.id, now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    return { token, user: { id: user.id, email: user.email, role: user.role } };
  }

  async function signUp({ email, password }) {
    const normalized = String(email ?? '').trim().toLowerCase();
    if (!EMAIL.test(normalized)) throw new AppError('VALIDATION', 'Enter a valid email address');
    if (String(password ?? '').length < MIN_PASSWORD) {
      throw new AppError('VALIDATION', `The password must be at least ${MIN_PASSWORD} characters`);
    }
    if (await users.findByEmail(normalized)) throw new AppError('EMAIL_TAKEN', 'An account with this email already exists');
    const user = await users.createLocal(normalized, bcrypt.hashSync(password, bcryptRounds));
    return startSession(user);
  }

  async function signIn({ email, password }) {
    const user = await users.findByEmail(String(email ?? '').trim().toLowerCase());
    // The same message whether the email is unknown, the account has no password
    // (Google only) or the password is wrong, so it does not reveal who has an account.
    if (!user || !user.password_hash || !bcrypt.compareSync(String(password ?? ''), user.password_hash)) {
      throw new AppError('WRONG_CREDENTIALS', WRONG);
    }
    return startSession(user);
  }

  async function signOut(token) {
    if (token) await sessions.remove(hashToken(token));
  }

  // The signed-in user for a session token, or null.
  async function userForToken(token) {
    if (!token) return null;
    const session = await sessions.find(hashToken(token));
    if (!session) return null;
    if (session.expires_at <= now()) {
      await sessions.remove(hashToken(token));
      return null;
    }
    return (await users.findById(session.user_id)) ?? null;
  }

  return { signUp, signIn, signOut, userForToken };
}

module.exports = { createAuthService };