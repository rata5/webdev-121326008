// Data access for bookings. The only place that writes SQL for the bookings table.
// "Upcoming" means the slot has not started yet: a later date, or today at a later hour.
function createBookingStore(db) {
  const UPCOMING = '(b.date > ? OR (b.date = ? AND b.start_hour > ?))';
  const byId = db.prepare('SELECT id, user_id, lab_id, date, start_hour FROM bookings WHERE id = ?');
  const add = db.prepare('INSERT INTO bookings (user_id, lab_id, date, start_hour) VALUES (?, ?, ?, ?)');

  return {
    labExists: (labId) => db.prepare('SELECT 1 FROM labs WHERE id = ?').get(labId) !== undefined,

    insert({ userId, labId, date, hour }) {
      try {
        const { lastInsertRowid } = add.run(userId, labId, date, hour);
        return byId.get(lastInsertRowid);
      } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return null;
        throw err;
      }
    },

    findById: (id) => byId.get(id),

    remove: (id) => db.prepare('DELETE FROM bookings WHERE id = ?').run(id),

    countUpcoming: (userId, today, hour) =>
      db.prepare(`SELECT COUNT(*) AS n FROM bookings b WHERE b.user_id = ? AND ${UPCOMING}`).get(userId, today, today, hour).n,

    upcomingForUser: (userId, today, hour) =>
      db.prepare(`SELECT b.id, b.lab_id, l.name AS lab_name, l.room, b.date, b.start_hour
                  FROM bookings b JOIN labs l ON l.id = b.lab_id
                  WHERE b.user_id = ? AND ${UPCOMING}
                  ORDER BY b.date, b.start_hour`).all(userId, today, today, hour),
  };
}

module.exports = { createBookingStore };