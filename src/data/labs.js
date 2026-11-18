// Data access for labs and the bookings that make a slot taken.
function createLabStore(db) {
  const all = db.prepare('SELECT id, name, room, capacity FROM labs ORDER BY name');
  const taken = db.prepare('SELECT lab_id, start_hour FROM bookings WHERE date = ?');

  return {
    all: () => all.all(),
    takenSlotsOn: (date) => taken.all(date),
  };
}

module.exports = { createLabStore };
