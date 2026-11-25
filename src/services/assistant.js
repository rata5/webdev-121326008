// "Find me a slot": a user describes in plain words when they need a lab and gets up to 3
// free slots. The model only suggests. This service decides what the user sees: every
// suggestion is checked against the free slots read from the database, and when the model
// is missing, slow or failing, the user gets the first free slots of the chosen day instead.
const { AppError } = require('./errors');
const { parseDate, localNow } = require('./labs');

const MAX_SUGGESTIONS = 3;
const DAYS_AHEAD = 7;
const MAX_REQUEST = 300;
const SLOW = 'The assistant is taking too long. Here are the free slots for the day you picked instead.';
const UNAVAILABLE = 'The assistant is unavailable right now, you can still pick a slot from the list.';
const NO_MATCH = 'No matching free slot found, try another day.';

const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const weekday = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
const slotKey = (labId, date, hour) => `${labId}|${date}|${hour}`;

// The suggestions in the model's answer, or [] when it is not the JSON we asked for.
function suggestionsIn(answer) {
  try {
    const value = JSON.parse(answer);
    const list = Array.isArray(value) ? value : value?.suggestions;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function createAssistantService({ labService, client, now = () => new Date(), timeZone = 'Europe/Sofia', timeoutMs = 10_000 }) {
  // The free slots that have not started on one date, earliest first, from the database.
  async function freeOn(date) {
    return (await labService.listWithSlots(date)).labs
      .flatMap((lab) => lab.slots
        .filter((slot) => slot.bookable)
        .map((slot) => ({ labId: lab.id, labName: lab.name, room: lab.room, capacity: lab.capacity, date, hour: slot.hour, label: slot.label })))
      .sort((a, b) => a.hour - b.hour);
  }

  // What the model sees: the request, today's date, and the free slots of the next 7 days.
  // No name, email or other personal data goes in.
  function prompt(request, today, slots) {
    const labs = new Map();
    for (const s of slots) {
      if (!labs.has(s.labId)) labs.set(s.labId, { title: `Lab ${s.labId}: "${s.labName}", room ${s.room}, ${s.capacity} seats`, days: new Map() });
      const { days } = labs.get(s.labId);
      if (!days.has(s.date)) days.set(s.date, []);
      days.get(s.date).push(s.hour);
    }
    const lines = [...labs.values()].flatMap(({ title, days }) => [
      title,
      ...[...days].map(([date, hours]) => `  ${date} (${weekday(date)}): free at ${hours.join(', ')} o'clock`),
    ]);
    return [
      'You help a teacher book a university computer lab for a one-hour slot.',
      `Today is ${today} (${weekday(today)}). These are the only free slots:`,
      ...lines,
      '',
      `The teacher asks: """${request}"""`,
      '',
      'Answer with JSON only, at most 3 suggestions, best first, taken only from the free slots above:',
      '{"suggestions":[{"labId":1,"date":"YYYY-MM-DD","startHour":10,"reason":"one short sentence"}]}',
      'If nothing fits, answer {"suggestions":[]}.',
    ].join('\n');
  }

  // The model's answer, or the reason there is none. Never throws, never waits past the deadline.
  async function ask(text) {
    let timer;
    const deadline = new Promise((resolve) => {
      timer = setTimeout(() => resolve({ failed: 'timeout' }), timeoutMs);
    });
    const reply = Promise.resolve()
      .then(() => client.complete(text))
      .then((answer) => ({ answer }), (err) => ({ failed: err?.reason ?? 'down' }));
    const outcome = await Promise.race([reply, deadline]);
    clearTimeout(timer);
    return outcome;
  }

  // AC-10
  async function findSlots({ request, date } = {}) {
    const text = String(request ?? '').trim();
    if (!text || text.length > MAX_REQUEST) {
      throw new AppError('VALIDATION', `Describe when you need a lab, in up to ${MAX_REQUEST} characters`);
    }
    if (!parseDate(date)) throw new AppError('VALIDATION', 'Choose a valid date (YYYY-MM-DD)');

    const today = localNow(now(), timeZone).date;
    const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
    const upcoming = (await Promise.all(days.map(freeOn))).flat();
    const { answer, failed } = await ask(prompt(text, today, upcoming));

    if (failed) {
      const fallback = (await freeOn(date)).slice(0, MAX_SUGGESTIONS).map((slot) => ({ ...slot, reason: 'A free slot on the day you picked' }));
      return { source: 'fallback', notice: failed === 'timeout' ? SLOW : UNAVAILABLE, suggestions: fallback };
    }

    // RULE AC-10: show only suggestions that name a real, free, future slot from the database.
    const free = new Map(upcoming.map((slot) => [slotKey(slot.labId, slot.date, slot.hour), slot]));
    const suggestions = [];
    for (const s of suggestionsIn(answer)) {
      const key = slotKey(s?.labId, s?.date, s?.startHour);
      const slot = free.get(key);
      if (!slot) continue; // an invented lab, a taken or past slot, or a repeat: dropped
      free.delete(key);
      suggestions.push({ ...slot, reason: typeof s.reason === 'string' ? s.reason.slice(0, 200) : '' });
      if (suggestions.length === MAX_SUGGESTIONS) break;
    }
    return { source: 'model', notice: suggestions.length ? null : NO_MATCH, suggestions };
  }

  return { findSlots };
}

module.exports = { createAssistantService, SLOW, UNAVAILABLE, NO_MATCH };