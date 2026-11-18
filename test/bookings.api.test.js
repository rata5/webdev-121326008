// Slice 2 over HTTP: the status code of every path, and what the database holds afterwards.
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { setup, rowCounts } from './helpers.js';

// setup()'s clock is Sunday 1 November 2026, 12:00 in Sofia, so Monday 2 November is ahead.
let db; let app; let lab;
beforeEach(() => {
  ({ db, app } = setup());
  lab = db.prepare('SELECT id FROM labs ORDER BY name LIMIT 1').get().id; // Computer Lab 1, room 1203
});

async function signedIn(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/signup').send({ email, password: 'correct-horse' }).expect(201);
  return agent;
}

const slot = (changes = {}) => ({ labId: lab, date: '2026-11-02', hour: 10, ...changes });

describe('AC-1 booking a free slot', () => {
  it('AC-1 POST /api/bookings answers 201 "Booking confirmed" and adds one row', async () => {
    const ana = await signedIn('ana@tu-sofia.bg');
    const res = await ana.post('/api/bookings').send(slot());
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Booking confirmed');
    const user = db.prepare("SELECT id FROM users WHERE email = 'ana@tu-sofia.bg'").get();
    expect(db.prepare('SELECT user_id, lab_id, date, start_hour FROM bookings').all())
      .toEqual([{ user_id: user.id, lab_id: lab, date: '2026-11-02', start_hour: 10 }]);
  });

  it('AC-1 the booked slot shows as taken in the lab list for everyone', async () => {
    const ana = await signedIn('ana@tu-sofia.bg');
    const bob = await signedIn('bob@tu-sofia.bg');
    await ana.post('/api/bookings').send(slot()).expect(201);
    const list = await bob.get('/api/labs?date=2026-11-02').expect(200);
    const ten = list.body.labs.find((l) => l.id === lab).slots.find((s) => s.hour === 10);
    expect(ten.free).toBe(false);
  });
});

describe('AC-2 a taken slot', () => {
  it('AC-2 a second user booking the same slot gets 409 and no row is added', async () => {
    const ana = await signedIn('ana@tu-sofia.bg');
    const bob = await signedIn('bob@tu-sofia.bg');
    await ana.post('/api/bookings').send(slot()).expect(201);
    const before = rowCounts(db);
    const res = await bob.post('/api/bookings').send(slot());
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('This slot is already taken');
    expect(rowCounts(db)).toEqual(before);
  });
});

describe('AC-3 past slots', () => {
  it('AC-3 booking a slot on an earlier day gets 422 and no row is added', async () => {
    const ana = await signedIn('ana@tu-sofia.bg');
    const res = await ana.post('/api/bookings').send(slot({ date: '2026-10-30' }));
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('You cannot book a past slot');
    expect(rowCounts(db).bookings).toBe(0);
  });
});

describe('AC-4 three upcoming bookings', () => {
  it('AC-4 the 4th upcoming booking gets 409 and no row is added', async () => {
    const ana = await signedIn('ana@tu-sofia.bg');
    for (const hour of [8, 9, 10]) await ana.post('/api/bookings').send(slot({ hour })).expect(201);
    const res = await ana.post('/api/bookings').send(slot({ hour: 11 }));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('You can have at most 3 upcoming bookings');
    expect(rowCounts(db).bookings).toBe(3);
  });
});

describe('AC-17 not signed in', () => {
  it('AC-17 without a session, booking and listing get 401 and nothing changes', async () => {
    const before = rowCounts(db);
    for (const res of [
      await request(app).post('/api/bookings').send(slot()),
      await request(app).get('/api/bookings/mine'),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Please sign in first');
    }
    expect(rowCounts(db)).toEqual(before);
  });
});

describe('AC-18 a lab that does not exist', () => {
  it('AC-18 booking a lab that does not exist gets 404 and nothing changes', async () => {
    const ana = await signedIn('ana@tu-sofia.bg');
    const before = rowCounts(db);
    const res = await ana.post('/api/bookings').send(slot({ labId: 9999 }));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Lab not found');
    expect(rowCounts(db)).toEqual(before);
  });
});

describe('AC-19 closed slots and malformed requests', () => {
  it('AC-19 a Saturday or 20:00 gets 422; a request without a lab, a real date or a body gets 400', async () => {
    const ana = await signedIn('ana@tu-sofia.bg');
    await ana.post('/api/bookings').send(slot({ date: '2026-11-07' })).expect(422);
    await ana.post('/api/bookings').send(slot({ hour: 20 })).expect(422);
    await ana.post('/api/bookings').send({ date: '2026-11-02', hour: 10 }).expect(400);
    await ana.post('/api/bookings').send(slot({ date: '02.11.2026' })).expect(400);
    await ana.post('/api/bookings').expect(400);
    expect(rowCounts(db).bookings).toBe(0);
  });
});

describe('AC-20 my bookings', () => {
  it('AC-20 GET /api/bookings/mine lists only my upcoming bookings, soonest first', async () => {
    const ana = await signedIn('ana@tu-sofia.bg');
    const bob = await signedIn('bob@tu-sofia.bg');
    await ana.post('/api/bookings').send(slot({ date: '2026-11-03', hour: 9 })).expect(201);
    await ana.post('/api/bookings').send(slot({ hour: 15 })).expect(201);
    await bob.post('/api/bookings').send(slot({ hour: 16 })).expect(201);
    const res = await ana.get('/api/bookings/mine').expect(200);
    expect(res.body.bookings.map((b) => [b.date, b.start_hour])).toEqual([['2026-11-02', 15], ['2026-11-03', 9]]);
    expect(res.body.bookings[0]).toMatchObject({ lab_name: 'Computer Lab 1', room: '1203' });
  });

  it('AC-20 with no bookings the list is empty', async () => {
    const ana = await signedIn('ana@tu-sofia.bg');
    const res = await ana.get('/api/bookings/mine').expect(200);
    expect(res.body.bookings).toEqual([]);
  });
});

describe('AC-5, AC-6, AC-17 and AC-18 cancelling over HTTP', () => {
  it('AC-5 DELETE by the owner gets 204, removes the row and frees the slot', async () => {
    const ana = await signedIn('ana@tu-sofia.bg');
    const { body } = await ana.post('/api/bookings').send(slot()).expect(201);
    await ana.delete(`/api/bookings/${body.booking.id}`).expect(204);
    expect(rowCounts(db).bookings).toBe(0);
    const list = await ana.get('/api/labs?date=2026-11-02').expect(200);
    expect(list.body.labs.find((l) => l.id === lab).slots.find((s) => s.hour === 10).free).toBe(true);
    const mine = await ana.get('/api/bookings/mine').expect(200);
    expect(mine.body.bookings).toEqual([]);
  });

  it('AC-6 DELETE by another user gets 403 and the row is unchanged', async () => {
    const ana = await signedIn('ana@tu-sofia.bg');
    const bob = await signedIn('bob@tu-sofia.bg');
    const { body } = await ana.post('/api/bookings').send(slot()).expect(201);
    const before = db.prepare('SELECT * FROM bookings').all();
    const res = await bob.delete(`/api/bookings/${body.booking.id}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('You can only cancel your own bookings');
    expect(db.prepare('SELECT * FROM bookings').all()).toEqual(before);
  });

  it('AC-6 an admin may cancel a booking of another user (204)', async () => {
    const ana = await signedIn('ana@tu-sofia.bg');
    const admin = await signedIn('admin@tu-sofia.bg');
    db.prepare("UPDATE users SET role = 'admin' WHERE email = 'admin@tu-sofia.bg'").run();
    const { body } = await ana.post('/api/bookings').send(slot()).expect(201);
    await admin.delete(`/api/bookings/${body.booking.id}`).expect(204);
    expect(rowCounts(db).bookings).toBe(0);
  });

  it('AC-17 DELETE without a session gets 401 and the row stays', async () => {
    const ana = await signedIn('ana@tu-sofia.bg');
    const { body } = await ana.post('/api/bookings').send(slot()).expect(201);
    const res = await request(app).delete(`/api/bookings/${body.booking.id}`);
    expect(res.status).toBe(401);
    expect(rowCounts(db).bookings).toBe(1);
  });

  it('AC-18 cancelling a booking that does not exist gets 404', async () => {
    const ana = await signedIn('ana@tu-sofia.bg');
    const res = await ana.delete('/api/bookings/9999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Booking not found');
  });
});