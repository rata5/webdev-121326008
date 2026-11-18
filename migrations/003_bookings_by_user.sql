-- 003: "My bookings" and the 3-upcoming-bookings rule look bookings up by user and date.
-- The double-booking rule needs no change here: UNIQUE (lab_id, date, start_hour) from 001 already backs it.
CREATE INDEX bookings_by_user ON bookings (user_id, date, start_hour);
