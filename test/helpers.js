// A fresh database and app for every test. The database is PGlite: real PostgreSQL that runs
// inside Node, so the tests need no database server, no Docker and no DATABASE_URL.
import { PGlite } from '@electric-sql/pglite';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createDb } = require('../src/data/db.js');
const { createApp } = require('../src/app.js');

export const SECRET = 'test-secret';

// Tests never call the model provider. Unless a test brings its own fake client,
// the app gets one that always fails, as if the provider were down.
export const providerDown = {
  complete: async () => {
    throw Object.assign(new Error('tests never call the provider'), { reason: 'down' });
  },
};

// One PGlite per test file, emptied before every test: starting it takes a moment, emptying
// it takes milliseconds. So call setup() once per test; a second call empties the database
// that the first call's app is using.
let pglite;

// The default clock is a Sunday, so the weekday dates the tests use are all in the future.
export async function setup(now = () => new Date('2026-11-01T10:00:00Z'), { modelClient = providerDown } = {}) {
  pglite ??= new PGlite();
  await pglite.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const db = createDb(pglite);
  await db.ready(); // runs every migration on the empty database
  const { app, services } = createApp({ db, sessionSecret: SECRET, bcryptRounds: 4, now, modelClient });
  return { db, app, services };
}

// Row counts of every table, to prove that a request changed nothing.
export async function rowCounts(db) {
  const counts = {};
  for (const table of ['users', 'identities', 'sessions', 'labs', 'bookings']) {
    counts[table] = (await db.one(`SELECT COUNT(*)::int AS n FROM ${table}`)).n;
  }
  return counts;
}