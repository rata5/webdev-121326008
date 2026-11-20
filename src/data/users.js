// Data access for users and their sign-in identities.
function createUserStore(db) {
  return {
    findByEmail: (email) => db.one('SELECT id, email, password_hash, role FROM users WHERE email = $1', [email]),
    findById: (id) => db.one('SELECT id, email, role FROM users WHERE id = $1', [id]),
    // A new local user and their 'local' identity. One statement, so both rows are
    // saved or neither is.
    createLocal: (email, passwordHash) => db.one(
      `WITH u AS (INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role),
            i AS (INSERT INTO identities (user_id, provider, provider_id) SELECT id, 'local', $1 FROM u)
       SELECT id, email, role FROM u`,
      [email, passwordHash],
    ),

        // The user who signed in with this provider account before, or undefined.
    findByIdentity: (provider, providerId) => db.one(
      `SELECT u.id, u.email, u.role FROM users u JOIN identities i ON i.user_id = u.id
       WHERE i.provider = $1 AND i.provider_id = $2`,
      [provider, providerId],
    ),
    addIdentity: (userId, provider, providerId) =>
      db.run('INSERT INTO identities (user_id, provider, provider_id) VALUES ($1, $2, $3)', [userId, provider, providerId]),
    // A new user with no password, and the provider identity they signed in with.
    createWithIdentity: (email, provider, providerId) => db.one(
      `WITH u AS (INSERT INTO users (email) VALUES ($1) RETURNING id, email, role),
            i AS (INSERT INTO identities (user_id, provider, provider_id) SELECT id, $2::text, $3::text FROM u)
       SELECT id, email, role FROM u`,
      [email, provider, providerId],
    ),
  };
}

module.exports = { createUserStore };