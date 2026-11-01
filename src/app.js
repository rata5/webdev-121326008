// Builds the Express app from a database. Tests pass an in-memory database.
const path = require('node:path');
const express = require('express');
const { createUserStore } = require('./data/users');
const { createSessionStore } = require('./data/sessions');
const { createLabStore } = require('./data/labs');
const { createAuthService } = require('./services/auth');
const { createLabService } = require('./services/labs');
const { loadUser } = require('./routes/http');
const { authRoutes } = require('./routes/auth');
const { labRoutes } = require('./routes/labs');
const { pageRoutes } = require('./routes/pages');

function createApp({ db, sessionSecret, secureCookies = false, bcryptRounds, now }) {
  const auth = createAuthService({ users: createUserStore(db), sessions: createSessionStore(db), bcryptRounds });
  const labService = createLabService({ labs: createLabStore(db), now });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/assets', express.static(path.join(__dirname, '..', 'public')));
  app.use(loadUser(auth, sessionSecret));

  app.use('/api/auth', authRoutes({ auth, secret: sessionSecret, secureCookies }));
  app.use('/api/labs', labRoutes({ labService }));
  app.use('/', pageRoutes());

  return { app, services: { auth, labService } };
}

module.exports = { createApp };
