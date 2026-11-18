// Data access for users and their sign-in identities.
function createUserStore(db) {
  const byEmail = db.prepare('SELECT id, email, password_hash, role FROM users WHERE email = ?');
  const byId = db.prepare('SELECT id, email, role FROM users WHERE id = ?');
  const insertUser = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
  const insertIdentity = db.prepare('INSERT INTO identities (user_id, provider, provider_id) VALUES (?, ?, ?)');

  return {
    findByEmail: (email) => byEmail.get(email),
    findById: (id) => byId.get(id),
    // A new local user and their 'local' identity, in one transaction.
    createLocal: db.transaction((email, passwordHash) => {
      const { lastInsertRowid } = insertUser.run(email, passwordHash);
      insertIdentity.run(lastInsertRowid, 'local', email);
      return byId.get(lastInsertRowid);
    }),
  };
}

module.exports = { createUserStore };
