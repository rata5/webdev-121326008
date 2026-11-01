// The lab list: every lab with its free and taken slots on the chosen date.
const $ = (id) => document.getElementById(id);

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

async function load() {
  const date = $('date').value;
  $('status').replaceChildren(el('p', { className: 'muted' }, 'Loading labs…'));
  $('labs').replaceChildren(el('div', { className: 'skeleton' }), el('div', { className: 'skeleton' }));
  try {
    const res = await fetch(`/api/labs?date=${encodeURIComponent(date)}`);
    if (res.status === 401) return window.location.assign('/signin');
    const body = await res.json();
    if (!res.ok) return showError(body.error ?? 'Could not load the labs. Please try again.');
    render(body);
  } catch {
    showError('Could not reach the server. Check your connection and try again.');
  }
}

function render({ open, labs }) {
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
        list.append(el('li', { className: `slot ${state.toLowerCase()}` }, `${slot.label} ${state}`));
      }
      card.append(list);
    }
    return card;
  }));
}

$('date').value = today();
$('date').addEventListener('change', load);
$('signout').addEventListener('click', async () => {
  await fetch('/api/auth/signout', { method: 'POST' });
  window.location.assign('/signin');
});
fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)).then((b) => { if (b) $('who').textContent = b.user.email; });
load();
