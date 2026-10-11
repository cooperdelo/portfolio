// /admin/clock/clock.js: fullscreen live Eastern-time clock + study session timer.
// Time comes from /api/time (Vercel's NTP clock), sampled a few times with the
// lowest round trip kept, so the seconds flip when the real second flips, not
// when this laptop thinks it does. Falls back to the device clock if offline.
// Keys: F fullscreen, S clock/session, Space start/pause, R reset, I sync info.

const LOCAL_PREVIEW = location.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(location.hostname);
if (!LOCAL_PREVIEW) {
  const { requireFullAdminOrRedirect } = await import('/admin/_shell/supabase.js');
  if (!(await requireFullAdminOrRedirect())) throw new Error('not full admin');
}

const TZ = 'America/New_York';
const $ = (id) => document.getElementById(id);
const timeEl = $('time'), dateEl = $('date'), modeEl = $('mode'), dotEl = $('dot'), infoEl = $('info');

// ---------- synced clock ----------
// now() = monotonic performance clock + offset to server time. Monotonic means a
// device clock jump mid-timelapse can't make the display skip.
let offset = Date.now() - (performance.timeOrigin + performance.now());
let sync = { source: 'device clock', rtt: null, at: null };
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
  for (let i = 0; i < 6; i++) {
    try { samples.push(await sampleOnce()); } catch { /* keep trying the rest */ }
  }
  if (!samples.length) { renderInfo(); return; }
  samples.sort((a, b) => a.rtt - b.rtt);
  offset = samples[0].offset;
  sync = { source: 'server time', rtt: samples[0].rtt, at: Date.now() };
  renderInfo();
}

function renderInfo() {
  const deviceDrift = Date.now() - now();
  infoEl.innerHTML = sync.rtt == null
    ? 'device clock<br>server unreachable'
    : `synced to server · ±${Math.max(1, Math.round(sync.rtt / 2))} ms<br>this computer is ${Math.abs(deviceDrift) < 1 ? 'exact' : `${deviceDrift > 0 ? '+' : '−'}${Math.abs(deviceDrift / 1000).toFixed(3)} s`}`;
}

// ---------- formatting ----------
const fmtTime = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
const fmtDate = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const fmtZone = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'short' });
const fmtShort = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });

function clockParts(ms) {
  const p = Object.fromEntries(fmtTime.formatToParts(ms).map((x) => [x.type, x.value]));
  const hour = p.hour === '00' ? '12' : p.hour;
  return { hms: `${hour}:${p.minute}:${p.second}`, ampm: (p.dayPeriod || '').toUpperCase() };
}
const zone = (ms) => fmtZone.formatToParts(ms).find((x) => x.type === 'timeZoneName')?.value || 'ET';

// ---------- session (study) timer ----------
// Kept in browser storage so a refresh mid-session doesn't lose the count.
const KEY = 'cd-clock-session';
let session = { elapsed: 0, startedAt: null, firstStart: null };
try { session = { ...session, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* storage off: in-memory only */ }
const saveSession = () => { try { localStorage.setItem(KEY, JSON.stringify(session)); } catch { /* ignore */ } };
const sessionMs = () => session.elapsed + (session.startedAt ? now() - session.startedAt : 0);
let mode = 'clock';
try { if (localStorage.getItem('cd-clock-mode') === 'session') mode = 'session'; } catch { /* ignore */ }

function hmsFromMs(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ---------- rolling digits ----------
let built = '';
function build(str, ampm) {
  const groups = str.split(':');
  timeEl.innerHTML = groups.map((g, gi) =>
    `<span class="grp${gi === groups.length - 1 ? ' sec' : ''}" style="display:flex">${[...g].map(() => '<span class="slot"></span>').join('')}</span>` +
    (gi < groups.length - 1 ? '<span class="slot sep"><span>:</span></span>' : '')).join('') +
    (ampm ? `<span class="ampm" id="ampm"></span>` : '');
  built = shape(str, ampm);
  fit();
}
const shape = (str, ampm) => str.replace(/\d/g, '0') + (ampm ? '|ap' : '');

function setDigits(str, ampm) {
  if (shape(str, ampm) !== built) build(str, ampm);
  const slots = [...timeEl.querySelectorAll('.slot:not(.sep)')];
  const digits = str.replace(/:/g, '');
  slots.forEach((slot, i) => {
    const d = digits[i];
    const cur = slot.querySelector('span:not(.out)');
    if (cur && cur.textContent === d) return;
    const next = document.createElement('span');
    next.textContent = d;
    if (cur) {
      next.className = 'in';
      slot.appendChild(next);
      next.getBoundingClientRect();
      next.className = '';
      cur.className = 'out';
      setTimeout(() => cur.remove(), 700);
    } else slot.appendChild(next);
  });
  const ap = $('ampm');
  if (ap && ap.textContent !== ampm) ap.textContent = ampm;
}

// Scale the numerals to fill the screen: as wide as 90% of it, never taller than ~58%.
function fit() {
  timeEl.style.fontSize = '200px';
  const w = timeEl.scrollWidth, h = timeEl.offsetHeight;
  const size = 200 * Math.min((innerWidth * 0.9) / w, (innerHeight * 0.5) / h);
  timeEl.style.fontSize = `${Math.floor(size)}px`;
}
addEventListener('resize', fit);

// ---------- render loop ----------
let lastKey = '';
function frame() {
  const t = now();
  let str, ampm, date;
  if (mode === 'clock') {
    ({ hms: str, ampm } = clockParts(t));
    date = `${fmtDate.format(t)}  ·  ${zone(t)}`;
  } else {
    str = hmsFromMs(sessionMs());
    ampm = '';
    date = session.firstStart
      ? `${session.startedAt ? 'Locked in' : 'Paused'}  ·  since ${fmtShort.format(session.firstStart)}`
      : 'Press space to start';
  }
  const key = `${mode}|${str}|${date}`;
  if (key !== lastKey) {
    const secondTicked = lastKey && lastKey.split('|')[1] !== str;
    lastKey = key;
    setDigits(str, ampm);
    if (dateEl.textContent !== date) dateEl.textContent = date;
    if (secondTicked) { dotEl.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => dotEl.classList.remove('on'))); }
  }
  requestAnimationFrame(frame);
}

function setMode(m) {
  mode = m;
  try { localStorage.setItem('cd-clock-mode', m); } catch { /* ignore */ }
  modeEl.textContent = m === 'clock' ? 'Live' : 'Session';
  lastKey = '';
}


// ---------- theme: auto (light from sunrise to sunset in Chapel Hill), light, dark ----------
// Sunrise/sunset from the standard NOAA approximation, good to a couple of minutes.
const LAT = 35.9132, LON = -79.0558;
function sunTimes(ms) {
  const rad = Math.PI / 180, d = new Date(ms);
  const day = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
  const g = (2 * Math.PI / 365) * (day - 1);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(LAT * rad) * Math.cos(decl)) - Math.tan(LAT * rad) * Math.tan(decl)) / rad;
  const noonUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return { rise: noonUTC + (720 - 4 * (LON + ha) - eqt) * 6e4, set: noonUTC + (720 - 4 * (LON - ha) - eqt) * 6e4 };
}
let themePref = 'auto';
try { themePref = localStorage.getItem('cd-clock-theme') || 'auto'; } catch { /* ignore */ }
function applyTheme() {
  let light = themePref === 'light';
  if (themePref === 'auto') { const t = now(), { rise, set } = sunTimes(t); light = t >= rise && t < set; }
  document.body.classList.toggle('light', light);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#EEEAE2' : '#0C0B0A');
  const lbl = document.getElementById('themeLabel'); if (lbl) lbl.textContent = themePref;
}
function cycleTheme() {
  themePref = { auto: 'light', light: 'dark', dark: 'auto' }[themePref] || 'auto';
  try { localStorage.setItem('cd-clock-theme', themePref); } catch { /* ignore */ }
  applyTheme(); wake();
}
setInterval(applyTheme, 30 * 1000);

// ---------- controls ----------
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
}
document.addEventListener('fullscreenchange', () => { document.body.classList.toggle('fs', !!document.fullscreenElement); setTimeout(fit, 60); });
document.addEventListener('dblclick', toggleFullscreen);

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'f') toggleFullscreen();
  else if (k === 's') setMode(mode === 'clock' ? 'session' : 'clock');
  else if (k === 'i') document.body.classList.toggle('show-info');
  else if (k === 't') cycleTheme();
  else if (k === ' ' ) {
    e.preventDefault();
    if (mode !== 'session') setMode('session');
    if (session.startedAt) { session.elapsed += now() - session.startedAt; session.startedAt = null; }
    else { session.startedAt = now(); session.firstStart ??= session.startedAt; }
    saveSession(); lastKey = '';
  } else if (k === 'r' && mode === 'session') {
    session = { elapsed: 0, startedAt: null, firstStart: null }; saveSession(); lastKey = '';
  }
});

// Cursor and hints disappear after 2.5 s of stillness so they never land in a timelapse.
let idleTimer;
function wake() {
  document.body.classList.add('awake'); document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { document.body.classList.remove('awake'); document.body.classList.add('idle'); }, 2500);
}
addEventListener('mousemove', wake);
addEventListener('touchstart', wake, { passive: true });

// Keep the screen awake for long recordings.
let lock = null;
async function holdWake() { try { if (document.visibilityState === 'visible') lock = await navigator.wakeLock?.request('screen'); } catch { /* not supported */ } }

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { resync(); holdWake(); } });
setInterval(resync, 5 * 60 * 1000);

// ---------- go ----------
setMode(mode);
applyTheme();
await document.fonts.load('700 200px "Nimbus Sans"').catch(() => {});
requestAnimationFrame(frame);
requestAnimationFrame(() => document.body.classList.add('ready'));
wake();
holdWake();
resync();
