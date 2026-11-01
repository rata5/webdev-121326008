// Slice 1: sign-in and lab list. Each test names the acceptance criterion it proves.
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { setup, rowCounts } from './helpers.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createLabService } = require('../src/services/labs.js');

let db; let app;
beforeEach(() => ({ db, app } = setup()));

async function signedInAgent(email = 'ana@tu-sofia.bg') {
  const agent = request.agent(app);
  await agent.post('/api/auth/signup').send({ email, password: 'correct-horse' }).expect(201);
  return agent;
}

describe('AC-12 a guest is sent to sign in', () => {
  it('AC-12 a guest who opens the lab list is redirected to the sign-in page and no row changes', async () => {
    const before = rowCounts(db);
    const res = await request(app).get('/labs');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/signin');
    expect(rowCounts(db)).toEqual(before);
  });

  it('AC-12 a guest calling the lab API gets 401 and no row changes', async () => {
    const before = rowCounts(db);
    const res = await request(app).get('/api/labs?date=2026-11-02');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Please sign in first');
    expect(rowCounts(db)).toEqual(before);
  });

  it('AC-12 a forged session cookie is treated as a guest', async () => {
    const res = await request(app).get('/labs').set('Cookie', 'lb_session=abc.def');
    expect(res.headers.location).toBe('/signin');
  });
});

describe('AC-13 a signed-in user sees every lab and its slots', () => {
  it('AC-13 the lab list for a weekday shows every lab with free and taken slots matching labs and bookings', async () => {
    const agent = await signedInAgent();
    const lab = db.prepare('SELECT id FROM labs ORDER BY name LIMIT 1').get();
    const user = db.prepare('SELECT id FROM users').get();
    db.prepare('INSERT INTO bookings (user_id, lab_id, date, start_hour) VALUES (?, ?, ?, ?)').run(user.id, lab.id, '2026-11-02', 10);

    const res = await agent.get('/api/labs?date=2026-11-02').expect(200);

    const labRows = db.prepare('SELECT id, name, room, capacity FROM labs ORDER BY name').all();
    expect(res.body.open).toBe(true);
    expect(res.body.labs.map(({ slots, ...l }) => l)).toEqual(labRows);
    for (const l of res.body.labs) {
      expect(l.slots.map((s) => s.hour)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
      const taken = l.slots.filter((s) => !s.free).map((s) => s.hour);
      expect(taken).toEqual(l.id === lab.id ? [10] : []);
    }
    expect(res.body.labs[0].slots[0].label).toBe('08:00–09:00');
  });

  it('AC-13 on a Saturday every lab is listed with no slots', async () => {
    const agent = await signedInAgent();
    const res = await agent.get('/api/labs?date=2026-11-07').expect(200);
    expect(res.body.open).toBe(false);
    expect(res.body.labs.length).toBe(3);
    expect(res.body.labs.every((l) => l.slots.length === 0)).toBe(true);
  });

  it('AC-13 on a Sunday every lab is listed with no slots', async () => {
    const agent = await signedInAgent();
    const res = await agent.get('/api/labs?date=2026-11-08').expect(200);
    expect(res.body.open).toBe(false);
  });

  it('AC-13 an invalid date is refused with 400', async () => {
    const agent = await signedInAgent();
    for (const date of ['2026-02-30', 'tomorrow', '']) {
      const res = await agent.get(`/api/labs?date=${date}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Choose a valid date (YYYY-MM-DD)');
    }
  });

  it('AC-13 a signed-in user opening the lab page gets the page', async () => {
    const agent = await signedInAgent();
    const res = await agent.get('/labs').expect(200);
    expect(res.text).toContain('<title>Labs');
  });
});

describe('AC-14 the list is read from the labs table', () => {
  it('AC-14 deleting a row from labs and reloading removes that lab from the list', async () => {
    const agent = await signedInAgent();
    const before = await agent.get('/api/labs?date=2026-11-02').expect(200);
    expect(before.body.labs.map((l) => l.name)).toContain('Networks Lab');
    db.prepare("DELETE FROM labs WHERE name = 'Networks Lab'").run();
    const after = await agent.get('/api/labs?date=2026-11-02').expect(200);
    expect(after.body.labs.map((l) => l.name)).toEqual(['Computer Lab 1', 'Computer Lab 2']);
  });
});

describe('AC-16 slots that have started are past', () => {
  const store = { all: () => [{ id: 1, name: 'Lab', room: '1', capacity: 10 }], takenSlotsOn: () => [] };
  // 10:30 in Sofia on Monday 2 November 2026 (UTC+2 in winter).
  const service = createLabService({ labs: store, now: () => new Date('2026-11-02T08:30:00Z') });
  const pastHours = (date) => service.listWithSlots(date).labs[0].slots.filter((s) => s.past).map((s) => s.hour);

  it('AC-16 on today\'s date the slots up to the current hour are past and the later ones are not', () => {
    expect(pastHours('2026-11-02')).toEqual([8, 9, 10]);
  });

  it('AC-16 every slot of an earlier day is past and no slot of a later day is', () => {
    expect(pastHours('2026-10-30')).toHaveLength(12);
    expect(pastHours('2026-11-03')).toEqual([]);
  });

  it('AC-16 the default clock and time zone are used when none are given', () => {
    const real = createLabService({ labs: store });
    expect(real.listWithSlots('2000-01-03').labs[0].slots.every((s) => s.past)).toBe(true);
  });
});
