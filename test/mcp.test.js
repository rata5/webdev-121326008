// The MCP server's project tools run the same services, as the user in MCP_TOKEN,
// so they obey the same rules and give the same messages as the HTTP API.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { setup, rowCounts } from './helpers.js';
const require = createRequire(import.meta.url);
const { handle, useServices } = require('../mcp-server/server.js');

let db; let services; let lab; let bob; let savedToken;
beforeEach(async () => {
  ({ db, services } = await setup());
  useServices(services);
  savedToken = process.env.MCP_TOKEN;
  process.env.MCP_TOKEN = (await services.auth.signUp({ email: 'ana@tu-sofia.bg', password: 'correct-horse' })).token;
  bob = (await services.auth.signUp({ email: 'bob@tu-sofia.bg', password: 'correct-horse' })).user;
  lab = (await db.one('SELECT id FROM labs ORDER BY name LIMIT 1')).id; // Computer Lab 1
});
afterEach(() => {
  process.env.MCP_TOKEN = savedToken ?? '';
});

let nextId = 1;
// One tools/call, answered with the tool's text and whether it is an error.
async function call(name, args = {}) {
  const reply = await handle({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: args } });
  return { text: reply.result.content[0].text, isError: reply.result.isError };
}

describe('AC-11 MCP tools use the same rules as the API', () => {
  it('AC-11 book_slot refuses a taken slot with "This slot is already taken" and adds no row', async () => {
    await services.bookingService.book(bob, { labId: lab, date: '2026-11-02', hour: 10 });
    const before = (await rowCounts(db)).bookings;
    expect(await call('book_slot', { labId: lab, date: '2026-11-02', hour: 10 })).toEqual({ text: 'This slot is already taken', isError: true });
    expect((await rowCounts(db)).bookings).toBe(before);
  });

  it('AC-11 book_slot books a free slot for the user in MCP_TOKEN', async () => {
    expect((await call('book_slot', { labId: lab, date: '2026-11-02', hour: 11 })).isError).toBe(false);
    const ana = await db.one("SELECT id FROM users WHERE email = 'ana@tu-sofia.bg'");
    expect(await db.query('SELECT user_id, start_hour FROM bookings')).toEqual([{ user_id: ana.id, start_hour: 11 }]);
  });

  it('AC-11 AC-6 cancel_booking refuses a booking of another user, as the API does', async () => {
    const theirs = await services.bookingService.book(bob, { labId: lab, date: '2026-11-02', hour: 12 });
    expect(await call('cancel_booking', { bookingId: theirs.id })).toEqual({ text: 'You can only cancel your own bookings', isError: true });
    expect((await rowCounts(db)).bookings).toBe(1);
  });

  it('AC-11 list_my_bookings shows my booking and cancel_booking frees it', async () => {
    await call('book_slot', { labId: lab, date: '2026-11-03', hour: 9 });
    const listed = await call('list_my_bookings');
    expect(listed.text).toContain('Computer Lab 1');
    const id = Number(listed.text.match(/Booking (\d+)/)[1]);
    expect((await call('cancel_booking', { bookingId: id })).isError).toBe(false);
    expect((await call('list_my_bookings')).text).toBe('No upcoming bookings.');
  });

  it('AC-11 list_labs and find_free_slots read the same data as the lab list', async () => {
    expect((await call('list_labs')).text).toContain('Networks Lab');
    await services.bookingService.book(bob, { labId: lab, date: '2026-11-02', hour: 10 });
    const free = (await call('find_free_slots', { date: '2026-11-02', labId: lab })).text;
    expect(free).toContain('09:00–10:00');
    expect(free).not.toContain('10:00–11:00');
    expect((await call('find_free_slots', { date: '2026-11-07' })).text).toContain('closed');
    expect(await call('find_free_slots', { date: 'someday' })).toEqual({ text: 'Choose a valid date (YYYY-MM-DD)', isError: true });
  });

  it('AC-11 without a valid MCP_TOKEN every project tool is refused and nothing changes', async () => {
    process.env.MCP_TOKEN = 'not-a-session-token';
    for (const name of ['list_labs', 'find_free_slots', 'book_slot', 'list_my_bookings', 'cancel_booking']) {
      expect((await call(name, { date: '2026-11-02', labId: lab, hour: 9, bookingId: 1 })).isError).toBe(true);
    }
    expect((await rowCounts(db)).bookings).toBe(0);
  });
});

describe('R10 the MCP server leaves the booking rules to the services', () => {
  it('R10 names no time zone and decides no slot rule of its own', () => {
    const { readFileSync } = require('node:fs');
    expect(readFileSync('mcp-server/server.js', 'utf8')).not.toMatch(/Europe\/Sofia|slot\.free|slot\.past/);
  });
});