// The one file that talks to Google's sign-in (OpenID Connect, the authorization-code flow).
// The rest of the app gets a client with authUrl(state) and profile(code), never Google's URLs.
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

function createGoogleClient({ clientId, clientSecret, redirectUri, fetchImpl = (...args) => fetch(...args), timeoutMs = 10_000, now = Date.now }) {
  // Where the browser goes to sign in. Google hands `state` back unchanged, so the callback
  // can tell a sign-in this browser started from one somebody else forged.
  function authUrl(state) {
    const params = new URLSearchParams({
      client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email', state, prompt: 'select_account',
    });
    return `${AUTH_URL}?${params}`;
  }

  // Trades the one-time code from the callback for the Google account id and email address.
  async function profile(code) {
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`Google answered ${res.status} to the code exchange`);
    const { id_token: idToken } = await res.json();
    // This token came straight from Google over HTTPS, in answer to our client secret, so its
    // signature needs no second check. Who it is for, who issued it and when it expires still do.
    const claims = JSON.parse(Buffer.from(String(idToken).split('.')[1] ?? '', 'base64url').toString('utf8') || '{}');
    if (claims.aud !== clientId || !ISSUERS.includes(claims.iss) || claims.exp * 1000 <= now()) {
      throw new Error('Google sent an ID token that is not for this app, or that has expired');
    }
    return {
      sub: claims.sub,
      email: String(claims.email ?? '').toLowerCase(),
      emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    };
  }

  return { authUrl, profile };
}

module.exports = { createGoogleClient };