// Builds the Express app from a database. Tests pass an in-memory database.
const path = require('node:path');
const express = require('express');
const { createServices } = require('./services');
const { createModelClient } = require('./model/client');
const { loadUser } = require('./routes/http');
const { authRoutes } = require('./routes/auth');
const { labRoutes } = require('./routes/labs');
const { bookingRoutes } = require('./routes/bookings');
const { assistantRoutes } = require('./routes/assistant');
const { pageRoutes } = require('./routes/pages');

function createApp({ db, sessionSecret, secureCookies = false, bcryptRounds, now, modelClient = createModelClient() }) {
  const services = createServices({ db, now, bcryptRounds, modelClient });
  const { auth, labService, bookingService, assistant } = services;

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/assets', express.static(path.join(__dirname, '..', 'public')));
  app.use(loadUser(auth, sessionSecret));

  app.use('/api/auth', authRoutes({ auth, secret: sessionSecret, secureCookies }));
  app.use('/api/labs', labRoutes({ labService }));
  app.use('/api/bookings', bookingRoutes({ bookingService }));
  app.use('/api/assistant', assistantRoutes({ assistant }));
  app.use('/', pageRoutes());

  return { app, services };
}

module.exports = { createApp };