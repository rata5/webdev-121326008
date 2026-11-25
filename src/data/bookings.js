// Data access for bookings. The only place that writes SQL for the bookings table.
// "Upcoming" means the slot has not started yet: a later date, or today at a later hour.
const UPCOMING = '(b.date > $2 OR (b.date = $2 AND b.start_hour > $3))';
const UNIQUE_VIOLATION = '23505'; // PostgreSQL's error code when a UNIQUE constraint refuses a row

function createBookingStore(db) {
  return {
    labExists: async (labId) => (await db.one('SELECT 1 FROM labs WHERE id = $1', [labId])) !== undefined,

    // Runs fn(store) in one transaction that first locks this user's row, so two bookings by the
    // same user wait for each other, and the second one counts the first.
    forUser: (userId, fn) => db.transaction(async (tx) => {
      await tx.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      return fn(createBookingStore(tx));
    }),

    // The new booking, or null when UNIQUE (lab_id, date, start_hour) refused it:
    // somebody else holds that slot, even if they got it a millisecond ago.
    async insert({ userId, labId, date, hour }) {
      try {
        return await db.one(
          'INSERT INTO bookings (user_id, lab_id, date, start_hour) VALUES ($1, $2, $3, $4) RETURNING id, user_id, lab_id, date, start_hour',
          [userId, labId, date, hour],
        );
      } catch (err) {
        if (err.code === UNIQUE_VIOLATION) return null;
        throw err;
      }
    },

    findById: (id) => db.one('SELECT id, user_id, lab_id, date, start_hour FROM bookings WHERE id = $1', [id]),

    remove: (id) => db.run('DELETE FROM bookings WHERE id = $1', [id]),

    countUpcoming: async (userId, today, hour) =>
      (await db.one(`SELECT COUNT(*)::int AS n FROM bookings b WHERE b.user_id = $1 AND ${UPCOMING}`, [userId, today, hour])).n,

    upcomingForUser: (userId, today, hour) =>
      db.query(`SELECT b.id, b.lab_id, l.name AS lab_name, l.room, b.date, b.start_hour
                FROM bookings b JOIN labs l ON l.id = b.lab_id
                WHERE b.user_id = $1 AND ${UPCOMING}
                ORDER BY b.date, b.start_hour`, [userId, today, hour]),
  };
}

module.exports = { createBookingStore };