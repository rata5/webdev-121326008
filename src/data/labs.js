// Data access for labs and the bookings that make a slot taken.
function createLabStore(db) {
  return {
    all: () => db.query('SELECT id, name, room, capacity FROM labs ORDER BY name'),
    takenSlotsOn: (date) => db.query('SELECT lab_id, start_hour FROM bookings WHERE date = $1', [date]),
    add: ({ name, room, capacity }) =>
      db.one('INSERT INTO labs (name, room, capacity) VALUES ($1, $2, $3) RETURNING id, name, room, capacity', [name, room, capacity]),
  };
}

module.exports = { createLabStore };