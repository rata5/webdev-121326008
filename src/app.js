// Builds the Express app from a database. Tests pass an in-memory database.
const path = require('node:path');
const express = require('express');
const { createUserStore } = require('./data/users');
const { createSessionStore } = require('./data/sessions');
const { createLabStore } = require('./data/labs');
const { createBookingStore } = require('./data/bookings');
const { createAuthService } = require('./services/auth');
const { createLabService } = require('./services/labs');
const { createBookingService } = require('./services/bookings');
const { loadUser } = require('./routes/http');
const { authRoutes } = require('./routes/auth');
const { labRoutes } = require('./routes/labs');
const { bookingRoutes } = require('./routes/bookings');
const { pageRoutes } = require('./routes/pages');

function createApp({ db, sessionSecret, secureCookies = false, bcryptRounds, now }) {
  const auth = createAuthService({ users: createUserStore(db), sessions: createSessionStore(db), bcryptRounds });
  const labService = createLabService({ labs: createLabStore(db), now });
  const bookingService = createBookingService({ bookings: createBookingStore(db), now });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/assets', express.static(path.join(__dirname, '..', 'public')));
  app.use(loadUser(auth, sessionSecret));

  app.use('/api/auth', authRoutes({ auth, secret: sessionSecret, secureCookies }));
  app.use('/api/labs', labRoutes({ labService }));
  app.use('/api/bookings', bookingRoutes({ bookingService }));
  app.use('/', pageRoutes());

  return { app, services: { auth, labService, bookingService } };
}

module.exports = { createApp };
