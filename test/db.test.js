// db.transaction() on a pg Pool: one borrowed connection, BEGIN and COMMIT, or ROLLBACK when a step fails.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createDb } = require('../src/data/db.js');

describe('R4 a transaction on a pg Pool', () => {
  it('R4 runs on one connection, commits, and rolls back when a step fails', async () => {
    const log = [];
    const connection = { query: async (text) => { log.push(text); return { rows: [], rowCount: 0 }; }, release: () => log.push('release') };
    const db = createDb({ query: async () => ({ rows: [] }), connect: async () => connection });
    await db.transaction((tx) => tx.run('SELECT 1'));
    await expect(db.transaction(async () => { throw new Error('a step failed'); })).rejects.toThrow('a step failed');
    expect(log).toEqual(['BEGIN', 'SELECT 1', 'COMMIT', 'release', 'BEGIN', 'ROLLBACK', 'release']);
  });
});