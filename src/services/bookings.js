const { AppError } = require('./errors');
const { parseDate, localNow, FIRST_HOUR, LAST_HOUR } = require('./labs');

const MAX_UPCOMING = 3;

// 7 or "7" -> 7. Anything else (null, "", "7.5", "seven") -> null.
function wholeNumber(value) {
  if (Number.isInteger(value)) return value;
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : null;
}

function createBookingService({ bookings, now = () => new Date(), timeZone = 'Europe/Sofia' }) {
  // AC-1 to AC-4, AC-18, AC-19
  function book(user, { labId, date, hour } = {}) {
    const lab = wholeNumber(labId);
    const start = wholeNumber(hour);
    const day = parseDate(date);
    if (lab === null || start === null || !day) {
      throw new AppError('VALIDATION', 'Choose a lab, a date (YYYY-MM-DD) and an hour');
    }
    if (!bookings.labExists(lab)) throw new AppError('NOT_FOUND', 'Lab not found');
    const weekday = day.getUTCDay();
    if (weekday === 0 || weekday === 6 || start < FIRST_HOUR || start > LAST_HOUR) {
      throw new AppError('CLOSED', 'Labs can be booked Monday to Friday, 08:00 to 20:00');
    }
    const today = localNow(now(), timeZone);
    // RULE AC-3: a slot that has started cannot be booked.
    if (date < today.date || (date === today.date && start <= today.hour)) {
      throw new AppError('PAST_SLOT', 'You cannot book a past slot');
    }
    // RULE AC-4: at most 3 upcoming bookings per user.
    if (bookings.countUpcoming(user.id, today.date, today.hour) >= MAX_UPCOMING) {
      throw new AppError('TOO_MANY_BOOKINGS', `You can have at most ${MAX_UPCOMING} upcoming bookings`);
    }
    // RULE AC-2: one booking per lab and slot. The UNIQUE constraint decides, so two
    // requests at the same moment cannot both win; insert() answers null to the loser.
    const booking = bookings.insert({ userId: user.id, labId: lab, date, hour: start });
    if (!booking) throw new AppError('SLOT_TAKEN', 'This slot is already taken');
    return booking;
  }

    // AC-5, AC-6, AC-18
  function cancel(user, bookingId) {
    const id = wholeNumber(bookingId);
    const booking = id === null ? undefined : bookings.findById(id);
    if (!booking) throw new AppError('NOT_FOUND', 'Booking not found');
    // RULE AC-6: only the owner, or an admin, may cancel a booking.
    if (booking.user_id !== user.id && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'You can only cancel your own bookings');
    }
    bookings.remove(booking.id);
  }

  // AC-20
  function upcomingFor(user) {
    const today = localNow(now(), timeZone);
    return bookings.upcomingForUser(user.id, today.date, today.hour);
  }

  return { book, cancel, upcomingFor };
}

module.exports = { createBookingService, MAX_UPCOMING };