// Opens the PostgreSQL database and applies any migration that has not run yet.
// Only files in src/data/ write SQL. Parameters are written $1, $2, … as PostgreSQL wants.
const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

// Wraps anything with query(text, params): a pg Pool in the app, PGlite in the tests.
function createDb(client) {
  let migrated = null;
  const db = {
    // Every row the statement returns.
    query: async (text, params = []) => (await client.query(text, params)).rows,
    // The first row, or undefined when there is none.
    one: async (text, params = []) => (await client.query(text, params)).rows[0],
    // How many rows the statement changed.
    run: async (text, params = []) => {
      const result = await client.query(text, params);
      return result.rowCount ?? result.affectedRows ?? 0;
    },
    // Several statements in one string, without parameters.
        // Several statements in one string, without parameters.
    exec: (sql) => (client.exec ? client.exec(sql) : client.query(sql)),
    // Runs fn(tx) as one transaction on one connection; tx has the same query, one and run.
    // If fn throws, nothing it wrote is kept. PGlite has transaction() built in; a pg Pool
    // lends out one connection for the whole transaction.
    async transaction(fn) {
      if (client.transaction) return client.transaction((tx) => fn(createDb(tx)));
      const connection = await client.connect();
      try {
        await connection.query('BEGIN');
        const result = await fn(createDb(connection));
        await connection.query('COMMIT');
        return result;
      } catch (err) {
        await connection.query('ROLLBACK');
        throw err;
      } finally {
        connection.release();
      }
    },
    // Runs the migrations once. If the database was unreachable, the next call tries again.
    ready() {
      migrated ??= migrate(db).catch((err) => {
        migrated = null;
        throw err;
      });
      return migrated;
    },
  };
  return db;
}

async function migrate(db) {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const done = new Set((await db.query('SELECT name FROM schema_migrations')).map((r) => r.name));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    // One string, so PostgreSQL runs it as one transaction: the migration and its row in
    // schema_migrations are saved together, or neither is.
    await db.exec(`${sql}\n;\nINSERT INTO schema_migrations (name) VALUES ('${file.replace(/'/g, "''")}');`);
  }
}

// DATABASE_URL looks like postgresql://user:password@host/dbname?sslmode=verify-full
function openDatabase(url) {
  const { Pool } = require('pg');
  return createDb(new Pool({ connectionString: url, connectionTimeoutMillis: 10_000 }));
}

module.exports = { openDatabase, createDb };