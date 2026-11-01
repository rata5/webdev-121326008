// The sign-in rules from SPEC.md, Auth: Local.
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { setup, rowCounts } from './helpers.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createAuthService } = require('../src/services/auth.js');
const { createUserStore } = require('../src/data/users.js');
const { createSessionStore } = require('../src/data/sessions.js');

let db; let app; let services;
beforeEach(() => ({ db, app, services } = setup()));

describe('sign up', () => {
  it('creates one user with a hashed password and a local identity', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: ' Ana@TU-Sofia.bg ', password: 'correct-horse' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'ana@tu-sofia.bg', role: 'user' });
    const user = db.prepare('SELECT * FROM users').get();
    expect(user.password_hash).not.toContain('correct-horse');
    expect(db.prepare('SELECT provider, provider_id FROM identities').get()).toEqual({ provider: 'local', provider_id: 'ana@tu-sofia.bg' });
    expect(res.headers['set-cookie'][0]).toMatch(/lb_session=.*HttpOnly/);
  });

  it('refuses an invalid email, a short password and a taken email', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'not-an-email', password: 'correct-horse' }).expect(400);
    await request(app).post('/api/auth/signup').send({ email: 'ana@tu-sofia.bg', password: 'short' }).expect(400);
    await request(app).post('/api/auth/signup').send({}).expect(400);
    await request(app).post('/api/auth/signup').send({ email: 'ana@tu-sofia.bg', password: 'correct-horse' }).expect(201);
    const before = rowCounts(db);
    const res = await request(app).post('/api/auth/signup').send({ email: 'ANA@tu-sofia.bg', password: 'other-password' });
    expect(res.status).toBe(409);
    expect(rowCounts(db).users).toBe(before.users);
  });
});

describe('sign in and out', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/signup').send({ email: 'ana@tu-sofia.bg', password: 'correct-horse' }).expect(201);
  });

  it('signs in with the right password and shows who is signed in', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signin').send({ email: 'ana@tu-sofia.bg', password: 'correct-horse' }).expect(200);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.email).toBe('ana@tu-sofia.bg');
    await agent.get('/signin').expect(302);
    const root = await agent.get('/');
    expect(root.headers.location).toBe('/labs');
  });

  it('AC-15 a wrong password or an unknown email shows "Wrong email or password" and adds no session', async () => {
    const sessionsBefore = rowCounts(db).sessions;
    const wrong = await request(app).post('/api/auth/signin').send({ email: 'ana@tu-sofia.bg', password: 'nope-nope' });
    const unknown = await request(app).post('/api/auth/signin').send({ email: 'bob@tu-sofia.bg', password: 'correct-horse' });
    const empty = await request(app).post('/api/auth/signin').send({});
    for (const res of [wrong, unknown, empty]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Wrong email or password');
    }
    expect(rowCounts(db).sessions).toBe(sessionsBefore);
  });

  it('refuses a password sign-in for an account that has no password (Google only)', async () => {
    db.prepare("INSERT INTO users (email, password_hash) VALUES ('g@tu-sofia.bg', NULL)").run();
    const res = await request(app).post('/api/auth/signin').send({ email: 'g@tu-sofia.bg', password: 'anything-at-all' });
    expect(res.status).toBe(401);
  });

  it('signing out ends the session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signin').send({ email: 'ana@tu-sofia.bg', password: 'correct-horse' }).expect(200);
    await agent.post('/api/auth/signout').expect(204);
    await agent.get('/api/auth/me').expect(401);
    await request(app).post('/api/auth/signout').expect(204);
    expect(rowCounts(db).sessions).toBe(1); // only the session from sign-up is left
  });

  it('serves the sign-in page and sends a guest from / to it', async () => {
    const page = await request(app).get('/signin').expect(200);
    expect(page.text).toContain('<title>Sign in');
    const root = await request(app).get('/');
    expect(root.headers.location).toBe('/signin');
  });
});

describe('sessions (service rules, with a fake clock)', () => {
  it('a session works until it expires, then it is removed and counts as signed out', () => {
    let clock = Date.parse('2026-11-02T08:00:00Z');
    const auth = createAuthService({ users: createUserStore(db), sessions: createSessionStore(db), now: () => clock });
    const { token } = auth.signUp({ email: 'ana@tu-sofia.bg', password: 'correct-horse' });
    expect(auth.userForToken(token).email).toBe('ana@tu-sofia.bg');
    clock += 7 * 24 * 60 * 60 * 1000; // exactly seven days later
    expect(auth.userForToken(token)).toBeNull();
    expect(rowCounts(db).sessions).toBe(0);
  });

  it('no token, an unknown token, or a deleted user means nobody is signed in', () => {
    const auth = createAuthService({ users: createUserStore(db), sessions: createSessionStore(db), bcryptRounds: 4 });
    expect(auth.userForToken(null)).toBeNull();
    expect(auth.userForToken('unknown')).toBeNull();
    const { token } = auth.signUp({ email: 'ana@tu-sofia.bg', password: 'correct-horse' });
    const fakeUsers = { ...createUserStore(db), findById: () => undefined };
    const orphan = createAuthService({ users: fakeUsers, sessions: createSessionStore(db) });
    expect(orphan.userForToken(token)).toBeNull();
  });

  it('a missing password is refused on sign-up and sign-in', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'ana@tu-sofia.bg' }).expect(400);
    await request(app).post('/api/auth/signup').send({ email: 'ana@tu-sofia.bg', password: 'correct-horse' }).expect(201);
    await request(app).post('/api/auth/signin').send({ email: 'ana@tu-sofia.bg' }).expect(401);
  });
});
