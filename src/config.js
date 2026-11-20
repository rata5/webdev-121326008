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
  const port = Number(env.PORT || 3000);
  const publicBaseUrl = (env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '');
  return {
    port,
    databaseUrl: env.DATABASE_URL,
    sessionSecret: env.SESSION_SECRET,
    production: env.NODE_ENV === 'production',
    publicBaseUrl,
    // Google sign-in needs both values. Without them it is off, and its button says so.
    google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, redirectUri: `${publicBaseUrl}/api/auth/google/callback` }
      : null,
  };
}

module.exports = { loadConfig };