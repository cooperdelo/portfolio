// /admin/_js/integrations.js, where every number comes from, live.
// Reads: integration_sources_status() RPC (non-secret connection state + last runs),
// social_pipeline_health, social_account_snapshots, task_run_log.
// Tokens never load into this page. Connect buttons hand off to server-side OAuth:
//   Instagram -> /api/instagram-auth-start (Vercel)  -> /api/instagram-oauth
//   YouTube   -> edge function youtube-oauth (POST for the URL, Google redirects back to it)
import { sb } from '/admin/_shell/supabase.js';
import { mountShell, isLocalDemo } from '/admin/_shell/admin-shell.js';
import { requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc, ago, fmtDay, emptyState, pageHead, platMark, staleChip, statusChip, freshStrip } from '/admin/_shell/ui.js';
import { dataFreshness } from '/admin/_shell/live-data.js';

if (!isLocalDemo() && !(await requireFullAdminOrRedirect())) throw new Error('not full admin');
await mountShell({ title: 'Integrations', demo: true });
const app = document.getElementById('app');
app.innerHTML = pageHead('System', 'Integrations') + `
  <div id="flash"></div>
  <div id="fresh"></div>
  <section class="sv-section" style="margin-top:0"><div class="sv-h"><h2>Where your numbers come from</h2></div><div class="sv-card"><div class="rows" id="sources"></div></div></section>
  <section class="sv-section"><div class="sv-h"><h2>Public pulls by account</h2></div><div class="sv-grid auto" id="pulls"></div></section>
  <section class="sv-section"><div class="sv-h"><h2>Latest snapshot per account</h2></div><div class="sv-card"><div class="rows" id="snaps"></div></div></section>
  <section class="sv-section"><div class="sv-h"><h2>Watchers</h2></div><div class="sv-card"><div class="rows" id="watch"></div></div></section>`;

// ---- flash from an OAuth round trip ----
const qp = new URLSearchParams(location.search);
if (qp.get('connected') || qp.get('oauth_error')) {
  const ok = !!qp.get('connected');
  const msg = ok
    ? (qp.get('connected') === 'youtube'
        ? `YouTube connected. First pull: ${esc(qp.get('pull') || 'queued')}.`
        : `Instagram connected${qp.get('handle') ? ' as @' + esc(qp.get('handle')) : ''}. First per-post pull runs within 10 minutes.`)
    : `Connect did not finish: ${esc(qp.get('oauth_error'))}`;
  document.getElementById('flash').innerHTML = `<div class="sv-card" style="margin-bottom:1rem"><span class="chip ${ok ? 'ok' : 'fail'}">${ok ? 'Connected' : 'Not connected'}</span> <span class="sv-text">${msg}</span></div>`;
  history.replaceState(null, '', location.pathname);
}

dataFreshness().then(r => { document.getElementById('fresh').innerHTML = freshStrip(r, { link: '/admin/vault/' }); })
  .catch(e => { document.getElementById('fresh').innerHTML = emptyState("Couldn't load feed status", esc(e?.message || String(e))); });

const [st, ph, sn, runs] = await Promise.all([
  sb.rpc('integration_sources_status'),
  sb.from('social_pipeline_health').select('platform,handle,last_successful_pull,expected_cadence_days,status,failure_note,updated_at'),
  sb.from('social_account_snapshots').select('date,platform,handle,followers,source,captured_at,window_days').eq('window_days', 0).order('date', { ascending: false }).limit(500),
  sb.from('task_run_log').select('task,ran_at,status,note')
    .in('task', ['social-pull', 'social-pull-load', 'credential-monitor', 'watchdog', 'ig-token-refresh', 'instagram-api-pull', 'youtube-analytics-pull'])
    .order('ran_at', { ascending: false }).limit(60),
]);

const S = st.data || { instagram: [], youtube: [], google_client_set: false, runs: {} };
const R = S.runs || {};
const health = (ph.data || []);
const publicRows = health.filter(p => !/\(api\)$/.test(p.handle || ''));
const apiRow = (plat, handle) => health.find(p => p.platform === plat && p.handle === `${handle} (api)`);

const chip = (kind, text) => `<span class="chip ${kind}">${esc(text)}</span>`;
const row = (plat, handle, title, sub, right) =>
  `<div class="row" style="align-items:flex-start">${platMark(plat, handle)}<div class="grow"><div class="t">${esc(title)}</div><div class="s" style="white-space:normal">${sub}</div></div><div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;justify-content:flex-end">${right}</div></div>`;
const lastRun = (task) => R[task] ? `${esc(ago(R[task].ran_at))}` : 'not yet';
const day = (d) => esc(fmtDay(d, { month: 'short', day: 'numeric' }));

function publicChip(plat) {
  const rows = publicRows.filter(p => p.platform === plat);
  if (!rows.length) return chip('quiet', 'no pull yet');
  const bad = rows.find(p => !/ok/i.test(p.status || ''));
  const overdue = rows.find(p => p.last_successful_pull && (Date.now() - new Date(p.last_successful_pull)) > ((p.expected_cadence_days || 7) + 1) * 864e5);
  if (bad) return chip('fail', 'failing');
  if (overdue) return chip('stale', 'overdue');
  return chip('ok', 'OK');
}
const publicLast = (plat) => {
  const d = publicRows.filter(p => p.platform === plat).map(p => p.last_successful_pull).filter(Boolean).sort().pop();
  return d ? `Last good pull ${day(d)}` : 'No pull yet';
};

// ---- Instagram ----
const igLive = (S.instagram || []).filter(a => a.live);
const igOld = (S.instagram || []).filter(a => !a.live);
const connectIg = (label, primary) => `<a class="btn small ${primary ? 'primary' : 'ghost'}" href="/api/instagram-auth-start">${label}</a>`;
const igRows = [
  row('instagram', null, 'Public pull (Apify + laptop)', `Views, likes, comments for every account, daily. ${publicLast('instagram')}.`, publicChip('instagram')),
  ...igLive.map(a => {
    const h = apiRow('instagram', a.username);
    const failing = h && !/ok/i.test(h.status || '');
    const pulled = h?.last_successful_pull ? `Last pull ${day(h.last_successful_pull)}` : 'First pull within 10 minutes';
    return row('instagram', a.username, 'Instagram API',
      `Reach, saves, shares and watch time per post, daily. ${pulled}. Token renews itself, good until ${day(a.expires_at)}.${failing ? ' ' + esc(h.failure_note || '') : ''}`,
      failing ? chip('fail', 'failing') : chip('ok', 'Connected'));
  }),
  igLive.length
    ? row('instagram', null, 'Add another account', 'Connect @plugverse.app the same way. Instagram asks which account.', connectIg('Connect another', false))
    : row('instagram', null, 'Instagram API',
        `Adds reach, saves, shares and watch time per post. One click per account, then it runs itself.${igOld.length ? ` The old link from May expired ${day(igOld[0].expires_at)}.` : ''}`,
        chip('quiet', 'not connected') + connectIg('Connect', true)),
];

// ---- YouTube ----
const yt = S.youtube || [];
let ytRow;
if (yt.length) {
  ytRow = yt.map(c => {
    const h = apiRow('youtube', c.channel);
    const failing = !!c.last_error || (h && !/ok/i.test(h.status || ''));
    return row('youtube', c.channel, 'YouTube Analytics',
      `Views, watch minutes, average view duration per video, daily. Last pull ${lastRun('youtube-analytics-pull')}.${failing ? ' ' + esc(c.last_error || h?.failure_note || '') : ''}`,
      failing ? chip('fail', 'failing') : chip('ok', 'Connected'));
  }).join('');
} else if (S.google_client_set) {
  ytRow = row('youtube', null, 'YouTube Analytics', 'Adds watch minutes and average view duration per video. One click, then it runs itself.',
    chip('quiet', 'not connected') + `<button class="btn small primary" id="yt-connect">Connect</button>`);
} else {
  ytRow = row('youtube', null, 'YouTube Analytics',
    `Adds watch minutes and average view duration. Needs a Google client first, one time. Paste the JSON file Google gives you:
     <div style="margin-top:.6rem;display:flex;gap:.5rem;flex-wrap:wrap;align-items:flex-start">
       <textarea id="g-json" rows="2" placeholder='{"web":{"client_id":"...","client_secret":"..."}}' style="flex:1;min-width:220px;font:12px 'Geist Mono',monospace;background:transparent;color:inherit;border:1px solid rgba(127,127,127,.35);border-radius:8px;padding:.5rem"></textarea>
       <button class="btn small primary" id="g-save">Save</button></div>
     <div class="s" id="g-msg" style="margin-top:.4rem"></div>`,
    chip('quiet', 'not connected'));
}
ytRow = row('youtube', null, 'Public pull (Apify + laptop)', `Views, likes, comments per video, daily. ${publicLast('youtube')}.`, publicChip('youtube')) + ytRow;

// ---- others ----
const others = [
  row('tiktok', null, 'Public pull (Apify + laptop)', `Public data covers views, likes, comments, shares. Nothing else to connect. ${publicLast('tiktok')}.`, publicChip('tiktok')),
  row('linkedin', null, 'LinkedIn impressions', 'Needs LinkedIn approval. Public reactions and comments still pull daily.', chip('quiet', 'needs approval')),
  row('linkedin', null, 'Public pull (Apify + laptop)', `Reactions, comments, reposts per post. ${publicLast('linkedin')}.`, publicChip('linkedin')),
  row('x', null, 'X', 'Public posts only. The X API is pay per use, skipped for now.', chip('quiet', 'public only')),
];

document.getElementById('sources').innerHTML = st.error
  ? emptyState("Couldn't load sources", esc(st.error.message))
  : [...igRows, ytRow, ...others].join('');

// ---- YouTube actions ----
document.getElementById('yt-connect')?.addEventListener('click', async (ev) => {
  const b = ev.currentTarget;
  b.disabled = true; b.textContent = 'Opening Google';
  const { data, error } = await sb.functions.invoke('youtube-oauth', { body: { action: 'start' } });
  if (data?.url) { location.href = data.url; return; }
  b.disabled = false; b.textContent = 'Connect';
  alert('Could not start: ' + (data?.reason || error?.message || 'unknown'));
});
document.getElementById('g-save')?.addEventListener('click', async () => {
  const msg = document.getElementById('g-msg');
  const box = document.getElementById('g-json');
  const val = box.value.trim();
  if (!val) { msg.textContent = 'Paste the JSON first.'; return; }
  const { data, error } = await sb.rpc('set_google_oauth_client', { p_json: val });
  box.value = '';
  if (error) { msg.innerHTML = `<span class="chip fail">Not saved</span> ${esc(error.message)}`; return; }
  msg.innerHTML = data?.redirect_ok
    ? '<span class="chip ok">Saved</span> Reloading.'
    : '<span class="chip stale">Saved</span> The redirect URI in that file is not https://eibtnkaoqsgwiqttiwjo.supabase.co/functions/v1/youtube-oauth. Add it in Google Cloud or Connect will fail.';
  setTimeout(() => location.reload(), data?.redirect_ok ? 700 : 6000);
});

// ---- public pulls grid ----
document.getElementById('pulls').innerHTML = publicRows.map(p => {
  const note = String(p.failure_note || '').split('||')[0].replace(/^\[|\]$/g, '').trim();
  const overdue = p.last_successful_pull && (Date.now() - new Date(p.last_successful_pull)) > ((p.expected_cadence_days || 7) + 1) * 864e5;
  const ok = /ok/i.test(p.status || '');
  const every = p.expected_cadence_days == null ? '' : p.expected_cadence_days === 1 ? ' · daily' : ` · every ${p.expected_cadence_days} days`;
  return `<div class="sv-card pull">
    <div class="pull-h">${platMark(p.platform, p.handle)}${ok && !overdue ? '<span class="pull-ok">OK</span>' : `${ok ? '' : `<span class="chip fail">${esc(p.status || 'unknown')}</span>`}${overdue ? '<span class="chip stale">overdue</span>' : ''}`}</div>
    <div class="sv-meta">Last good pull <b>${esc(fmtDay(p.last_successful_pull, { month: 'short', day: 'numeric' }))}</b>${every}</div>
    ${note && !ok ? `<div class="note">${esc(note)}</div>` : ''}</div>`;
}).join('') || emptyState(ph.error ? "Couldn't load pipeline rows" : 'No pipeline rows yet.', esc(ph.error?.message || ''));

const seen = new Set();
document.getElementById('snaps').innerHTML = (sn.data || []).filter(r => r.followers != null && !seen.has(r.platform + r.handle) && seen.add(r.platform + r.handle))
  .map(r => `<div class="row">${platMark(r.platform, r.handle)}<div class="grow"><div class="s">${esc(r.source || 'source not recorded')}</div></div><span class="sv-muted" style="font-size:.78rem">${esc(fmtDay(r.date))}</span>${staleChip(r.captured_at || r.date)}</div>`).join('') || emptyState(sn.error ? "Couldn't load snapshots" : 'No snapshots yet.', esc(sn.error?.message || ''));

const lastBy = {};
(runs.data || []).forEach(r => { if (!lastBy[r.task]) lastBy[r.task] = r; });
document.getElementById('watch').innerHTML = Object.values(lastBy).map(r => `<div class="row" style="align-items:flex-start"><div class="grow"><div class="t">${esc(r.task)} · ${esc(ago(r.ran_at))}</div><div class="sv-text clamp2" title="${esc(r.note || '')}">${esc((r.note || '').slice(0, 280))}</div></div>${statusChip(r.status)}</div>`).join('') || emptyState('No watcher runs yet.', '');
