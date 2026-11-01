// A fresh in-memory database and app for every test.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../src/data/db.js');
const { createApp } = require('../src/app.js');

export const SECRET = 'test-secret';

// The default clock is a Sunday, so the weekday dates the tests use are all in the future.
export function setup(now = () => new Date('2026-11-01T10:00:00Z')) {
  const db = openDatabase(':memory:');
  const { app, services } = createApp({ db, sessionSecret: SECRET, bcryptRounds: 4, now });
  return { db, app, services };
}

// Row counts of every table, to prove that a request changed nothing.
export function rowCounts(db) {
  const tables = ['users', 'identities', 'sessions', 'labs', 'bookings'];
  return Object.fromEntries(tables.map((t) => [t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n]));
}
