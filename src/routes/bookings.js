// HTTP routes for booking a slot and cancelling it. A handler reads the request, calls
// the booking service, and turns the answer or the AppError into a status code.
// No rule lives here: see src/services/bookings.js.
const express = require('express');
const { requireUserApi, sendError } = require('./http');

function bookingRoutes({ bookingService }) {
  const router = express.Router();

  // POST /api/bookings  { "labId": 1, "date": "2026-11-23", "hour": 10 }
  router.post('/', requireUserApi, (req, res) => {
    try {
      const booking = bookingService.book(req.user, req.body ?? {});
      res.status(201).json({ booking, message: 'Booking confirmed' });
    } catch (err) {
      sendError(res, err);
    }
  });

  // GET /api/bookings/mine
  router.get('/mine', requireUserApi, (req, res) => {
    try {
      res.json({ bookings: bookingService.upcomingFor(req.user) });
    } catch (err) {
      sendError(res, err);
    }
  });

    // DELETE /api/bookings/42
  router.delete('/:id', requireUserApi, (req, res) => {
    try {
      bookingService.cancel(req.user, req.params.id);
      res.status(204).end();
    } catch (err) {
      sendError(res, err);
    }
  });
  
  return router;
}

module.exports = { bookingRoutes };