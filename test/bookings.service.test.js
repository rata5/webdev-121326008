// Slice 2 rules, called on the booking service directly: no HTTP in between.
// Each title names the acceptance criterion it proves; refusals assert the error code.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { setup, rowCounts } from './helpers.js';
const require = createRequire(import.meta.url);
const { createBookingService } = require('../src/services/bookings.js');
const { createBookingStore } = require('../src/data/bookings.js');
const { AppError } = require('../src/services/errors.js');

// Monday 2 November 2026, 10:30 in Sofia (08:30 UTC): the 08, 09 and 10 o'clock slots have started.
const mondayHalfPastTen = () => new Date('2026-11-02T08:30:00Z');

let db; let service; let ana; let bob; let lab;
beforeEach(async () => {
  ({ db } = await setup());
  service = createBookingService({ bookings: createBookingStore(db), now: mondayHalfPastTen });
  const addUser = async (email) => (await db.one("INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id", [email])).id;
  ana = { id: await addUser('ana@tu-sofia.bg'), role: 'user' };
  bob = { id: await addUser('bob@tu-sofia.bg'), role: 'user' };
  lab = (await db.one('SELECT id FROM labs ORDER BY name LIMIT 1')).id; // Computer Lab 1, room 1203
});

// The error a call rejects with, so a test can check its code rather than its wording.
async function refusal(call) {
  try {
    await call();
  } catch (err) {
    return err;
  }
  throw new Error('expected the call to be refused, but it succeeded');
}

describe('AC-1 booking a free slot', () => {
  it('AC-1 stores one row with the user, the lab, the date and the hour', async () => {
    const booking = await service.book(ana, { labId: lab, date: '2026-11-02', hour: 11 });
    expect(booking).toMatchObject({ user_id: ana.id, lab_id: lab, date: '2026-11-02', start_hour: 11 });
    expect(await db.query('SELECT user_id, lab_id, date, start_hour FROM bookings'))
      .toEqual([{ user_id: ana.id, lab_id: lab, date: '2026-11-02', start_hour: 11 }]);
  });

  it('AC-1 accepts the lab id and the hour as text, the way a form sends them', async () => {
    expect(await service.book(ana, { labId: String(lab), date: '2026-11-03', hour: '8' })).toMatchObject({ start_hour: 8 });
  });
});

describe('AC-2 one booking per lab and slot', () => {
  it('AC-2 a second booking of the same lab and slot is refused with SLOT_TAKEN and adds no row', async () => {
    await service.book(ana, { labId: lab, date: '2026-11-03', hour: 9 });
    const before = (await rowCounts(db)).bookings;
    const err = await refusal(() => service.book(bob, { labId: lab, date: '2026-11-03', hour: 9 }));
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('SLOT_TAKEN');
    expect((await rowCounts(db)).bookings).toBe(before);
  });

  it('AC-2 the same hour in another lab, and the next hour in the same lab, stay free', async () => {
    const other = (await db.one('SELECT id FROM labs WHERE id != $1 LIMIT 1', [lab])).id;
    await service.book(ana, { labId: lab, date: '2026-11-03', hour: 9 });
    expect(await service.book(bob, { labId: other, date: '2026-11-03', hour: 9 })).toBeTruthy();
    expect(await service.book(bob, { labId: lab, date: '2026-11-03', hour: 10 })).toBeTruthy();
  });
});

describe('AC-3 no past slots', () => {
  it('AC-3 a slot that has started today is refused with PAST_SLOT, and the next hour is not', async () => {
    expect((await refusal(() => service.book(ana, { labId: lab, date: '2026-11-02', hour: 10 }))).code).toBe('PAST_SLOT');
    expect((await refusal(() => service.book(ana, { labId: lab, date: '2026-11-02', hour: 8 }))).code).toBe('PAST_SLOT');
    expect(await service.book(ana, { labId: lab, date: '2026-11-02', hour: 11 })).toBeTruthy();
  });

  it('AC-3 a slot on an earlier day is refused with PAST_SLOT and adds no row', async () => {
    expect((await refusal(() => service.book(ana, { labId: lab, date: '2026-10-30', hour: 19 }))).code).toBe('PAST_SLOT');
    expect((await rowCounts(db)).bookings).toBe(0);
  });
});

describe('AC-4 at most 3 upcoming bookings', () => {
  it('AC-4 a 4th upcoming booking is refused with TOO_MANY_BOOKINGS and adds no row', async () => {
    for (const hour of [11, 12, 13]) await service.book(ana, { labId: lab, date: '2026-11-02', hour });
    expect((await refusal(() => service.book(ana, { labId: lab, date: '2026-11-03', hour: 8 }))).code).toBe('TOO_MANY_BOOKINGS');
    expect((await rowCounts(db)).bookings).toBe(3);
  });

  it('AC-4 bookings whose slot has started do not count', async () => {
    const add = 'INSERT INTO bookings (user_id, lab_id, date, start_hour) VALUES ($1, $2, $3, $4)';
    await db.run(add, [ana.id, lab, '2026-10-30', 9]); // last Friday
    await db.run(add, [ana.id, lab, '2026-11-02', 10]); // today, started at 10:00
    for (const hour of [11, 12]) await service.book(ana, { labId: lab, date: '2026-11-02', hour });
    expect(await service.book(ana, { labId: lab, date: '2026-11-02', hour: 13 })).toBeTruthy();
  });

  it('AC-4 bookings of other users do not count', async () => {
    for (const hour of [11, 12, 13]) await service.book(bob, { labId: lab, date: '2026-11-02', hour });
    expect(await service.book(ana, { labId: lab, date: '2026-11-02', hour: 14 })).toBeTruthy();
  });
});

describe('AC-18 a lab that does not exist', () => {
  it('AC-18 a lab that does not exist is refused with NOT_FOUND and adds no row', async () => {
    expect((await refusal(() => service.book(ana, { labId: 9999, date: '2026-11-03', hour: 9 }))).code).toBe('NOT_FOUND');
    expect((await rowCounts(db)).bookings).toBe(0);
  });
});

describe('AC-19 only real, open slots', () => {
  it('AC-19 a Saturday, a Sunday, 07:00 and 20:00 are refused with CLOSED and add no row', async () => {
    for (const [date, hour] of [['2026-11-07', 10], ['2026-11-08', 10], ['2026-11-03', 7], ['2026-11-03', 20]]) {
      expect((await refusal(() => service.book(ana, { labId: lab, date, hour }))).code).toBe('CLOSED');
    }
    expect((await rowCounts(db)).bookings).toBe(0);
  });

  it('AC-19 no lab, a date that is not real, or an hour that is not whole is refused with VALIDATION', async () => {
    const bad = [
      {},
      { labId: 'one', date: '2026-11-03', hour: 9 },
      { labId: 3000000000, date: '2026-11-03', hour: 9 }, // bigger than any id PostgreSQL can store
      { labId: lab, date: '2026-02-30', hour: 9 },
      { labId: lab, date: 'tomorrow', hour: 9 },
      { labId: lab, date: '2026-11-03', hour: 9.5 },
      { labId: lab, date: '2026-11-03', hour: '9am' },
    ];
    for (const input of bad) expect((await refusal(() => service.book(ana, input))).code).toBe('VALIDATION');
    expect((await refusal(() => service.book(ana))).code).toBe('VALIDATION');
  });
});

describe('AC-20 my upcoming bookings', () => {
  it('AC-20 lists only my upcoming bookings, soonest first, with the lab name and room', async () => {
    await service.book(ana, { labId: lab, date: '2026-11-04', hour: 9 });
    await service.book(ana, { labId: lab, date: '2026-11-02', hour: 15 });
    await service.book(bob, { labId: lab, date: '2026-11-02', hour: 16 });
    await db.run('INSERT INTO bookings (user_id, lab_id, date, start_hour) VALUES ($1, $2, $3, 9)', [ana.id, lab, '2026-11-02']);
    const mine = await service.upcomingFor(ana);
    expect(mine.map((b) => [b.date, b.start_hour])).toEqual([['2026-11-02', 15], ['2026-11-04', 9]]);
    expect(mine[0]).toMatchObject({ lab_id: lab, lab_name: 'Computer Lab 1', room: '1203' });
  });

  it('AC-20 the real clock is used when none is given', async () => {
    await db.run('INSERT INTO bookings (user_id, lab_id, date, start_hour) VALUES ($1, $2, $3, 9)', [ana.id, lab, '2099-12-31']);
    const real = createBookingService({ bookings: createBookingStore(db) });
    expect((await real.upcomingFor(ana)).map((b) => b.date)).toEqual(['2099-12-31']);
  });
});

describe('AC-5, AC-6 and AC-18 cancelling', () => {
  it('AC-5 the owner cancels their booking and the row is removed', async () => {
    const { id } = await service.book(ana, { labId: lab, date: '2026-11-03', hour: 9 });
    await service.cancel(ana, id);
    expect(await db.one('SELECT id FROM bookings WHERE id = $1', [id])).toBeUndefined();
  });

  it('AC-5 a cancelled slot can be booked again', async () => {
    const { id } = await service.book(ana, { labId: lab, date: '2026-11-03', hour: 9 });
    await service.cancel(ana, String(id));
    expect(await service.book(bob, { labId: lab, date: '2026-11-03', hour: 9 })).toMatchObject({ user_id: bob.id });
  });

  it('AC-6 another user is refused with FORBIDDEN and the row is unchanged', async () => {
    const booking = await service.book(ana, { labId: lab, date: '2026-11-03', hour: 9 });
    expect((await refusal(() => service.cancel(bob, booking.id))).code).toBe('FORBIDDEN');
    expect(await db.one('SELECT id, user_id, lab_id, date, start_hour FROM bookings WHERE id = $1', [booking.id])).toEqual(booking);
  });

  it('AC-6 an admin may cancel any booking', async () => {
    const { id } = await service.book(ana, { labId: lab, date: '2026-11-03', hour: 9 });
    await service.cancel({ id: bob.id, role: 'admin' }, id);
    expect((await rowCounts(db)).bookings).toBe(0);
  });

  it('AC-18 cancelling a booking that does not exist is refused with NOT_FOUND', async () => {
    for (const id of [9999, 'abc', '99999999999']) {
      expect((await refusal(() => service.cancel(ana, id))).code).toBe('NOT_FOUND');
    }
  });
});