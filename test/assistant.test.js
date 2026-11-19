// "Find me a slot" (AC-10). The model provider is never called: every test passes a fake client.
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { setup } from './helpers.js';
const require = createRequire(import.meta.url);
const { createAssistantService, SLOW, UNAVAILABLE, NO_MATCH } = require('../src/services/assistant.js');
const { createModelClient } = require('../src/model/client.js');

// Monday 2 November 2026, 10:30 in Sofia: today's 08, 09 and 10 o'clock slots have started.
const mondayHalfPastTen = () => new Date('2026-11-02T08:30:00Z');

// Fake clients: an answer, no answer at all, and a failure with a reason.
const answers = (text) => ({ complete: async () => text });
const neverAnswers = { complete: () => new Promise(() => {}) };
const failsWith = (reason) => ({ complete: async () => { throw Object.assign(new Error(reason), { reason }); } });

let db; let services; let lab;
const assistant = (client, options = {}) => createAssistantService({ labService: services.labService, client, now: mondayHalfPastTen, timeoutMs: 50, ...options });
const ask = (client, date = '2026-11-03') => assistant(client).findSlots({ request: 'a lab on Tuesday afternoon', date });
const json = (suggestions) => JSON.stringify({ suggestions });

beforeEach(() => {
  ({ db, services } = setup(mondayHalfPastTen));
  lab = db.prepare('SELECT id FROM labs ORDER BY name LIMIT 1').get().id; // Computer Lab 1, room 1203
  const bob = db.prepare("INSERT INTO users (email, password_hash) VALUES ('bob@tu-sofia.bg', 'x')").run().lastInsertRowid;
  db.prepare("INSERT INTO bookings (user_id, lab_id, date, start_hour) VALUES (?, ?, '2026-11-03', 14)").run(bob, lab);
});

describe('AC-10 a good answer', () => {
  it('AC-10 real, free slots from the answer are shown as suggestions with their reason', async () => {
    const result = await ask(answers(json([
      { labId: lab, date: '2026-11-03', startHour: 15, reason: 'Tuesday afternoon, 24 seats' },
      { labId: lab, date: '2026-11-02', startHour: 11 },
    ])));
    expect(result.source).toBe('model');
    expect(result.notice).toBeNull();
    expect(result.suggestions).toEqual([
      { labId: lab, labName: 'Computer Lab 1', room: '1203', capacity: 24, date: '2026-11-03', hour: 15, label: '15:00–16:00', reason: 'Tuesday afternoon, 24 seats' },
      { labId: lab, labName: 'Computer Lab 1', room: '1203', capacity: 24, date: '2026-11-02', hour: 11, label: '11:00–12:00', reason: '' },
    ]);
  });

  it('AC-10 the prompt holds the request, today and the free slots, and no email address', async () => {
    let prompt = '';
    await ask({ complete: async (text) => { prompt = text; return json([]); } });
    expect(prompt).toContain('a lab on Tuesday afternoon');
    expect(prompt).toContain('Today is 2026-11-02');
    expect(prompt).toContain('"Computer Lab 1", room 1203, 24 seats');
    expect(prompt).not.toContain('@');
    const lines = prompt.split('\n');
    const tuesdayInLab1 = lines.slice(lines.findIndex((l) => l.includes('"Computer Lab 1"'))).find((l) => l.includes('2026-11-03'));
    expect(tuesdayInLab1).toBe("  2026-11-03 (Tuesday): free at 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19 o'clock"); // 14 is taken
  });
});

describe('AC-10 a nonsense answer', () => {
  it('AC-10 invented, taken, past, closed, too far ahead and repeated suggestions are dropped', async () => {
    const result = await ask(answers(json([
      { labId: 999, date: '2026-11-03', startHour: 9 }, // no such lab
      { labId: lab, date: '2026-11-03', startHour: 14 }, // taken by bob
      { labId: lab, date: '2026-11-02', startHour: 9 }, // started already
      { labId: lab, date: '2026-11-07', startHour: 9 }, // Saturday
      { labId: lab, date: '2026-11-03', startHour: 22 }, // after closing
      { labId: lab, date: '2026-11-20', startHour: 9 }, // further than 7 days
      null,
      { labId: lab, date: '2026-11-03', startHour: 16, reason: 42 },
      { labId: lab, date: '2026-11-03', startHour: 16, reason: 'again' }, // a repeat
    ])));
    expect(result.suggestions.map((s) => [s.date, s.hour, s.reason])).toEqual([['2026-11-03', 16, '']]);
  });

  it('AC-10 at most 3 suggestions are kept, in the order the answer gave them', async () => {
    const result = await ask(answers(json([17, 18, 19, 8].map((startHour) => ({ labId: lab, date: '2026-11-04', startHour })))));
    expect(result.suggestions.map((s) => s.hour)).toEqual([17, 18, 19]);
  });

  it('AC-10 an answer that is not the JSON we asked for shows "No matching free slot found"', async () => {
    for (const text of ['Sure! Lab 1 at ten is great.', 'null', '{"slots":[]}', json([])]) {
      expect(await ask(answers(text))).toEqual({ source: 'model', notice: NO_MATCH, suggestions: [] });
    }
    const bare = await ask(answers(JSON.stringify([{ labId: lab, date: '2026-11-04', startHour: 9 }])));
    expect(bare.suggestions).toHaveLength(1);
  });
});

describe('AC-10 no answer', () => {
  it('AC-10 no answer before the timeout: the "taking too long" notice and the first 3 free slots of the chosen day', async () => {
    const result = await ask(neverAnswers, '2026-11-03');
    expect(result.source).toBe('fallback');
    expect(result.notice).toBe(SLOW);
    expect(result.suggestions.map((s) => [s.labName, s.date, s.hour])).toEqual([
      ['Computer Lab 1', '2026-11-03', 8], ['Computer Lab 2', '2026-11-03', 8], ['Networks Lab', '2026-11-03', 8],
    ]);
  });

  it('AC-10 rate-limited, provider down or no key: the "unavailable" notice and free slots that have not started', async () => {
    const broken = [{ complete: () => { throw new Error('boom'); } }, { complete: () => Promise.reject() }, undefined];
    for (const client of [failsWith('rate_limited'), failsWith('down'), failsWith('no_key'), ...broken]) {
      const result = await ask(client, '2026-11-02');
      expect(result).toMatchObject({ source: 'fallback', notice: UNAVAILABLE });
      expect(result.suggestions.map((s) => s.hour)).toEqual([11, 11, 11]);
    }
  });
});

describe('AC-10 the request', () => {
  it('AC-10 an empty request, one over 300 characters, or a date that is not real is refused with VALIDATION', async () => {
    for (const input of [{ request: '  ', date: '2026-11-03' }, { request: 'x'.repeat(301), date: '2026-11-03' }, { request: 'Tuesday', date: '03.11.2026' }, undefined]) {
      await expect(assistant(answers(json([]))).findSlots(input)).rejects.toMatchObject({ code: 'VALIDATION' });
    }
  });

  it('AC-10 the real clock, time zone and timeout are used when none are given', async () => {
    const real = createAssistantService({ labService: services.labService, client: answers(json([])) });
    expect(await real.findSlots({ request: 'any lab', date: '2026-11-03' })).toMatchObject({ source: 'model', notice: NO_MATCH });
  });
});

describe('AC-10 the model client', () => {
  const reasonOf = async (promise) => promise.then(() => 'no error', (err) => err.reason);

  it('AC-10 without GEMINI_API_KEY the client fails with no_key and never calls the provider', async () => {
    let called = false;
    const client = createModelClient({ apiKey: '', fetchImpl: async () => { called = true; } });
    expect(await reasonOf(client.complete('hi'))).toBe('no_key');
    expect(called).toBe(false);
  });

  it('AC-10 the client turns 429, 500, a network error and a slow answer into reasons, and reads a good answer', async () => {
    const replying = (status, body = {}) => async () => ({ status, ok: status < 300, json: async () => body });
    const client = (fetchImpl) => createModelClient({ apiKey: 'test-key', timeoutMs: 30, fetchImpl });
    expect(await reasonOf(client(replying(429)).complete('hi'))).toBe('rate_limited');
    expect(await reasonOf(client(replying(500)).complete('hi'))).toBe('down');
    expect(await reasonOf(client(async () => { throw new TypeError('fetch failed'); }).complete('hi'))).toBe('down');
    const slow = (url, { signal }) => new Promise((_, reject) => {
      const keepAlive = setTimeout(() => {}, 1000); // Node does not wait for AbortSignal.timeout on its own
      signal.addEventListener('abort', () => { clearTimeout(keepAlive); reject(signal.reason); });
    });
    expect(await reasonOf(client(slow).complete('hi'))).toBe('timeout');
    const good = replying(200, { candidates: [{ content: { parts: [{ text: '{"suggestions":' }, { text: '[]}' }] } }] });
    expect(await client(good).complete('hi')).toBe('{"suggestions":[]}');
    expect(await client(replying(200, {})).complete('hi')).toBe('');
  });
});

describe('AC-10 over HTTP', () => {
  it('AC-10 with no GEMINI_API_KEY, POST /api/assistant/suggest shows "unavailable" and 3 free slots of the chosen day from the database', async () => {
    const app = setup(undefined, { modelClient: createModelClient({ apiKey: '' }) }).app;
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({ email: 'ana@tu-sofia.bg', password: 'correct-horse' }).expect(201);
    const labs = await agent.get('/api/labs?date=2026-11-02').expect(200);
    const first = labs.body.labs[0];
    await agent.post('/api/bookings').send({ labId: first.id, date: '2026-11-02', hour: 8 }).expect(201);
    const res = await agent.post('/api/assistant/suggest').send({ request: 'Monday morning', date: '2026-11-02' });
    expect(res.status).toBe(200);
    expect(res.body.notice).toBe('The assistant is unavailable right now, you can still pick a slot from the list.');
    expect(res.body.suggestions.map((s) => [s.labName, s.hour])).toEqual([['Computer Lab 2', 8], ['Networks Lab', 8], ['Computer Lab 1', 9]]);
  });

  it('AC-10 the assistant needs a signed-in user (401) and a request (400)', async () => {
    const { app } = setup();
    await request(app).post('/api/assistant/suggest').send({ request: 'Monday', date: '2026-11-02' }).expect(401);
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({ email: 'ana@tu-sofia.bg', password: 'correct-horse' }).expect(201);
    await agent.post('/api/assistant/suggest').send({ request: '', date: '2026-11-02' }).expect(400);
  });
});