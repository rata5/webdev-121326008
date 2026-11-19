// Builds every service on one database. The HTTP app (src/app.js) and the MCP server
// (mcp-server/server.js) both start here, so both front doors get the same rules.
const { createUserStore } = require('../data/users');
const { createSessionStore } = require('../data/sessions');
const { createLabStore } = require('../data/labs');
const { createBookingStore } = require('../data/bookings');
const { createAuthService } = require('./auth');
const { createLabService } = require('./labs');
const { createBookingService } = require('./bookings');
const { createAssistantService } = require('./assistant');

function createServices({ db, now, bcryptRounds, modelClient })  {
  const auth = createAuthService({ users: createUserStore(db), sessions: createSessionStore(db), bcryptRounds });
  const labService = createLabService({ labs: createLabStore(db), now });
  const bookingService = createBookingService({ bookings: createBookingStore(db), now });
  const assistant = createAssistantService({ labService, client: modelClient, now });
  return { auth, labService, bookingService, assistant };
}

module.exports = { createServices };