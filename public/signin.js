// Sign-in and sign-up on one screen.
let mode = 'signin';
const $ = (id) => document.getElementById(id);

function setMode(next) {
  mode = next;
  const signup = mode === 'signup';
  $('title').textContent = signup ? 'Create an account' : 'Sign in';
  $('submit').textContent = signup ? 'Create account' : 'Sign in';
  $('switch-text').textContent = signup ? 'Already have an account?' : 'No account yet?';
  $('switch').textContent = signup ? 'Sign in instead' : 'Create an account';
  $('password').autocomplete = signup ? 'new-password' : 'current-password';
  $('password-hint').hidden = !signup;
  $('message').textContent = '';
}

$('switch').addEventListener('click', () => setMode(mode === 'signin' ? 'signup' : 'signin'));
// When Google sign-in does not work, the server sends the browser back here with ?error=…
const googleError = new URLSearchParams(window.location.search).get('error');
if (googleError) $('message').textContent = googleError;

$('auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('submit');
  const label = button.textContent;
  button.disabled = true;
  button.textContent = mode === 'signup' ? 'Creating account…' : 'Signing in…';
  $('message').textContent = '';
  try {
    const res = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('email').value, password: $('password').value }),
    });
    if (res.ok) {
      window.location.assign('/labs');
      return;
    }
    const body = await res.json().catch(() => ({}));
    $('message').textContent = body.error ?? 'Something went wrong. Please try again.';
  } catch {
    $('message').textContent = 'Could not reach the server. Check your connection and try again.';
  }
  button.disabled = false;
  button.textContent = label;
});
