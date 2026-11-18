// Data access for sessions. The caller passes a hash of the token, never the token.
function createSessionStore(db) {
  const insert = db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)');
  const find = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?');
  const remove = db.prepare('DELETE FROM sessions WHERE token_hash = ?');

  return {
    create: (tokenHash, userId, expiresAt) => insert.run(tokenHash, userId, expiresAt),
    find: (tokenHash) => find.get(tokenHash),
    remove: (tokenHash) => remove.run(tokenHash),
  };
}

module.exports = { createSessionStore };
