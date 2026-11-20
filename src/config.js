// Every environment variable the app reads, in one place. .env.example says what each one is for.
// loadConfig() stops the app with a clear message when one it cannot run without is missing.
const REQUIRED = ['DATABASE_URL', 'SESSION_SECRET'];

function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. See .env.example.`);
  }
  if (env.SESSION_SECRET === 'change-me') {
    throw new Error('SESSION_SECRET is still the placeholder from .env.example. Make a real one with: openssl rand -hex 32');
  }
  return {
    port: Number(env.PORT || 3000),
    databaseUrl: env.DATABASE_URL,
    sessionSecret: env.SESSION_SECRET,
    production: env.NODE_ENV === 'production',
  };
}

module.exports = { loadConfig };