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
  };
}

module.exports = { createUserStore };