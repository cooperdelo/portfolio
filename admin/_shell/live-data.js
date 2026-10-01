// =====================================================================
// /admin/_shell/live-data.js, zero-manual-input data module (2026-09-28, admin-data-audit).
// Every loader reads a Supabase view that is filled automatically. Nothing here
// asks Cooper to paste, type or register anything. Each row carries its own
// timestamp so the page can show "as of" and flag staleness.
// Views: v_admin_data_freshness_status, v_social_posts_latest, v_admin_vault_docs,
//        account_balances (Mercury, auto), personal_balance_snapshots (money-watch).
// Docs: C:\Users\coope\Desktop\Claude\Projects\admin\DATA-COVERAGE-2026-09-28.md
//
// Localhost-only demo (?demo on 127.0.0.1/localhost): loaders read the gitignored
// admin/_dev/snapshot.local.json `live` block instead of Supabase. Never on any
// other host.
// =====================================================================
import { sb } from './supabase.js';

const THUMB_BASE = 'https://eibtnkaoqsgwiqttiwjo.supabase.co/storage/v1/object/public/social-thumbs/';

export function isDemo() {
  const local = location.protocol === 'http:' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  return local && new URLSearchParams(location.search).has('demo');
}
let _snap, _full;
async function snap() {
  if (_snap !== undefined) return _snap;
  try { _full = await (await fetch('/admin/_dev/snapshot.local.json', { cache: 'no-store' })).json(); _snap = _full?.live || null; }
  catch { _snap = null; _full = null; }
  return _snap;
}

/** Newest follower/post-count snapshot per platform+handle (social_account_snapshots,
 *  filled by the laptop Apify/social-stats jobs and the Stanley export). Each row keeps
 *  its own date + source so the page can say "as of" and flag staleness. */
export async function accountSnapshotsLatest() {
  let rows;
  if (isDemo()) {
    await snap();
    rows = (_full?.accounts || []).map(([date, platform, handle, followers, captured_at]) => ({ date, platform, handle, followers, captured_at, posts_total: null, source: 'demo snapshot' }));
  } else {
    const { data, error } = await sb.from('social_account_snapshots')
      .select('date,platform,handle,followers,posts_total,source,captured_at')
      .order('date', { ascending: false }).order('captured_at', { ascending: false }).limit(400);
    if (error) throw error;
    rows = data || [];
  }
  const out = {};
  for (const r of rows) { const k = r.platform + '|' + String(r.handle || '').toLowerCase(); (out[k] ??= { ...r, history: [] }).history.push({ date: r.date, followers: r.followers }); }
  return Object.values(out);
}

/** Personal brand + PlugVerse accounts that belong in the "All posts" feed. */
export const FEED_ACCOUNTS = {
  linkedin: ['cooperdelo', 'plugverseapp'],
  instagram: ['cooperdelo', 'cooperdelo_', 'plugverse.app', 'the.band.rubber'],
  tiktok: ['cooperdelo', 'cooper delo', 'plugverse.app'],
  youtube: ['cooperdelo'],
};
export const isPlugverseHandle = (h) => /plugverse/i.test(String(h || ''));

/** The one number each platform is judged on. LinkedIn: impressions only when a real
 *  impressions figure exists for that post, otherwise reactions (never relabelled). */
export function keyMetric(p) {
  if (p.platform === 'linkedin') {
    if (p.impressions != null) return { value: p.impressions, label: 'impressions' };
    if (p.likes != null) return { value: p.likes, label: 'reactions' };
    return { value: null, label: 'reactions' };
  }
  if (p.views != null) return { value: p.views, label: 'views' };
  if (p.likes != null) return { value: p.likes, label: 'likes' };
  return { value: null, label: 'views' };
}

/** One row per feed: { label, source_table, last_at, age_hours, max_age_days, status: fresh|stale|empty } */
export async function dataFreshness() {
  if (isDemo()) return ((await snap())?.freshness || []).map(([label, source_table, last_at, age_hours, max_age_days, status]) => ({ label, source_table, last_at, age_hours, max_age_days, status }));
  const { data, error } = await sb.from('v_admin_data_freshness_status').select('*');
  if (error) throw error;
  return data || [];
}

/** Posts for every platform with newest metrics + a permanent thumbnail (Supabase storage copy).
 *  opts: { platform, handle, limit } */
export async function socialPostsLatest(opts = {}) {
  let rows;
  if (isDemo()) {
    rows = ((await snap())?.posts || []).map(([platform, account_handle, posted_at, caption, thumb, permalink, as_of, views, impressions, likes, comments, shares]) =>
      ({ id: permalink || posted_at + platform, platform, account_handle, posted_at, caption, thumb_url: thumb ? thumb.replace(/^~/, THUMB_BASE) : null, permalink, as_of, views, impressions, likes, comments, shares }));
    if (opts.platform) rows = rows.filter(r => r.platform === opts.platform);
  } else {
    let q = sb.from('v_social_posts_latest').select('*').order('posted_at', { ascending: false, nullsFirst: false }).limit(opts.limit || 300);
    if (opts.platform) q = q.eq('platform', opts.platform);
    if (opts.handle) q = q.ilike('account_handle', opts.handle);
    const { data, error } = await q;
    if (error) throw error;
    rows = data || [];
  }
  return rows.map(p => { const k = keyMetric(p); return { ...p, reach: k.value, reachLabel: k.label }; });
}

/** Live vault docs (BUILD-LIST, CONTENT-STATUS, decisions, opportunities, TASK-ROSTER, WATCHDOG) with age. */
export async function vaultDocs({ withContent = false } = {}) {
  const cols = 'path,updated_at,updated_by,synced_to_vault_at,chars,age_hours' + (withContent ? ',content' : '');
  const { data, error } = await sb.from('v_admin_vault_docs').select(cols).order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Aggregates only: newest balance per account (Mercury auto + personal snapshots). */
export async function balances() {
  if (isDemo()) {
    const b = (await snap())?.balances || { business: [], personal: [] };
    return { business: b.business || [], personal: b.personal || [] };
  }
  const [m, p] = await Promise.all([
    sb.from('account_balances').select('source,account_label,balance,balance_kind,as_of').order('as_of', { ascending: false }).limit(20),
    sb.from('personal_balance_snapshots').select('account,balance,as_of,source').order('as_of', { ascending: false }).limit(40),
  ]);
  if (m.error) throw m.error; if (p.error) throw p.error;
  const latest = (rows, key) => Object.values((rows || []).reduce((acc, r) => (acc[r[key]] ??= r, acc), {}));
  return { business: latest(m.data, 'account_label'), personal: latest(p.data, 'account') };
}

// =====================================================================
// TODAY / command center (2026-09-28). Agents write asks, decisions and status
// into public.command_center and the week's posting ladder into public.content_plan
// (view v_content_ladder). Cooper only taps: a checkbox (done) or an option
// (answer + answered_at). Agents poll answered rows and act, then set done.
// Rule for agents: C:\Users\coope\Desktop\Claude\Context\COMMAND-CENTER.md
// =====================================================================
const _demoWrites = new Map();

/** Open + recently-closed command_center rows, not expired. */
export async function commandCenter() {
  let rows;
  if (isDemo()) { await snap(); rows = (_full?.today?.cc || []).map(r => ({ ...r, ...(_demoWrites.get('cc' + r.id) || {}) })); }
  else {
    const { data, error } = await sb.from('command_center')
      .select('id,kind,title,body,context,options,answer,answered_at,source_task,source_path,priority,due,created_at,updated_at,expires_at,done')
      .order('priority', { ascending: true }).limit(200);
    if (error) throw error;
    rows = data || [];
  }
  const now = Date.now();
  return rows.filter(r => !r.expires_at || new Date(r.expires_at).getTime() > now);
}

/** One tap: write fields on a command_center row (answer/answered_at/done only). */
export async function updateCommand(id, patch) {
  if (isDemo()) { _demoWrites.set('cc' + id, { ...(_demoWrites.get('cc' + id) || {}), ...patch }); return; }
  const { error } = await sb.from('command_center').update(patch).eq('id', id);
  if (error) throw error;
}

/** "What to improve" (v_home_recommendations, 2026-09-28): 3 to 6 rows computed in SQL from
 *  social_posts, content_plan, plugverse_contacts and the outreach send queue. Every number in
 *  `evidence` carries its platform, handle and as-of date. Fields: sort, area, headline, evidence,
 *  detail, action, link, severity (0 on goal .. 3 far off). */
export async function homeRecommendations() {
  if (isDemo()) { await snap(); return _full?.home_recs || []; }
  const { data, error } = await sb.from('v_home_recommendations').select('*').order('sort');
  if (error) throw error;
  return data || [];
}

/** Today's full list (v_today_list): calendar, content, tasks, with feeling + deferral applied in SQL. */
export async function todayList() {
  if (isDemo()) {
    await snap();
    return (_full?.today?.list || []).map(r => {
      const w = _demoWrites.get('tl' + r.grp + r.ref) || {}, feeling = _demoWrites.get('feeling') || r.feeling;
      return { ...r, ...w, feeling, deferred: feeling === 'drained' && r.must_rank > 3 };
    });
  }
  const { data, error } = await sb.from('v_today_list').select('*');
  if (error) throw error;
  return data || [];
}
/** One tap on a Today row: routes the write by group. */
export async function checkToday(grp, ref, done) {
  if (isDemo()) { _demoWrites.set('tl' + grp + ref, { done }); return; }
  const q = grp === 'calendar' ? sb.from('calendar_today').update({ done }).eq('event_id', ref)
    : grp === 'content' ? sb.rpc('content_mark_posted', { p_id: +ref, p_posted: done })
    : sb.from('command_center').update({ done, answered_at: done ? new Date().toISOString() : null }).eq('id', +ref);
  const { error } = await q;
  if (error) throw error;
}
/** How are you feeling today: energized | normal | drained. */
export async function setFeeling(feeling) {
  if (isDemo()) { _demoWrites.set('feeling', feeling); return; }
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const { error } = await sb.from('daily_checkin').upsert({ day, feeling, set_at: new Date().toISOString() }, { onConflict: 'day' });
  if (error) throw error;
}

/** This week's posting ladder (v_content_ladder). */
export async function contentLadder() {
  if (isDemo()) { await snap(); return (_full?.today?.ladder || []).map(r => ({ ...r, ...(_demoWrites.get('cp' + r.id) || {}) })); }
  const { data, error } = await sb.from('v_content_ladder').select('*');
  if (error) throw error;
  return data || [];
}
export async function answerLadder(id, patch) {
  if (isDemo()) { _demoWrites.set('cp' + id, { ...(_demoWrites.get('cp' + id) || {}), ...patch }); return; }
  const { error } = await sb.from('content_plan').update(patch).eq('id', id);
  if (error) throw error;
}

/** Content schedule (v_content_schedule): this week, both lanes, with posts matched
 *  from social_posts ("auto") and past unposted days marked "missed". */
export async function contentSchedule() {
  if (isDemo()) { await snap(); return (_full?.schedule || []).map(r => ({ ...r, ...(_demoWrites.get('cp' + r.id) || {}) })); }
  const { data, error } = await sb.from('v_content_schedule').select('*');
  if (error) throw error;
  return data || [];
}
/** Personal-brand pillars (weekly targets) + the brand lines (why someone follows, throughline). */
export async function contentPillars() {
  if (isDemo()) { await snap(); return { pillars: _full?.pillars || [], brand: _full?.brand || {} }; }
  const [p, b] = await Promise.all([
    sb.from('content_pillars').select('key,label,weekly_target,what,format_ref,sort').order('sort'),
    sb.from('content_brand').select('key,value'),
  ]);
  if (p.error) throw p.error;
  const brand = Object.fromEntries((b.data || []).map(r => [r.key, r.value]));
  return { pillars: p.data || [], brand };
}
/** Persist auto-posted matches + keep today's "do" rows in step (also runs every 20 min via pg_cron). */
export async function scheduleSync() {
  if (isDemo()) return null;
  const { data, error } = await sb.rpc('content_schedule_sync');
  if (error) throw error;
  return data;
}
/** Full option details (what's on screen, payoff line, rendered file) keyed by option id. */
export async function optionBank() {
  if (isDemo()) { await snap(); return Object.fromEntries((_full?.option_bank || []).map(o => [o.id, o])); }
  const { data, error } = await sb.from('content_option_bank')
    .select('id,label,lane,format,on_screen,payoff,caption,render_path,preview_url,reference_url,reference_stats,framework,personalize,source');
  if (error) throw error;
  return Object.fromEntries((data || []).map(o => [o.id, o]));
}
/** Messages Cooper sent Claude about one thing (e.g. a schedule slot) and Claude's replies. */
export async function inboxFor(refTable, refId) {
  if (isDemo()) return (_demoWrites.get('inbox' + refTable + refId) || []);
  const { data, error } = await sb.from('claude_inbox').select('id,created_at,kind,message,status,response,responded_at')
    .eq('ref_table', refTable).eq('ref_id', String(refId)).order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return data || [];
}
export async function sendInbox({ refTable, refId, kind, message, context }) {
  const row = { ref_table: refTable, ref_id: String(refId), kind, message, context: context || null, source: 'admin' };
  if (isDemo()) { const k = 'inbox' + refTable + refId; _demoWrites.set(k, [{ ...row, created_at: new Date().toISOString(), status: 'open' }, ...(_demoWrites.get(k) || [])]); return; }
  const { error } = await sb.from('claude_inbox').insert(row);
  if (error) throw error;
}

/** One-tap fallback when a post hasn't synced yet. */
export async function markPosted(id, posted) {
  if (isDemo()) { _demoWrites.set('cp' + id, { ...(_demoWrites.get('cp' + id) || {}), status: posted ? 'posted' : 'ready', posted_via: posted ? 'manual' : null }); return; }
  const { error } = await sb.rpc('content_mark_posted', { p_id: id, p_posted: posted });
  if (error) throw error;
}

/** Broken things only: stale/empty feeds + tasks whose latest run in 24h failed or was partial. */
export async function systemBroken() {
  const fresh = await dataFreshness();
  let runs;
  if (isDemo()) { await snap(); runs = (_full?.runs || []).map(([task, ran_at, status, note]) => ({ task, ran_at, status, note })); }
  else {
    const since = new Date(Date.now() - 864e5).toISOString();
    const { data, error } = await sb.from('task_run_log').select('task,ran_at,status,note').gte('ran_at', since).order('ran_at', { ascending: false }).limit(1000);
    if (error) throw error;
    runs = data || [];
  }
  const day = runs.filter(r => Date.now() - new Date(r.ran_at).getTime() < 864e5);
  const latest = new Map();
  for (const r of day) if (!latest.has(r.task)) latest.set(r.task, r);
  const tasks = [...latest.values()].filter(r => r.status === 'failed' || r.status === 'partial');
  const feeds = fresh.filter(f => f.status !== 'fresh');
  return { feeds, tasks, feedsTotal: fresh.length, tasksTotal: latest.size };
}
