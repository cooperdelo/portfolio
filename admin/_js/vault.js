// /admin/_js/vault.js, Vault (v4, 2026-09-28): the admin view of the vault mirror.
// Reads (live, Supabase): vault_documents (Context/BUILD-LIST.md, Projects/personal-brand/
// CONTENT-STATUS.md, and the file index), decisions, opportunities, agent_bus, task_run_log.
// Every card shows its last update and a red stale chip when older than its cadence.
// Real data only. Localhost ?demo renders from admin/_dev/snapshot.local.json (gitignored).
import { sb } from '/admin/_shell/supabase.js';
import { mountShell, isLocalDemo } from '/admin/_shell/admin-shell.js';
import { requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc, fmtDay, ago, emptyState, pageHead, hoursSince } from '/admin/_shell/ui.js';

const DEMO = isLocalDemo();
if (!DEMO && !(await requireFullAdminOrRedirect())) throw new Error('not full admin');
await mountShell({ title: 'Vault', demo: true });
const app = document.getElementById('app');
let SNAP = null;
if (DEMO) { try { SNAP = await (await fetch('/admin/_dev/snapshot.local.json', { cache: 'no-store' })).json(); } catch { SNAP = null; } }
const V = SNAP?.vault || {};

const BUILD = 'Context/BUILD-LIST.md', CONTENT = 'Projects/personal-brand/CONTENT-STATUS.md';
// cadence in hours: past this, the card gets a red stale chip
const CAD = { build: 24, content: 24 * 7, opps: 36, mirror: 26, bus: 24 };

const stale = (x, h) => x && hoursSince(x) > h ? `<span class="chip stale red">stale · ${esc(ago(x))}</span>` : '';
const upd = (x, h) => `<div class="sv-meta">${x ? `Updated ${esc(ago(x))}` : 'Never updated'} ${h ? stale(x, h) : ''}</div>`;
const head = (t, href) => `<div class="sv-h" style="margin-bottom:.4rem"><h2 class="disp">${esc(t)}</h2>${href ? `<a href="${href}">Open</a>` : ''}</div>`;
const notMirrored = (p) => emptyState(`${p.split('/').pop()} · not mirrored`, '');

app.innerHTML = pageHead('', 'Vault') + `
  <section class="sv-grid c4" id="stats"></section>
  <section class="sv-section sv-grid split">
    <div class="sv-card pad-lg" id="build"></div>
    <div class="sv-card pad-lg" id="content"></div>
  </section>
  <section class="sv-section sv-grid split">
    <div class="sv-card pad-lg" id="decisions"></div>
    <div class="sv-card pad-lg" id="opps"></div>
  </section>
  <section class="sv-section sv-grid split">
    <div class="sv-card pad-lg" id="runs"></div>
    <div class="sv-card pad-lg" id="bus"></div>
  </section>
  <section class="sv-section"><div class="sv-card pad-lg" id="files"></div></section>`;

// ---------- data ----------
async function q(fn, demo) { if (DEMO) return demo; const { data, error } = await fn(); if (error) throw error; return data || []; }
const pDocs = q(() => sb.from('vault_documents').select('path,updated_at,owner_task').order('updated_at', { ascending: false }).limit(2000),
  (V.docs || []).map(([path, updated_at, owner_task]) => ({ path, updated_at, owner_task })));
const pPinned = q(() => sb.from('vault_documents').select('path,content,updated_at').in('path', [BUILD, CONTENT]), V.pinned || []);
const pDec = q(() => sb.from('decisions').select('title,status,recommendation,created_at,updated_at,decided_at,decision').order('created_at', { ascending: false }).limit(50),
  (V.decisions || []).map(([title, status, recommendation, created_at, updated_at, decided_at, decision]) => ({ title, status, recommendation, created_at, updated_at, decided_at, decision })));
const pOpp = q(() => sb.from('opportunities').select('title,status,fit,time_hours,proof,estimate,rank,updated_at').order('rank'),
  (V.opps || []).map(([title, status, fit, time_hours, proof, estimate, rank, updated_at]) => ({ title, status, fit, time_hours, proof, estimate, rank, updated_at })));
const pBus = q(() => sb.from('agent_bus').select('created_at,from_agent,to_agent,kind,topic,status').order('created_at', { ascending: false }).limit(400),
  (V.bus || []).map(([created_at, from_agent, to_agent, kind, topic, status]) => ({ created_at, from_agent, to_agent, kind, topic, status })));
const pRuns = q(() => sb.from('task_run_log').select('task,ran_at,status').gte('ran_at', new Date(Date.now() - 14 * 864e5).toISOString()).order('ran_at', { ascending: false }).limit(3000),
  (SNAP?.runs || []).map(([task, ran_at, status]) => ({ task, ran_at, status })));

const fail = (id, e) => { console.error(id, e); document.getElementById(id).innerHTML = emptyState(`Couldn't load ${id}`, esc(e?.message || String(e))); };

// ---------- stats ----------
Promise.all([pDocs, pBus.catch(() => [])]).then(([docs, bus]) => {
  const last = docs[0]?.updated_at;
  const day = docs.filter(d => hoursSince(d.updated_at) < 24).length;
  const open = DEMO && V.bus_open != null ? V.bus_open : bus.filter(b => b.status === 'open').length;
  const cell = (label, num, meta = '') => `<div class="sv-card"><div class="sv-label">${label}</div><div class="hc-num md">${num}</div>${meta}</div>`;
  document.getElementById('stats').innerHTML =
    cell('Files mirrored', (DEMO && V.docs_total ? V.docs_total : docs.length).toLocaleString('en-US')) +
    cell('Changed in 24h', day) +
    cell('Last change', last ? esc(ago(last)) : '–', stale(last, CAD.mirror)) +
    cell('Open agent messages', open);
}).catch(e => fail('stats', e));

// ---------- build list ----------
pPinned.then(pinned => {
  const doc = pinned.find(d => d.path === BUILD);
  const el = document.getElementById('build');
  if (!doc) { el.innerHTML = head('Build list') + notMirrored(BUILD); return; }
  const rx = /^- \[( |x)\] (\w+)\s*·\s*(P\d)\s*·\s*([^·]+?)\s*·\s*\*\*(.+?)\*\*/;
  const items = doc.content.split('\n').map(l => l.match(rx)).filter(Boolean).map(m => ({ done: m[1] === 'x', id: m[2], p: m[3], area: m[4].trim(), title: m[5].replace(/:$/, '') }));
  const open = items.filter(i => !i.done);
  el.innerHTML = head('Build list') + `
    <div class="dec-num"><span class="hc-num md">${open.length}</span><span class="mono">open · ${items.length - open.length} done</span></div>
    <div class="rows">${open.slice(0, 10).map(i => `<div class="row"><span class="chip ${i.p === 'P1' ? 'accent' : ''}">${esc(i.p)}</span><div class="grow"><div class="t">${esc(i.title)}</div><div class="s">${esc(i.id)} · ${esc(i.area)}</div></div></div>`).join('')}</div>
    ${open.length > 10 ? `<div class="sv-meta">+${open.length - 10} more</div>` : ''}
    ${upd(doc.updated_at, CAD.build)}`;
}).catch(e => fail('build', e));

// ---------- content this week ----------
pPinned.then(pinned => {
  const doc = pinned.find(d => d.path === CONTENT);
  const el = document.getElementById('content');
  if (!doc) { el.innerHTML = head('Content this week') + notMirrored(CONTENT); return; }
  const week = (doc.content.match(/^week_of:\s*(\S+)/m) || [])[1];
  const i = doc.content.indexOf("## THIS WEEK'S TARGET");
  const rows = i < 0 ? [] : doc.content.slice(i).split('\n').slice(1).filter(l => /^\|/.test(l)).map(l => l.split('|').slice(1, -1).map(c => c.trim())).filter(c => c.length >= 3 && !/^-+$/.test(c[0]) && c[0] !== '#');
  const monday = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  el.innerHTML = head('Content this week') + `
    <div class="dec-num"><span class="hc-num md">${week ? esc(fmtDay(week)) : '–'}</span><span class="mono">week of${week && week < monday ? ' <span class="chip stale red">last week</span>' : ''}</span></div>
    <div class="rows">${rows.map(c => `<div class="row"><div class="grow"><div class="t">${esc(c[1])}</div></div><span class="sv-num">${esc(c[2])}</span></div>`).join('') || emptyState('No target table this week', '')}</div>
    ${upd(doc.updated_at, CAD.content)}`;
}).catch(e => fail('content', e));

// ---------- decisions ----------
pDec.then(rows => {
  const open = rows.filter(r => r.status === 'open'), done = rows.filter(r => r.status !== 'open' && r.status !== 'later');
  const last = rows.map(r => r.updated_at || r.created_at).sort().pop();
  document.getElementById('decisions').innerHTML = head('Decisions', '/admin/decisions/') + `
    <div class="dec-num"><span class="hc-num md">${open.length}</span><span class="mono">open · ${done.length} decided</span></div>
    <div class="rows">${[...open, ...done].slice(0, 6).map(r => `<div class="row"><div class="grow"><div class="t">${esc(r.title)}</div><div class="s">${r.status === 'open' ? esc(r.recommendation || '') : esc(r.decision || r.status) + (r.decided_at ? ' · ' + esc(fmtDay(r.decided_at)) : '')}</div></div><span class="chip ${r.status === 'open' ? 'accent' : r.status === 'no' ? 'fail' : 'ok'}">${esc(r.status)}</span></div>`).join('') || emptyState('No decisions recorded', '')}</div>
    ${upd(last)}`;
}).catch(e => fail('decisions', e));

// ---------- opportunities ----------
pOpp.then(rows => {
  const open = rows.filter(r => r.status === 'open');
  const last = rows.map(r => r.updated_at).sort().pop();
  document.getElementById('opps').innerHTML = head('Opportunities', '/admin/earn/') + `
    <div class="dec-num"><span class="hc-num md">${open.length}</span><span class="mono">open</span></div>
    <div class="rows">${open.slice(0, 6).map(r => `<div class="row"><div class="grow"><div class="t">${esc(r.title)}</div><div class="s">${esc(r.estimate || '')}</div></div><span class="sv-muted" style="font-size:.78rem;white-space:nowrap">fit ${esc(r.fit ?? '–')} · ${esc(r.time_hours ?? '–')}h</span></div>`).join('') || emptyState('No open opportunities', '')}</div>
    ${upd(last, CAD.opps)}`;
}).catch(e => fail('opps', e));

// ---------- agent runs: latest per task, stale when overdue vs its own rhythm ----------
pRuns.then(runs => {
  const by = new Map();
  for (const r of runs) { if (!by.has(r.task)) by.set(r.task, []); by.get(r.task).push(r); }
  const rows = [...by.entries()].map(([task, rs]) => {
    const t = rs.map(r => new Date(r.ran_at).getTime()).sort((a, b) => b - a);
    const gaps = t.slice(1).map((x, i) => (t[i] - x) / 3.6e6).filter(g => g > 0.5).sort((a, b) => a - b);
    const cadence = gaps.length ? Math.max(2, gaps[Math.floor(gaps.length / 2)]) : 24 * 7;
    return { task, last: rs[0], cadence, overdue: hoursSince(rs[0].ran_at) > cadence * 2 };
  }).sort((a, b) => (b.overdue - a.overdue) || (b.last.status === 'failed') - (a.last.status === 'failed') || new Date(b.last.ran_at) - new Date(a.last.ran_at));
  const bad = rows.filter(r => r.overdue || r.last.status === 'failed').length;
  document.getElementById('runs').innerHTML = head('Agent runs', '/admin/rituals/') + `
    <div class="dec-num"><span class="hc-num md">${rows.length}</span><span class="mono">agents in 14 days · ${bad} need a look</span></div>
    <div class="rows">${rows.slice(0, 10).map(r => `<div class="row"><i class="c ${esc(r.last.status)}" style="width:9px;height:9px;border-radius:3px;flex:0 0 auto"></i><div class="grow"><div class="t code">${esc(r.task)}</div></div><span class="sv-muted" style="font-size:.78rem;white-space:nowrap">${esc(ago(r.last.ran_at))}</span>${r.overdue ? '<span class="chip stale red">overdue</span>' : r.last.status === 'failed' ? '<span class="chip fail">failed</span>' : ''}</div>`).join('') || emptyState('No runs in 14 days', '')}</div>
    ${upd(runs[0]?.ran_at, 26)}`;
}).catch(e => fail('runs', e));

// ---------- agent bus ----------
pBus.then(rows => {
  const open = DEMO && V.bus_open != null ? V.bus_open : rows.filter(r => r.status === 'open').length;
  document.getElementById('bus').innerHTML = head('Agent bus') + `
    <div class="dec-num"><span class="hc-num md">${open}</span><span class="mono">open messages</span></div>
    <div class="rows">${rows.slice(0, 8).map(r => `<div class="row"><div class="grow"><div class="t code">${esc(r.topic || r.kind)}</div><div class="s">${esc(r.from_agent)} → ${esc(r.to_agent)} · ${esc(r.kind)}</div></div><span class="chip ${r.status === 'open' ? 'accent' : r.status === 'skipped' ? '' : 'ok'}">${esc(r.status)}</span></div>`).join('') || emptyState('No messages', '')}</div>
    ${upd(rows[0]?.created_at, CAD.bus)}`;
}).catch(e => fail('bus', e));

// ---------- recently changed files ----------
pDocs.then(docs => {
  document.getElementById('files').innerHTML = head('Recently changed files') + `
    <div class="rows">${docs.slice(0, 12).map(d => `<div class="row"><div class="grow"><div class="t code">${esc(d.path)}</div><div class="s">${esc(d.owner_task || '')}</div></div><span class="sv-muted" style="font-size:.78rem;white-space:nowrap">${esc(ago(d.updated_at))}</span></div>`).join('') || emptyState('Nothing mirrored yet', '')}</div>
    ${upd(docs[0]?.updated_at, CAD.mirror)}`;
}).catch(e => fail('files', e));
