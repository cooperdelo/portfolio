// /admin/_js/integrations.js — last pull + token expiry per platform.
// Reads: social_pipeline_health, instagram_credentials / tiktok_credentials
// (non-secret columns only), social_account_snapshots, task_run_log.
import { sb } from '/admin/_shell/supabase.js';
import { mountShell } from '/admin/_shell/admin-shell.js';
import { requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc, ago, fmtDay, fmtWhen, emptyState, pageHead, platMark, staleChip, statusChip } from '/admin/_shell/ui.js';

if (!(await requireFullAdminOrRedirect())) throw new Error('not full admin');
await mountShell({ title: 'Integrations' });
const app = document.getElementById('app');
app.innerHTML = pageHead('System', 'Integrations') + `
  <div class="sv-h"><h2>Data pulls</h2><span class="sv-sub">social_pipeline_health, written by the social-pull task</span></div>
  <div class="sv-grid auto" id="pulls"></div>
  <section class="sv-section"><div class="sv-h"><h2>API tokens</h2><span class="sv-sub">Expiry only. Tokens are never loaded into this page.</span></div><div class="sv-card"><div class="rows" id="tokens"></div></div></section>
  <section class="sv-section"><div class="sv-h"><h2>Latest snapshot per account</h2></div><div class="sv-card"><div class="rows" id="snaps"></div></div></section>
  <section class="sv-section"><div class="sv-h"><h2>Watchers</h2></div><div class="sv-card"><div class="rows" id="watch"></div></div></section>`;

const [ph, ig, tt, sn, runs] = await Promise.all([
  sb.from('social_pipeline_health').select('platform,handle,last_successful_pull,expected_cadence_days,status,failure_note,updated_at'),
  sb.from('instagram_credentials').select('username,expires_at,refreshed_at'),
  sb.from('tiktok_credentials').select('username,display_name,expires_at,refresh_expires_at,refreshed_at'),
  sb.from('social_account_snapshots').select('date,platform,handle,followers,source,captured_at,window_days').eq('window_days', 0).order('date', { ascending: false }).limit(500),
  sb.from('task_run_log').select('task,ran_at,status,note').in('task', ['social-pull', 'credential-monitor', 'watchdog']).order('ran_at', { ascending: false }).limit(30),
]);

document.getElementById('pulls').innerHTML = (ph.data || []).map(p => {
  const note = String(p.failure_note || '').split('||')[0].replace(/^\[|\]$/g, '').trim();
  const overdue = p.last_successful_pull && (Date.now() - new Date(p.last_successful_pull)) > (p.expected_cadence_days || 7) * 864e5;
  return `<div class="sv-card">${platMark(p.platform, p.handle)}
    <div style="margin-top:.6rem">${/ok/i.test(p.status) ? '<span class="chip ok">OK</span>' : '<span class="chip fail">' + esc(p.status || 'unknown') + '</span>'} ${overdue ? '<span class="chip stale">overdue</span>' : ''}</div>
    <div class="sv-meta">last good pull <b>${esc(fmtDay(p.last_successful_pull, { month: 'short', day: 'numeric', year: 'numeric' }))}</b> · expected every ${p.expected_cadence_days ?? '?'} days</div>
    <div class="note">${esc(note)}</div></div>`;
}).join('') || emptyState('No pipeline rows', esc(ph.error?.message || 'Fed by the social-pull task.'));

const tokenRow = (plat, name, exp, extra = '') => {
  const days = exp ? Math.round((new Date(exp) - Date.now()) / 864e5) : null;
  const chip = days == null ? '<span class="chip quiet">no expiry on file</span>' : days < 0 ? `<span class="chip fail">expired ${-days}d ago</span>` : days < 10 ? `<span class="chip stale">${days}d left</span>` : `<span class="chip ok">${days}d left</span>`;
  return `<div class="row">${platMark(plat, name)}<div class="grow"><div class="s">expires ${esc(fmtWhen(exp))}${extra}</div></div>${chip}</div>`;
};
document.getElementById('tokens').innerHTML = [
  ...(ig.data || []).map(r => tokenRow('instagram', r.username, r.expires_at, r.refreshed_at ? ` · refreshed ${ago(r.refreshed_at)}` : '')),
  ...(tt.data || []).map(r => tokenRow('tiktok', r.username || r.display_name, r.expires_at, r.refresh_expires_at ? ` · refresh token until ${fmtDay(r.refresh_expires_at)}` : '')),
  `<div class="row">${platMark('linkedin', 'cooperdelo')}<div class="grow"><div class="s">No API connection yet (LinkedIn Community Management API not set up). Numbers come from the Stanley export (2026-09-27) and browser pulls.</div></div><span class="chip quiet">not connected</span></div>`,
  `<div class="row">${platMark('youtube', 'cooperdelo')}<div class="grow"><div class="s">No API connection yet. Subscriber count from the Stanley export (2026-09-27).</div></div><span class="chip quiet">not connected</span></div>`,
].join('');

const seen = new Set();
document.getElementById('snaps').innerHTML = (sn.data || []).filter(r => r.followers != null && !seen.has(r.platform + r.handle) && seen.add(r.platform + r.handle))
  .map(r => `<div class="row">${platMark(r.platform, r.handle)}<div class="grow"><div class="s">${esc(r.source || 'source not recorded')}</div></div><span class="sv-muted" style="font-size:.78rem">${esc(fmtDay(r.date))}</span>${staleChip(r.captured_at || r.date)}</div>`).join('');

const lastBy = {};
(runs.data || []).forEach(r => { if (!lastBy[r.task]) lastBy[r.task] = r; });
document.getElementById('watch').innerHTML = Object.values(lastBy).map(r => `<div class="row" style="align-items:flex-start"><div class="grow"><div class="t">${esc(r.task)} · ${esc(ago(r.ran_at))}</div><div class="sv-text" style="white-space:normal;font-size:.82rem">${esc((r.note || '').slice(0, 280))}</div></div>${statusChip(r.status)}</div>`).join('') || emptyState('No watcher runs', 'Fed by task_run_log.');
