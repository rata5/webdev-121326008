// Data access for sessions. The caller passes a hash of the token, never the token.
function createSessionStore(db) {
  return {
    create: (tokenHash, userId, expiresAt) =>
      db.run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, expiresAt]),
    // expires_at is a BIGINT; ::float8 brings it back as a JavaScript number.
    find: (tokenHash) => db.one('SELECT user_id, expires_at::float8 AS expires_at FROM sessions WHERE token_hash = $1', [tokenHash]),
    remove: (tokenHash) => db.run('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]),
    // Every session of one user: signs them out everywhere.
    removeAllFor: (userId) => db.run('DELETE FROM sessions WHERE user_id = $1', [userId]),
  };
}

module.exports = { createSessionStore };