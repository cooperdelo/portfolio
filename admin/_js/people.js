// /admin/_js/people.js - People in orbit.
// Reads: people_orbit (filled every 30 min by the people_orbit_sync() pg_cron job from
// vault_documents People/*.md + plugverse_contacts; curated rows keep their locked fields),
// plugverse_contacts (drawer detail), engagers (lower section, hidden when empty).
// No manual add (Cooper 2026-09-28: nothing manual). Source: admin/people/_supabase/people-orbit.sql
// Localhost ?demo reads the gitignored admin/_dev/snapshot.local.json `people` block.
import { sb, requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { mountShell, isLocalDemo } from '/admin/_shell/admin-shell.js';
import { esc, fmtDay, ago, platMark, emptyState, initials, pageHead, toDate, icon } from '/admin/_shell/ui.js';

const DEMO = isLocalDemo();
if (!DEMO && !(await requireFullAdminOrRedirect())) throw new Error('not full admin');
await mountShell({ title: 'People in orbit', demo: true });
const app = document.getElementById('app');

const VAULT_ROOT = 'C:\\Users\\coope\\Desktop\\Claude\\';
const CIRCLES = [
  ['inner', 'Inner circle', 'Family and close friends'],
  ['mentor', 'Mentors', 'People who advise you'],
  ['asset', 'Assets', 'Valuable, not close friends'],
  ['team', 'Team', 'PlugVerse team'],
  ['pipeline', 'Pipeline', 'Identified, not talked to yet'],
  ['orbit', 'Orbit', 'Worth remembering'],
];
const CIRCLE_NAME = Object.fromEntries(CIRCLES.map(([k, n]) => [k, n]));
const WARN_DAYS = 30;

app.innerHTML = pageHead('Grow', 'People in orbit', '<span class="live-dot" id="synced">Auto-synced</span>') + `
  <div class="po-tools"><input type="search" id="q" placeholder="Search people" aria-label="Search people"><div class="seg" id="seg"></div></div>
  <div id="sections"><div class="sv-card"><div class="shimmer" style="height:120px"></div></div></div>
  <section id="eng-wrap" hidden><h2 class="po-h">Engaged with your posts <span id="eng-n" class="po-n"></span></h2><div class="sv-card"><div class="rows" id="eng"></div></div></section>
  <div class="po-scrim" id="scrim"></div>
  <aside class="po-drawer" id="drawer" aria-hidden="true" role="dialog" aria-label="Person"><div id="drawer-body"></div></aside>`;

let people = [], engagers = [], contacts = new Map(), circle = 'all';
const $ = (s) => document.querySelector(s);
$('#q').oninput = render;

function daysSince(d) { const x = toDate(d); return x ? Math.floor((Date.now() - x.getTime()) / 864e5) : null; }
function touchLabel(d) {
  const n = daysSince(d);
  if (n == null) return 'no touch logged';
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 14) return `${n} days ago`;
  if (n < 60) return `${Math.round(n / 7)} weeks ago`;
  if (n < 365) return `${Math.round(n / 30)} months ago`;
  return `${(n / 365).toFixed(1).replace(/\.0$/, '')} years ago`;
}
const needsTouch = (p) => (p.circle === 'asset' || p.circle === 'mentor') && (p.last_touch == null || daysSince(p.last_touch) > WARN_DAYS);
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
function subLine(p) {
  const rel = p.relationship && p.relationship.toLowerCase() !== String(p.name).toLowerCase() ? p.relationship : '';
  const org = p.org && !rel.toLowerCase().includes(p.org.toLowerCase()) ? p.org : '';
  return [rel, org].filter(Boolean).join(' · ');
}
const whyShown = (p) => p.why_they_matter && !/^inner circle\.?$/i.test(p.why_they_matter) ? p.why_they_matter : '';
function winPath(rel) { return rel ? VAULT_ROOT + rel.replace(/\//g, '\\') : ''; }

async function load() {
  if (DEMO) {
    try {
      const snap = await (await fetch('/admin/_dev/snapshot.local.json', { cache: 'no-store' })).json();
      people = snap?.people?.rows || []; engagers = snap?.people?.engagers || [];
      (snap?.people?.contacts || []).forEach(c => contacts.set(c.id, c));
    } catch { people = []; }
    return render();
  }
  const [p, e] = await Promise.all([
    sb.from('people_orbit').select('*').order('name'),
    sb.from('engagers').select('*').order('last_seen', { ascending: false }).order('interactions', { ascending: false }).limit(200),
  ]);
  if (p.error) { $('#sections').innerHTML = `<div class="sv-card">${emptyState("Couldn't load people", esc(p.error.message))}</div>`; return; }
  people = p.data || []; engagers = e.error ? [] : (e.data || []);
  render();
}

function dueTag(d, long) {
  if (!d) return '';
  const opts = long ? { month: 'short', day: 'numeric', year: 'numeric' } : undefined;
  return ` <span class="po-due${daysSince(d) > 0 ? ' late' : ''}">by ${esc(fmtDay(d, opts))}</span>`;
}

function row(p) {
  const warn = needsTouch(p);
  const next = p.next_step ? esc(cap(p.next_step)) + dueTag(p.next_step_due) : '';
  return `<button class="po-row" data-id="${esc(p.id)}" type="button">
    <span class="avatar${p.circle === 'inner' ? ' in' : ''}">${esc(initials(p.name))}</span>
    <span class="grow">
      <span class="po-name">${esc(p.name)}${p.pinned ? '<i class="po-pin" title="Pinned"></i>' : ''}${p.status && !/^active$/i.test(p.status) ? ` <span class="chip quiet">${esc(p.status.replace(/-/g, ' '))}</span>` : ''}</span>
      <span class="po-sub">${esc(subLine(p))}</span>
      ${whyShown(p) ? `<span class="po-why">${esc(whyShown(p))}</span>` : ''}
    </span>
    <span class="po-meta">
      <span class="po-touch${warn ? ' warn' : ''}">${esc(touchLabel(p.last_touch))}</span>
      ${next ? `<span class="po-next">${next}</span>` : ''}
    </span>
  </button>`;
}

function sortPeople(a, b) {
  return (b.pinned - a.pinned) || (needsTouch(b) - needsTouch(a))
    || ((toDate(b.last_touch)?.getTime() || 0) - (toDate(a.last_touch)?.getTime() || 0))
    || a.name.localeCompare(b.name);
}

function render() {
  const q = $('#q').value.trim().toLowerCase();
  const match = (p) => !q || [p.name, p.relationship, p.org, p.why_they_matter, p.next_step].join(' ').toLowerCase().includes(q);
  const hits = people.filter(match);
  const count = (k) => hits.filter(p => p.circle === k).length;
  $('#seg').innerHTML = [['all', 'All', hits.length], ...CIRCLES.map(([k, n]) => [k, n, count(k)])]
    .map(([k, n, c]) => `<button class="${k === circle ? 'on' : ''}" data-c="${k}" type="button">${esc(n)} <span class="po-n">${c}</span></button>`).join('');
  document.querySelectorAll('#seg button').forEach(b => b.onclick = () => { circle = b.dataset.c; render(); });

  const synced = people.map(p => p.synced_at).filter(Boolean).sort().pop();
  $('#synced').textContent = synced ? `Auto-synced · ${ago(synced)}` : 'Auto-synced';

  const html = CIRCLES.filter(([k]) => circle === 'all' || circle === k).map(([k, name]) => {
    const list = hits.filter(p => p.circle === k).sort(sortPeople);
    if (!list.length) return '';
    const stale = list.filter(needsTouch).length;
    return `<section class="po-sec"><h2 class="po-h">${esc(name)} <span class="po-n">${list.length}</span>${stale ? `<span class="po-hint"><b>${stale} need a touch</b></span>` : ''}</h2>
      <div class="sv-card po-list">${list.map(row).join('')}</div></section>`;
  }).join('');
  $('#sections').innerHTML = html || emptyState(people.length ? 'No matches.' : 'Nobody synced yet.', '');
  document.querySelectorAll('.po-row').forEach(b => b.onclick = () => openDrawer(b.dataset.id));
  renderEngagers(q);
}

function renderEngagers(q) {
  const wrap = $('#eng-wrap');
  if (!engagers.length) { wrap.hidden = true; return; }
  wrap.hidden = false;
  const vis = engagers.filter(r => !q || `${r.name} ${r.headline || ''}`.toLowerCase().includes(q));
  $('#eng-n').textContent = engagers.length;
  $('#eng').innerHTML = vis.map(r => `<div class="row">
      <span class="avatar">${esc(initials(r.name))}</span>
      <div class="grow"><div class="t">${esc(r.name)}</div><div class="s">${esc(r.headline || r.last_interaction || '')}</div></div>
      ${platMark(r.platform)}
      <span class="chip ${r.interactions > 1 ? 'accent' : ''}">${esc(r.interactions)}x</span>
      <span class="sv-muted" style="font-size:.76rem;white-space:nowrap">last ${esc(fmtDay(r.last_seen))}</span>
      ${r.profile_url ? `<a class="btn small" href="${esc(r.profile_url)}" target="_blank" rel="noopener">Profile ${icon('external-link', { size: 12 })}</a>` : ''}
    </div>`).join('') || emptyState('No matches');
}

// ---------- drawer ----------
const kv = (k, v) => v ? `<div class="po-kv"><span>${esc(k)}</span><div>${v}</div></div>` : '';
function linkList(links) {
  const L = links || {}, out = [];
  const href = (u) => /^https?:\/\//.test(u) ? u : 'https://' + u;
  if (L.linkedin) out.push(`<a href="${esc(href(L.linkedin))}" target="_blank" rel="noopener">${/linkedin\.com/i.test(L.linkedin) ? 'LinkedIn' : 'Website'}</a>`);
  if (L.instagram) out.push(`<a href="https://instagram.com/${esc(String(L.instagram).replace(/^@/, ''))}" target="_blank" rel="noopener">Instagram</a>`);
  if (L.twitter) out.push(`<a href="https://x.com/${esc(String(L.twitter).replace(/^@/, ''))}" target="_blank" rel="noopener">X</a>`);
  if (L.email) out.push(`<a href="mailto:${esc(L.email)}">${esc(L.email)}</a>`);
  if (L.phone) out.push(`<a href="tel:${esc(L.phone)}">${esc(L.phone)}</a>`);
  return out.join(' · ');
}
const longDay = (d) => esc(fmtDay(d, { month: 'short', day: 'numeric', year: 'numeric' }));

async function openDrawer(id) {
  const p = people.find(x => x.id === id); if (!p) return;
  let c = p.contact_id ? contacts.get(p.contact_id) : null;
  if (p.contact_id && !c && !DEMO) {
    const { data } = await sb.from('plugverse_contacts')
      .select('id,full_name,role,title,organization,pipeline_stage,pipeline_type,warm_path,last_contacted,next_step,next_step_due,notes,status')
      .eq('id', p.contact_id).maybeSingle();
    if (data) { c = data; contacts.set(data.id, data); }
  }
  const warn = needsTouch(p);
  const notes = (p.links?.notes || []).map(n => `<div class="po-path">${esc(winPath(n))}</div>`).join('');
  $('#drawer-body').innerHTML = `
    <div class="po-dh"><span class="avatar big${p.circle === 'inner' ? ' in' : ''}">${esc(initials(p.name))}</span>
      <div class="grow"><div class="po-dname">${esc(p.name)}</div><div class="po-sub">${esc(subLine(p))}</div></div>
      <button class="dr-x" data-close type="button" aria-label="Close">${icon('x', { size: 18 })}</button></div>
    <div class="po-chips"><span class="chip accent">${esc(CIRCLE_NAME[p.circle] || p.circle)}</span>${p.status && !/^active$/i.test(p.status) ? `<span class="chip quiet">${esc(p.status.replace(/-/g, ' '))}</span>` : ''}${p.pinned ? '<span class="chip">Pinned</span>' : ''}</div>
    ${p.why_they_matter ? `<p class="po-dwhy">${esc(p.why_they_matter)}</p>` : ''}
    <div class="po-kvs">
      ${kv('Last touch', `${p.last_touch ? longDay(p.last_touch) + ' · ' : ''}<span class="${warn ? 'po-warn' : ''}">${esc(touchLabel(p.last_touch))}</span>`)}
      ${kv('Next step', p.next_step ? esc(cap(p.next_step)) + dueTag(p.next_step_due, true) : '')}
      ${kv('Org', p.org ? esc(p.org) : '')}
      ${kv('Links', linkList(p.links))}
    </div>
    ${c ? `<h3 class="po-dh3">Contact record</h3><div class="po-kvs">
      ${kv('Name', esc(c.full_name))}
      ${kv('Role', esc([c.role, c.title].filter(Boolean).join(' · ')))}
      ${kv('Organization', esc(c.organization || ''))}
      ${kv('Pipeline', esc([c.pipeline_type, c.pipeline_stage].filter(Boolean).join(' · ')))}
      ${kv('Warm path', esc(c.warm_path || ''))}
      ${kv('Last contacted', c.last_contacted ? longDay(c.last_contacted) : '')}
      ${kv('Notes', esc(c.notes || ''))}
      <div class="po-kv"><span></span><div><a href="/admin/contacts/">Open in Contacts</a></div></div></div>` : ''}
    <h3 class="po-dh3">Source</h3>
    ${p.source_path ? `<div class="po-path">${esc(winPath(p.source_path))}</div>` : '<div class="sv-muted">Contacts table only, no vault file</div>'}
    ${notes}
    `;
  $('#drawer').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('on');
  $('#drawer-body').querySelector('[data-close]').onclick = closeDrawer;
}
function closeDrawer() { $('#drawer').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true'); $('#scrim').classList.remove('on'); }
$('#scrim').onclick = closeDrawer;
addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

load();
