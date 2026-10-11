// /clock: the public, customizable version of Cooper's admin clock. No login.
// Server-synced time (/api/time, lowest-RTT of 6 samples), rolling digits, session timer, countdown,
// light/dark/auto theme, wake lock, cursor that hides when still. Everything the viewer picks is kept in
// their own browser (localStorage, wrapped in try/catch). The clock itself is always free; fullscreen and
// the settings unlock after an email (/api/subscribe), delivered right here on the page.

const $ = (id) => document.getElementById(id);
const timeEl = $('time'), dateEl = $('date'), modeEl = $('mode'), dotEl = $('dot');
const track = (n, p) => { try { window.cdTrack?.(n, p); } catch { /* ignore */ } };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off: this visit only */ } },
};

// ---------- settings ----------
const DEVICE_TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } })();
const DEFAULTS = { tz: 'auto', h24: false, seconds: true, date: true, theme: 'auto', font: 'nimbus', accent: 'silver',
  label: '', corner: '', slabel: '', target: '', tlabel: '' };
const ACCENTS = { silver: '#C9C5C0', bone: '#F4F1EA', orange: '#D9773F', sage: '#9DB39A', blue: '#7FA3D6', red: '#D0574B' };
const KEY = 'cd-clock-pub-v1';
let S = { ...DEFAULTS, ...store.get(KEY, {}) };
if (!ACCENTS[S.accent]) S.accent = 'silver';
const save = () => store.set(KEY, S);
let unlocked = !!store.get('cd-clock-unlock', null);

// ---------- synced time ----------
let offset = Date.now() - (performance.timeOrigin + performance.now());
const now = () => performance.timeOrigin + performance.now() + offset;
async function sampleOnce() {
  const t0 = performance.now();
  const r = await fetch(`/api/time?t=${Math.round(t0)}`, { cache: 'no-store' });
  const t1 = performance.now();
  if (!r.ok) throw new Error(String(r.status));
  const { now: server } = await r.json();
  if (typeof server !== 'number') throw new Error('bad payload');
  return { rtt: t1 - t0, offset: server + (t1 - t0) / 2 - (performance.timeOrigin + t1) };
}
async function resync() {
  const samples = [];
  for (let i = 0; i < 6; i++) { try { samples.push(await sampleOnce()); } catch { /* keep the rest */ } }
  if (!samples.length) return;
  samples.sort((a, b) => a.rtt - b.rtt);
  offset = samples[0].offset;
}

// ---------- formatting (rebuilt whenever tz / format changes) ----------
const tz = () => (S.tz === 'auto' ? DEVICE_TZ : S.tz);
let F = {};
function buildFormatters() {
  const z = tz();
  try { new Intl.DateTimeFormat('en-US', { timeZone: z }); } catch { S.tz = 'auto'; }
  const timeZone = tz();
  F = {
    time: new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', second: '2-digit', hourCycle: S.h24 ? 'h23' : 'h12' }),
    date: new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric' }),
    zone: new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }),
    short: new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hourCycle: S.h24 ? 'h23' : 'h12' }),
    target: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hourCycle: S.h24 ? 'h23' : 'h12' }),
  };
}
function clockParts(ms) {
  const p = Object.fromEntries(F.time.formatToParts(ms).map((x) => [x.type, x.value]));
  let h = p.hour;
  if (S.h24) h = h.padStart(2, '0');
  const hms = S.seconds ? `${h}:${p.minute}:${p.second}` : `${h}:${p.minute}`;
  return { hms, ampm: S.h24 ? '' : (p.dayPeriod || '').toUpperCase() };
}
const zoneName = (ms) => F.zone.formatToParts(ms).find((x) => x.type === 'timeZoneName')?.value || '';
const city = () => tz().split('/').pop().replace(/_/g, ' ');

// ---------- session + countdown ----------
let session = { elapsed: 0, startedAt: null, firstStart: null, ...store.get('cd-clock-pub-session', {}) };
const saveSession = () => store.set('cd-clock-pub-session', session);
const sessionMs = () => session.elapsed + (session.startedAt ? now() - session.startedAt : 0);
function hms(ms, withSec = true) {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (!withSec) return `${h}:${String(m).padStart(2, '0')}`;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
// datetime-local has no zone: it means the viewer's own device time.
const targetMs = () => { if (!S.target) return null; const t = new Date(S.target).getTime(); return Number.isFinite(t) ? t : null; };
const MODES = () => ['clock', 'session', ...(targetMs() ? ['countdown'] : [])];
let mode = store.get('cd-clock-pub-mode', 'clock');
if (!MODES().includes(mode)) mode = 'clock';

// ---------- rolling digits ----------
let built = '';
const shape = (str, ampm) => str.replace(/\d/g, '0') + (ampm ? '|ap' : '');
function build(str, ampm) {
  const groups = str.split(':');
  timeEl.innerHTML = groups.map((g, gi) =>
    `<span class="grp${gi === groups.length - 1 && groups.length === 3 ? ' sec' : ''}" style="display:flex">${[...g].map(() => '<span class="slot"></span>').join('')}</span>` +
    (gi < groups.length - 1 ? '<span class="slot sep"><span>:</span></span>' : '')).join('') +
    (ampm ? '<span class="ampm" id="ampm"></span>' : '');
  built = shape(str, ampm);
  fit();
}
function setDigits(str, ampm) {
  const fresh = shape(str, ampm) !== built;
  if (fresh) build(str, ampm);
  const slots = [...timeEl.querySelectorAll('.slot:not(.sep)')], digits = str.replace(/:/g, '');
  slots.forEach((slot, i) => {
    const d = digits[i], cur = slot.querySelector('span:not(.out)');
    if (cur && cur.textContent === d) return;
    const next = document.createElement('span');
    next.textContent = d;
    if (cur) {
      next.className = 'in'; slot.appendChild(next); next.getBoundingClientRect();
      next.className = ''; cur.className = 'out'; setTimeout(() => cur.remove(), 700);
    } else slot.appendChild(next);
  });
  const ap = $('ampm'); if (ap && ap.textContent !== ampm) ap.textContent = ampm;
  if (fresh) fit();                                                            // measure with the real digits and AM/PM in place
}
// Fill the screen: 90% of the width, never more than half the height.
function fit() {
  timeEl.style.fontSize = '200px';
  const w = timeEl.scrollWidth, h = timeEl.offsetHeight;
  if (!w || !h) return;
  timeEl.style.fontSize = `${Math.floor(200 * Math.min((innerWidth * 0.9) / w, (innerHeight * 0.5) / h))}px`;
}
addEventListener('resize', () => requestAnimationFrame(fit));

// ---------- render loop ----------
let lastKey = '';
function frame() {
  const t = now();
  let str, ampm = '', date;
  if (mode === 'clock') {
    ({ hms: str, ampm } = clockParts(t));
    date = `${F.date.format(t)}  ·  ${zoneName(t)}`;
  } else if (mode === 'session') {
    str = hms(sessionMs(), S.seconds);
    const lbl = S.slabel || 'Locked in';
    date = session.firstStart ? `${session.startedAt ? lbl : 'Paused'}  ·  since ${F.short.format(session.firstStart)}` : 'Press start';
  } else {
    const end = targetMs(), left = end ? end - t : 0;
    str = hms(left, S.seconds);
    date = left > 0 ? `${S.tlabel || 'Until'}  ·  ${F.target.format(end)}` : `${S.tlabel || 'Countdown'}  ·  time`;
  }
  const key = `${mode}|${str}|${date}`;
  if (key !== lastKey) {
    const ticked = lastKey && lastKey !== key;
    lastKey = key;
    setDigits(str, ampm);
    if (dateEl.textContent !== date) dateEl.textContent = date;
    if (ticked) { dotEl.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => dotEl.classList.remove('on'))); }
  }
  requestAnimationFrame(frame);
}
// Screen readers get a once-a-minute text, not 60 announcements a minute.
setInterval(() => { $('srTime').textContent = `${clockParts(now()).hms} ${clockParts(now()).ampm}`; }, 60000);

// ---------- apply settings to the page ----------
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const light = S.theme === 'light' || (S.theme === 'auto' && !darkMQ.matches);
  document.body.classList.toggle('light', light);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#EEEAE2' : '#0C0B0A');
}
darkMQ.addEventListener?.('change', applyTheme);
function apply() {
  buildFormatters();
  const b = document.body;
  b.classList.toggle('f-space', S.font === 'space');
  b.classList.toggle('f-mono', S.font === 'mono');
  b.classList.toggle('no-date', !S.date);
  Object.keys(ACCENTS).forEach((a) => b.classList.toggle('acc-' + a, S.accent === a));
  const hex = ACCENTS[S.accent], dk = '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.68).toString(16).padStart(2, '0')).join('');
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-d', dk);
  applyTheme();
  $('label').textContent = S.label || 'Focus';
  $('place').textContent = S.corner || city();
  if (!MODES().includes(mode)) mode = 'clock';
  setModeLabels();
  built = ''; lastKey = '';
  const fam = { nimbus: '700 100px "Nimbus Sans"', space: '700 100px "Space Grotesk"', mono: '600 100px "Geist Mono"' }[S.font];
  document.fonts?.load(fam).then(() => { built = ''; lastKey = ''; }).catch(() => {});
  syncPanel();
}

const MODE_NAME = { clock: 'Live', session: 'Session', countdown: 'Countdown' };
function setModeLabels() {
  modeEl.textContent = MODE_NAME[mode];
  $('modeBtn').textContent = MODE_NAME[mode];
  $('startBtn').hidden = $('resetBtn').hidden = mode !== 'session';
  $('startBtn').textContent = session.startedAt ? 'Pause' : 'Start';
}
function setMode(m) { mode = m; store.set('cd-clock-pub-mode', m); setModeLabels(); lastKey = ''; }
const cycleMode = () => { const list = MODES(); setMode(list[(list.indexOf(mode) + 1) % list.length]); };
function startPause() {
  if (mode !== 'session') setMode('session');
  if (session.startedAt) { session.elapsed += now() - session.startedAt; session.startedAt = null; }
  else { session.startedAt = now(); session.firstStart ??= session.startedAt; }
  saveSession(); setModeLabels(); lastKey = '';
}
function resetSession() { session = { elapsed: 0, startedAt: null, firstStart: null }; saveSession(); setModeLabels(); lastKey = ''; }

// ---------- settings panel ----------
const panel = $('panel'), opts = $('opts'), gate = $('gate');
let opener = null;
function openPanel(focusEmail = false) {
  opener = document.activeElement;
  document.body.classList.add('panel-open');
  panel.removeAttribute('inert'); panel.setAttribute('aria-hidden', 'false');
  setTimeout(() => (focusEmail && !unlocked ? gate.email : panel.querySelector('.p-x')).focus({ preventScroll: true }), 120);
  track('clock_customize', { locked: !unlocked });
}
function closePanel() {
  document.body.classList.remove('panel-open');
  panel.setAttribute('inert', ''); panel.setAttribute('aria-hidden', 'true');
  opener?.focus?.({ preventScroll: true });
}
const isOpen = () => document.body.classList.contains('panel-open');

function syncPanel() {
  gate.hidden = unlocked; $('unlocked').hidden = !unlocked; opts.disabled = !unlocked;
  panel.querySelectorAll('.seg').forEach((seg) => {
    const k = seg.dataset.key;
    seg.querySelectorAll('button').forEach((bt) => bt.setAttribute('aria-pressed', String(String(S[k]) === bt.dataset.v)));
  });
  $('swatches').querySelectorAll('button').forEach((bt) => bt.setAttribute('aria-checked', String(bt.dataset.a === S.accent)));
  const sel = $('o-tz');
  if (sel.value !== S.tz) sel.value = S.tz;
  for (const [id, k] of [['o-label', 'label'], ['o-corner', 'corner'], ['o-slabel', 'slabel'], ['o-target', 'target'], ['o-tlabel', 'tlabel']]) {
    const el = $(id); if (document.activeElement !== el && el.value !== S[k]) el.value = S[k];
  }
  $('o-corner').placeholder = city();
}
(function buildPanel() {
  let zones = [];
  try { zones = Intl.supportedValuesOf('timeZone'); } catch { /* older browsers */ }
  if (!zones.length) zones = ['America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'Europe/London', 'Europe/Paris', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney', 'UTC'];
  const sel = $('o-tz');
  sel.innerHTML = `<option value="auto">Auto (${DEVICE_TZ.replace(/_/g, ' ')})</option>` +
    zones.map((z) => `<option value="${z}">${z.replace(/_/g, ' ')}</option>`).join('');
  sel.addEventListener('change', () => { S.tz = sel.value; save(); apply(); });
  $('swatches').innerHTML = Object.entries(ACCENTS).map(([a, c]) =>
    `<button type="button" role="radio" data-a="${a}" style="--c:${c}" aria-label="${a}" title="${a}"></button>`).join('');
  $('swatches').addEventListener('click', (e) => { const bt = e.target.closest('button'); if (!bt) return; S.accent = bt.dataset.a; save(); apply(); });
  panel.querySelectorAll('.seg').forEach((seg) => seg.addEventListener('click', (e) => {
    const bt = e.target.closest('button'); if (!bt) return;
    const k = seg.dataset.key, v = bt.dataset.v;
    S[k] = v === 'true' ? true : v === 'false' ? false : v; save(); apply();
  }));
  for (const [id, k] of [['o-label', 'label'], ['o-corner', 'corner'], ['o-slabel', 'slabel'], ['o-target', 'target'], ['o-tlabel', 'tlabel']]) {
    $(id).addEventListener('input', (e) => { S[k] = e.target.value.slice(0, 40); save(); apply(); });
  }
})();

// ---------- the email gate ----------
function utm() {
  const q = new URLSearchParams(location.search), o = {};
  ['source', 'medium', 'campaign', 'content', 'term'].forEach((k) => { const v = q.get('utm_' + k); if (v) o[k] = v.slice(0, 100); });
  if (Object.keys(o).length) { if (!store.get('cd-clock-utm', null)) store.set('cd-clock-utm', o); return o; } // first touch wins
  return store.get('cd-clock-utm', {}) || {};
}
const firstUtm = utm();
gate.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('gateMsg'), btn = gate.querySelector('button[type="submit"]');
  const email = gate.email.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = "That email doesn't look right."; gate.email.focus(); return; }
  btn.disabled = true; msg.textContent = '';
  try {
    const r = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source: 'clock', utm: { ...firstUtm, ...utm() }, referrer: document.referrer, page: location.pathname, consent: true, website: gate.website.value }) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 429) { msg.textContent = 'Too many tries. Give it a few minutes.'; return; }
    if (!r.ok) { msg.textContent = d.error === 'bad_email' ? "That email doesn't look right." : 'Something went wrong. Try again.'; return; }
    unlocked = true; store.set('cd-clock-unlock', d.token || '1');
    track('clock_unlock', { source: firstUtm.source || '' });
    syncPanel();
    panel.querySelector('.p-x').focus({ preventScroll: true });
  } catch { msg.textContent = 'No connection. Try again.'; }
  finally { btn.disabled = false; }
});

// ---------- fullscreen, keys, buttons ----------
function toggleFullscreen() {
  if (!unlocked) { openPanel(true); return; }
  const el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  else {
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) { Promise.resolve(req.call(el, { navigationUI: 'hide' })).catch(() => {}); track('clock_fullscreen'); }
  }
}
['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, () => {
  document.body.classList.toggle('fs', !!(document.fullscreenElement || document.webkitFullscreenElement)); setTimeout(fit, 60);
}));
// iPhone Safari has no fullscreen for pages: hide the button there rather than show one that does nothing.
if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) $('fsBtn').hidden = true;

document.addEventListener('click', (e) => {
  const bt = e.target.closest('[data-act]'); if (!bt) return;
  const act = bt.dataset.act;
  if (act === 'mode') cycleMode();
  else if (act === 'start') startPause();
  else if (act === 'reset') resetSession();
  else if (act === 'fullscreen') toggleFullscreen();
  else if (act === 'settings') isOpen() ? closePanel() : openPanel(true);
  else if (act === 'close') closePanel();
  else if (act === 'defaults') { S = { ...DEFAULTS }; save(); apply(); }
  wake();
});
document.querySelector('.stage').addEventListener('dblclick', toggleFullscreen);
// Tap the empty stage to close the panel on phones.
document.querySelector('.stage').addEventListener('click', () => { if (isOpen()) closePanel(); });

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest?.('input, select, textarea')) { if (e.key === 'Escape') closePanel(); return; }
  const k = e.key.toLowerCase();
  if (k === 'escape' && isOpen()) closePanel();
  else if (k === 'f') toggleFullscreen();
  else if (k === 's') cycleMode();
  else if (k === 'c') isOpen() ? closePanel() : openPanel(true);
  else if (k === 't') { if (!unlocked) openPanel(true); else { S.theme = { auto: 'dark', dark: 'light', light: 'auto' }[S.theme] || 'auto'; save(); apply(); } }
  else if (k === ' ' && !e.target.closest?.('button')) { e.preventDefault(); startPause(); }
  else if (k === 'r' && mode === 'session') resetSession();
  else return;
  wake();
});

// Cursor, bar and hints disappear after 2.5 s of stillness so they never land in a recording.
let idleTimer;
function wake() {
  document.body.classList.add('awake'); document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (document.querySelector('.bar:focus-within')) return wake(); document.body.classList.remove('awake'); document.body.classList.add('idle'); }, 2500);
}
addEventListener('mousemove', wake);
addEventListener('touchstart', wake, { passive: true });

// Keep the screen on.
async function holdWake() { try { if (document.visibilityState === 'visible') await navigator.wakeLock?.request('screen'); } catch { /* unsupported */ } }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { resync(); holdWake(); } });
setInterval(resync, 5 * 60 * 1000);

// ---------- go ----------
apply();
await Promise.race([document.fonts?.load('700 200px "Nimbus Sans"'), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});
requestAnimationFrame(frame);
requestAnimationFrame(() => document.body.classList.add('ready'));
wake();
holdWake();
resync();
track('clock_view', { source: firstUtm.source || '' });
if (new URLSearchParams(location.search).has('customize')) openPanel(true);
