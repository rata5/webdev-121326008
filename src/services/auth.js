// Sign-up, sign-in, sign-out and "who is this session?" rules.
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { AppError } = require('./errors');

const SESSION_DAYS = 7;
const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WRONG = 'Wrong email or password';
const UNVERIFIED = 'Google has not verified this email address, so it cannot sign you in here.';
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const TOO_MANY = 'Too many wrong passwords. Try again in 15 minutes.';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function createAuthService({ users, sessions, now = Date.now, bcryptRounds = 10 }) {
    // RULE: after 5 wrong passwords for one address, password sign-in for that address is refused
  // for 15 minutes, counted from the first of them. Kept in memory: there is one server, and a
  // restart only gives a guesser 5 more tries.
  const failures = new Map(); // address -> { count, since }
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
    const address = String(email ?? '').trim().toLowerCase();
    const seen = failures.get(address);
    const record = seen && now() - seen.since < LOCK_MS ? seen : { count: 0, since: now() };
    if (record.count >= MAX_FAILURES) throw new AppError('TOO_MANY_ATTEMPTS', TOO_MANY);
    const user = await users.findByEmail(address);
    // The same message whether the email is unknown, the account has no password
    // (Google only) or the password is wrong, so it does not reveal who has an account.
    if (!user || !user.password_hash || !bcrypt.compareSync(String(password ?? ''), user.password_hash)) {
      failures.set(address, { count: record.count + 1, since: record.since });
      throw new AppError('WRONG_CREDENTIALS', WRONG);
    }
    failures.delete(address);
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

    // AC-9: sign in with Google. A Google account is found by its Google account id (sub).
  // The first time, it joins the account that has its address, or it becomes a new account.
  async function signInWithGoogle({ sub, email, emailVerified } = {}) {
    if (!sub) throw new AppError('WRONG_CREDENTIALS', UNVERIFIED);
    const known = await users.findByIdentity('google', sub);
    if (known) return startSession(known);
    // RULE AC-9: only an address Google has verified joins an account, or starts one.
    if (!emailVerified || !EMAIL.test(email ?? '')) throw new AppError('WRONG_CREDENTIALS', UNVERIFIED);
    const existing = await users.findByEmail(email);
    if (existing) {
      // RULE: a local sign-up never proved that whoever chose the password owns this address,
      // and Google just did. So joining drops that password and ends every session the account
      // already had: somebody who registered the address first is locked out.
      await users.dropPassword(existing.id);
      await sessions.removeAllFor(existing.id);
      await users.addIdentity(existing.id, 'google', sub);
      return startSession(existing);
    }
    return startSession(await users.createWithIdentity(email, 'google', sub));
  }

  return { signUp, signIn, signOut, userForToken, signInWithGoogle };
}

module.exports = { createAuthService, UNVERIFIED };