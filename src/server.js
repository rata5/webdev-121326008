// Entry point: `npm start`. It reads the environment first, and stops with a message
// naming the variable when one the app cannot run without is missing.
const { loadConfig } = require('./config');
const { openDatabase } = require('./data/db');
const { createApp } = require('./app');
const { createGoogleClient } = require('./google/client');

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const db = openDatabase(config.databaseUrl);
const google = config.google ? createGoogleClient(config.google) : null;
const { app } = createApp({ db, sessionSecret: config.sessionSecret, secureCookies: config.production, google });

app.listen(config.port, () => {
  console.log(`lab-booking listening on http://localhost:${config.port}`);
});


// Bring the database up to date now, not on the first request. If it cannot be reached,
// the app still starts: requests that need it fail, and the next attempt tries again.
db.ready().then(
  () => console.log('database: migrations are up to date'),
  (err) => console.error(`database: not reachable yet (${err.message})`),
);