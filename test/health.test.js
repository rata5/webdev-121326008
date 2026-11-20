// /health and the error handling from Exercise 4, step 4: a host can ask whether the app
// is up, and a user never sees a stack trace.
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { setup } from './helpers.js';
const require = createRequire(import.meta.url);
const { createApp } = require('../src/app.js');

// A database that is not there: every call fails the way pg fails when it cannot connect.
const unreachable = () => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:5432'));
const downDb = { ready: unreachable, query: unreachable, one: unreachable, run: unreachable };

// Runs fn while console.error writes into a list instead of the terminal.
async function capturingErrors(fn) {
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.map(String).join(' '));
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return logged.join('\n');
}

let app;
beforeEach(async () => {
  ({ app } = await setup());
});

describe('GET /health', () => {
  it('answers 200 with {"status":"ok","db":"ok"} when the database answers', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });

  it('answers 503 with {"status":"error","db":"down"} when the database cannot be reached', async () => {
    const { app: broken } = createApp({ db: downDb, sessionSecret: 'test-secret' });
    const log = await capturingErrors(async () => {
      const res = await request(broken).get('/health').expect(503);
      expect(res.body).toEqual({ status: 'error', db: 'down' });
    });
    expect(log).toContain('ECONNREFUSED');
  });
});

describe('errors without stack traces', () => {
  it('an unknown page answers a one-line 404, an unknown API path a JSON one', async () => {
    const page = await request(app).get('/no-such-page').expect(404);
    expect(page.text).toBe('Page not found');
    const api = await request(app).get('/api/no-such-thing').expect(404);
    expect(api.body).toEqual({ error: 'Not found' });
  });

  it('broken JSON answers 400 with one sentence', async () => {
    const res = await request(app).post('/api/bookings').set('Content-Type', 'application/json').send('{"labId": 12');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'The request body is not valid JSON.' });
  });

  it('an unexpected failure answers 500 with one sentence, and the details go to the log', async () => {
    const { app: broken } = createApp({ db: downDb, sessionSecret: 'test-secret' });
    // A correctly signed session cookie, so the app has to ask the database who this is.
    const token = 'a'.repeat(64);
    const cookie = `lb_session=${token}.${createHmac('sha256', 'test-secret').update(token).digest('hex')}`;
    const log = await capturingErrors(async () => {
      const res = await request(broken).get('/labs').set('Cookie', cookie);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Something went wrong. Please try again.' });
      expect(res.text).not.toContain('ECONNREFUSED');
    });
    expect(log).toContain('ECONNREFUSED');
  });
});