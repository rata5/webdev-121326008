// The lab list: every lab with its free and taken slots on the chosen date, a Book button
// on each free slot, and "My bookings" with a Cancel button on each of the user's bookings.
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  Object.assign(node, attrs);
  if (text !== undefined) node.textContent = text;
  return node;
}

function showError(text) {
  $('labs').replaceChildren();
  $('status').replaceChildren(el('div', { className: 'message error', role: 'alert' }, text));
}

// One sentence at the top of the page saying what just happened.
function notify(text, kind = 'success') {
  $('notice').replaceChildren(el('div', { className: `message ${kind}`, role: kind === 'error' ? 'alert' : 'status' }, text));
}

// Sends a request; answers { status, body }. A server that cannot be reached is status 0.
async function call(method, url, data) {
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { 'Content-Type': 'application/json' } : {},
      body: data ? JSON.stringify(data) : undefined,
    });
    if (res.status === 401) window.location.assign('/signin');
    const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
    return { status: res.status, body };
  } catch {
    return { status: 0, body: { error: 'Could not reach the server. Check your connection and try again.' } };
  }
}

async function load() {
  const date = $('date').value;
  $('status').replaceChildren(el('p', { className: 'muted' }, 'Loading labs…'));
  $('labs').replaceChildren(el('div', { className: 'skeleton' }), el('div', { className: 'skeleton' }));
  const { status, body } = await call('GET', `/api/labs?date=${encodeURIComponent(date)}`);
  if (status === 401) return;
  if (status !== 200) return showError(body.error ?? 'Could not load the labs. Please try again.');
  render(body);
}

function render({ date, open, labs }) {
  if (labs.length === 0) {
    $('status').replaceChildren(el('p', {}, 'There are no labs yet. An admin can add the first one.'));
    return $('labs').replaceChildren();
  }
  $('status').replaceChildren(
    open ? el('p', { className: 'muted' }, `${labs.length} labs. Green slots are free; slots that have started are shown as Past.`)
         : el('p', {}, 'Labs are closed at the weekend. Pick a day from Monday to Friday.'),
  );
  $('labs').replaceChildren(...labs.map((lab) => {
    const card = el('article', { className: 'card' });
    card.append(el('h2', {}, lab.name), el('p', { className: 'muted' }, `Room ${lab.room} · ${lab.capacity} seats`));
    if (open) {
      const list = el('ul', { className: 'slots' });
      for (const slot of lab.slots) {
        const state = slot.past ? 'Past' : slot.free ? 'Free' : 'Taken';
        const item = el('li', { className: `slot ${state.toLowerCase()}` }, `${slot.label} ${state}`);
        if (state === 'Free') {
          const button = el('button', { type: 'button', className: 'book' }, 'Book');
          button.setAttribute('aria-label', `Book ${lab.name}, ${slot.label}`);
          button.addEventListener('click', () => book(button, { labId: lab.id, labName: lab.name, date, hour: slot.hour, label: slot.label }));
          item.append(button);
        }
        list.append(item);
      }
      card.append(list);
    }
    return card;
  }));
}

async function book(button, { labId, labName, date, hour, label }) {
  button.disabled = true;
  button.textContent = 'Booking…';
  const { status, body } = await call('POST', '/api/bookings', { labId, date, hour });
  if (status === 401) return;
  if (status === 201) {
    notify(`${body.message}: ${labName}, ${label} on ${date}.`);
    return Promise.all([load(), loadMine()]);
  }
  button.disabled = false;
  button.textContent = 'Book';
  notify(body.error ?? 'Could not book this slot. Please try again.', 'error');
  if (status === 409) load(); // somebody else was faster: show the slot as taken
}

// "Mon 23 Nov" from "2026-11-23"
const day = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

async function loadMine() {
  $('mine').replaceChildren(el('p', { className: 'muted' }, 'Loading your bookings…'));
  const { status, body } = await call('GET', '/api/bookings/mine');
  if (status === 401) return;
  if (status !== 200) {
    const retry = el('button', { type: 'button', className: 'secondary' }, 'Try again');
    retry.addEventListener('click', loadMine);
    return $('mine').replaceChildren(el('div', { className: 'message error', role: 'alert' }, body.error ?? 'Could not load your bookings.'), retry);
  }
  if (body.bookings.length === 0) {
    const empty = el('p', {}, 'No bookings yet. ');
    empty.append(el('a', { href: '#labs' }, 'Pick a free slot in the lab list below.'));
    return $('mine').replaceChildren(empty);
  }
  const list = el('ul', { className: 'bookings' });
  for (const booking of body.bookings) {
    const when = `${day(booking.date)}, ${pad(booking.start_hour)}:00–${pad(booking.start_hour + 1)}:00`;
    const item = el('li', { className: 'booking' });
    const button = el('button', { type: 'button', className: 'secondary' }, 'Cancel');
    button.setAttribute('aria-label', `Cancel ${booking.lab_name}, ${when}`);
    button.addEventListener('click', () => cancel(button, booking, when));
    item.append(el('span', {}, `${booking.lab_name} · Room ${booking.room} · ${when}`), button);
    list.append(item);
  }
  $('mine').replaceChildren(list);
}

async function cancel(button, booking, when) {
  button.disabled = true;
  button.textContent = 'Cancelling…';
  const { status, body } = await call('DELETE', `/api/bookings/${booking.id}`);
  if (status === 401) return;
  if (status === 204) {
    notify(`Booking cancelled: ${booking.lab_name}, ${when}. The slot is free again.`);
    return Promise.all([load(), loadMine()]);
  }
  button.disabled = false;
  button.textContent = 'Cancel';
  notify(body.error ?? 'Could not cancel this booking. Please try again.', 'error');
}

// "Find me a slot": the model's suggestions, or the fallback slots, each with a Book button.
// A model suggestion is labelled "Suggestion"; a fallback slot comes from the database, so it is a "Free slot".
$('assistant-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('assistant-go');
  button.disabled = true;
  button.textContent = 'Thinking…';
  $('assistant-result').replaceChildren(el('p', { className: 'muted' }, 'Looking for free slots…'));
  const { status, body } = await call('POST', '/api/assistant/suggest', { request: $('assistant-request').value, date: $('date').value });
  button.disabled = false;
  button.textContent = 'Find me a slot';
  if (status === 401) return;
  if (status !== 200) {
    return $('assistant-result').replaceChildren(el('div', { className: 'message error', role: 'alert' }, body.error ?? 'The assistant could not answer. Pick a slot from the list.'));
  }
  const parts = body.notice ? [el('div', { className: 'message info' }, body.notice)] : [];
  const list = el('ul', { className: 'suggestions' });
  for (const s of body.suggestions) {
    const item = el('li', { className: 'suggestion' });
    item.append(
      el('span', { className: 'tag' }, body.source === 'model' ? 'Suggestion' : 'Free slot'),
      el('strong', {}, `${s.labName} · Room ${s.room} · ${day(s.date)}, ${s.label}`),
    );
    if (s.reason) item.append(el('span', { className: 'muted' }, s.reason));
    const bookButton = el('button', { type: 'button' }, 'Book');
    bookButton.setAttribute('aria-label', `Book ${s.labName}, ${day(s.date)}, ${s.label}`);
    bookButton.addEventListener('click', () => book(bookButton, s)); // s has labId, labName, date, hour, label
    item.append(bookButton);
    list.append(item);
  }
  if (body.suggestions.length) parts.push(list);
  $('assistant-result').replaceChildren(...parts);
});

$('date').value = today();
$('date').addEventListener('change', load);
$('signout').addEventListener('click', async () => {
  await fetch('/api/auth/signout', { method: 'POST' });
  window.location.assign('/signin');
});
fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)).then((b) => { if (b) $('who').textContent = b.user.email; });
load();
loadMine();