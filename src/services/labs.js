// The lab list: every lab with its free and taken one-hour slots on one date.
const { AppError } = require('./errors');

const FIRST_HOUR = 8; // first slot starts 08:00
const LAST_HOUR = 19; // last slot starts 19:00 and ends 20:00

const pad = (n) => String(n).padStart(2, '0');

// "2026-11-03" -> a Date at UTC midnight, or null if it is not a real date.
function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return date.toISOString().slice(0, 10) === value ? date : null;
}

// Today's date and the current hour where the labs are, e.g. { date: '2026-11-02', hour: 10 }.
function localNow(now, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

function createLabService({ labs, now = () => new Date(), timeZone = 'Europe/Sofia' }) {
  function listWithSlots(date) {
    const day = parseDate(date);
    if (!day) throw new AppError('VALIDATION', 'Choose a valid date (YYYY-MM-DD)');
    const weekday = day.getUTCDay();
    const open = weekday >= 1 && weekday <= 5; // Monday to Friday

    const today = localNow(now(), timeZone);
    // A slot is past when its day is before today, or it is today and its hour has started.
    const isPast = (hour) => date < today.date || (date === today.date && hour <= today.hour);

    const taken = new Set(labs.takenSlotsOn(date).map((b) => `${b.lab_id}:${b.start_hour}`));
    return {
      date,
      open,
      labs: labs.all().map((lab) => ({
        ...lab,
        slots: open
          ? Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => {
              const hour = FIRST_HOUR + i;
              return { hour, label: `${pad(hour)}:00–${pad(hour + 1)}:00`, free: !taken.has(`${lab.id}:${hour}`), past: isPast(hour) };
            })
          : [],
      })),
    };
  }

  return { listWithSlots };
}

module.exports = { createLabService, FIRST_HOUR, LAST_HOUR };
