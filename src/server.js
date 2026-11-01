// Entry point: `npm start`.
const { openDatabase } = require('./data/db');
const { createApp } = require('./app');

const port = Number(process.env.PORT ?? 3000);
let secret = process.env.SESSION_SECRET;
if (!secret || secret === 'change-me') {
  secret = 'dev-only-secret';
  console.warn('SESSION_SECRET is not set: using a development secret. Set it in Codespaces secrets.');
}

const db = openDatabase(process.env.DATABASE_URL ?? 'file:./data/labbooking.db');
const { app } = createApp({ db, sessionSecret: secret, secureCookies: process.env.NODE_ENV === 'production' });

app.listen(port, () => {
  console.log(`lab-booking listening on http://localhost:${port}`);
});
