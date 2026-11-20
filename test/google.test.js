// Sign in with Google (AC-9). Google is never called: the app gets a fake client that
// answers the way Google's would, and one test checks the real client against fake responses.
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { setup, rowCounts, SECRET } from './helpers.js';
const require = createRequire(import.meta.url);
const { createApp } = require('../src/app.js');
const { createGoogleClient } = require('../src/google/client.js');

// What the fake Google says about each one-time code.
const accounts = {
  ana: { sub: 'google-ana', email: 'ana@tu-sofia.bg', emailVerified: true },
  newcomer: { sub: 'google-new', email: 'new@tu-sofia.bg', emailVerified: true },
  unverified: { sub: 'google-x', email: 'ana@tu-sofia.bg', emailVerified: false },
};
const fakeGoogle = {
  authUrl: (state) => `https://accounts.google.test/auth?state=${state}`,
  profile: async (code) => {
    if (!accounts[code]) throw new Error(`Google refused the code ${code}`);
    return accounts[code];
  },
};

let db; let app; let services;
beforeEach(async () => {
  ({ db, services } = await setup());
  ({ app } = createApp({ db, sessionSecret: SECRET, bcryptRounds: 4, google: fakeGoogle }));
});

// Starts at GET /api/auth/google, the way the button does, and comes back with this code.
async function signInWithGoogle(agent, code) {
  const start = await agent.get('/api/auth/google').expect(302);
  const state = new URL(start.headers.location).searchParams.get('state');
  return agent.get(`/api/auth/google/callback?code=${code}&state=${state}`);
}

const errorOf = (res) => new URL(res.headers.location, 'http://x').searchParams.get('error');

describe('AC-9 sign in with Google', () => {
  it('AC-9 a password account that signs in with Google, verified address, lands in the same account: no new user, one google identity', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'ana@tu-sofia.bg', password: 'correct-horse' }).expect(201);
    const before = await rowCounts(db);
    const agent = request.agent(app);
    const res = await signInWithGoogle(agent, 'ana');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/labs');
    expect((await agent.get('/api/auth/me').expect(200)).body.user.email).toBe('ana@tu-sofia.bg');
    expect((await rowCounts(db)).users).toBe(before.users);
    expect(await db.query("SELECT provider, provider_id FROM identities WHERE provider = 'google'")).toEqual([{ provider: 'google', provider_id: 'google-ana' }]);
  });

  it('AC-9 signing in with Google again finds the account by its Google id and adds nothing', async () => {
    await signInWithGoogle(request.agent(app), 'ana');
    const before = await rowCounts(db);
    const res = await signInWithGoogle(request.agent(app), 'ana');
    expect(res.headers.location).toBe('/labs');
    expect(await rowCounts(db)).toEqual({ ...before, sessions: before.sessions + 1 });
  });

  it('AC-9 a first Google sign-in with a new address creates an account with no password', async () => {
    const res = await signInWithGoogle(request.agent(app), 'newcomer');
    expect(res.headers.location).toBe('/labs');
    expect(await db.one("SELECT email, password_hash, role FROM users WHERE email = 'new@tu-sofia.bg'")).toEqual({ email: 'new@tu-sofia.bg', password_hash: null, role: 'user' });
    const login = await request(app).post('/api/auth/signin').send({ email: 'new@tu-sofia.bg', password: 'anything-at-all' });
    expect(login.status).toBe(401);
  });

  it('AC-9 an address Google has not verified is refused, and no account or identity is added', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'ana@tu-sofia.bg', password: 'correct-horse' }).expect(201);
    const before = await rowCounts(db);
    const res = await signInWithGoogle(request.agent(app), 'unverified');
    expect(errorOf(res)).toBe('Google has not verified this email address, so it cannot sign you in here.');
    expect(await rowCounts(db)).toEqual(before);
  });

  it('AC-9 the service refuses a Google answer with no account id or a broken address', async () => {
    for (const profile of [{}, { sub: 'x', email: 'not-an-email', emailVerified: true }, { sub: 'y', emailVerified: true }, undefined]) {
      await expect(services.auth.signInWithGoogle(profile)).rejects.toMatchObject({ code: 'WRONG_CREDENTIALS' });
    }
  });
});

describe('the Google callback refuses what it did not start', () => {
  it('a callback without the state this browser was given signs nobody in', async () => {
    const agent = request.agent(app);
    await agent.get('/api/auth/google').expect(302);
    const forged = await agent.get('/api/auth/google/callback?code=ana&state=somebody-elses');
    expect(errorOf(forged)).toBe('Google sign-in did not finish. Please try again.');
    const noCookie = await request(app).get('/api/auth/google/callback?code=ana&state=abc');
    expect(errorOf(noCookie)).toBe('Google sign-in did not finish. Please try again.');
    expect((await rowCounts(db)).sessions).toBe(0);
  });

  it('cancelling at Google, or a code Google refuses, goes back to the sign-in page with one sentence', async () => {
    const cancelled = await request(app).get('/api/auth/google/callback?error=access_denied');
    expect(errorOf(cancelled)).toBe('Google sign-in was cancelled.');
    const logged = [];
    const original = console.error;
    console.error = (...args) => logged.push(args.map(String).join(' '));
    try {
      const refused = await signInWithGoogle(request.agent(app), 'expired-code');
      expect(errorOf(refused)).toBe('Google sign-in did not finish. Please try again.');
    } finally {
      console.error = original;
    }
    expect(logged.join('\n')).toContain('Google refused the code');
  });

  it('without GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET the button says Google sign-in is not set up', async () => {
    const { app: plain } = await setup();
    for (const path of ['/api/auth/google', '/api/auth/google/callback?code=ana&state=x']) {
      const res = await request(plain).get(path).expect(302);
      expect(errorOf(res)).toBe('Google sign-in is not set up on this server.');
    }
  });
});

describe('the Google client', () => {
  const config = { clientId: 'client-1.apps.googleusercontent.com', clientSecret: 'shh', redirectUri: 'https://labs.example/api/auth/google/callback' };
  const now = () => Date.parse('2026-11-19T12:00:00Z');
  const idToken = (claims) => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
  const good = { aud: config.clientId, iss: 'https://accounts.google.com', exp: now() / 1000 + 600, sub: '1234', email: 'Ana@TU-Sofia.bg', email_verified: true };
  const answering = (status, body) => async () => ({ ok: status < 300, status, json: async () => body });

  it('sends the browser to Google with the client id, the redirect URI, the scope and the state', () => {
    const url = new URL(createGoogleClient(config).authUrl('st4te'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: 'openid email', state: 'st4te' });
  });

  it('trades the code for the account id and address, and refuses a token that is not for this app', async () => {
    let sent;
    const client = createGoogleClient({ ...config, now, fetchImpl: async (url, init) => { sent = { url, body: String(init.body) }; return answering(200, { id_token: idToken(good) })(); } });
    expect(await client.profile('the-code')).toEqual({ sub: '1234', email: 'ana@tu-sofia.bg', emailVerified: true });
    expect(sent.url).toBe('https://oauth2.googleapis.com/token');
    expect(sent.body).toContain('grant_type=authorization_code');
    expect(sent.body).toContain('code=the-code');
    for (const claims of [{ ...good, aud: 'another-app' }, { ...good, iss: 'https://evil.example' }, { ...good, exp: now() / 1000 - 1 }]) {
      const wrong = createGoogleClient({ ...config, now, fetchImpl: answering(200, { id_token: idToken(claims) }) });
      await expect(wrong.profile('c')).rejects.toThrow('not for this app');
    }
    await expect(createGoogleClient({ ...config, now, fetchImpl: answering(400, {}) }).profile('c')).rejects.toThrow('Google answered 400');
    const unverified = createGoogleClient({ ...config, now, fetchImpl: answering(200, { id_token: idToken({ ...good, email_verified: 'false', email: undefined }) }) });
    expect(await unverified.profile('c')).toEqual({ sub: '1234', email: '', emailVerified: false });
  });
});