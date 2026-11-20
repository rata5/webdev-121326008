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

function createApp({ db, sessionSecret, secureCookies = false, bcryptRounds, now, modelClient = createModelClient(), google = null }) {
  const services = createServices({ db, now, bcryptRounds, modelClient });
  const { auth, labService, bookingService, assistant } = services;

  const app = express();
  app.disable('x-powered-by');
  app.get('/health', async (req, res) => {
    try {
      await db.ready();
      await db.query('SELECT 1');
      res.json({ status: 'ok', db: 'ok' });
    } catch (err) {
      console.error(`health: the database cannot be reached (${err.message})`);
      res.status(503).json({ status: 'error', db: 'down' });
    }
  });

  app.use(express.json());
  app.use('/assets', express.static(path.join(__dirname, '..', 'public')));
  app.use(loadUser(auth, sessionSecret));
  app.use('/api/auth', authRoutes({ auth, secret: sessionSecret, secureCookies, google }));
  app.use('/api/labs', labRoutes({ labService }));
  app.use('/api/bookings', bookingRoutes({ bookingService }));
  app.use('/api/assistant', assistantRoutes({ assistant }));
  app.use('/', pageRoutes());

  // Nothing above answered: one line, never Express's default page.
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.status(404).type('text').send('Page not found');
  });

  // Something went wrong: the details go to the log, the user gets one sentence.
  // Express knows this is the error handler because it takes four arguments.
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request body is not valid JSON.' });
    if (err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: 'The request could not be read.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return { app, services };
}

module.exports = { createApp };