// =====================================================================
// /admin/_shell/live-data.js — zero-manual-input data module (2026-09-28, admin-data-audit).
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
let _snap;
async function snap() {
  if (_snap !== undefined) return _snap;
  try { _snap = (await (await fetch('/admin/_dev/snapshot.local.json', { cache: 'no-store' })).json())?.live || null; }
  catch { _snap = null; }
  return _snap;
}

/** Personal brand + PlugVerse accounts that belong in the "All posts" feed. */
export const FEED_ACCOUNTS = {
  linkedin: ['cooperdelo', 'plugverseapp'],
  instagram: ['cooperdelo', 'plugverse.app'],
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
