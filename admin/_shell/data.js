// =====================================================================
// /admin/_shell/data.js — shared loaders for the v5 pages.
// Every loader returns rows that already carry their own as-of + source so
// the page can print "platform · handle · as of" next to each number.
// =====================================================================
import { sb } from './supabase.js';
import { toDate } from './ui.js';

// Handles that are Cooper's personal brand (PlugVerse accounts are shown separately).
export const PERSONAL = { linkedin: 'cooperdelo', instagram: 'cooperdelo', tiktok: 'cooperdelo', youtube: 'cooperdelo', x: 'CooperDelo_' };
const PLATFORM_ORDER = ['linkedin', 'instagram', 'tiktok', 'youtube', 'x'];

/** Follower snapshots (window_days = 0) grouped per platform+handle, newest first. */
export async function accountSeries() {
  const { data, error } = await sb.from('social_account_snapshots')
    .select('date,platform,handle,followers,posts_total,total_views,impressions,window_days,source,captured_at,raw')
    .order('date', { ascending: false }).limit(1000);
  if (error) throw error;
  return groupAccounts(data || []);
}

/** Group snapshot rows (any order) into per-account series. Also used by the
 *  localhost-only demo snapshot on the home page. */
export function groupAccounts(data) {
  data = [...data].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const series = {};
  for (const r of data || []) {
    if (r.window_days !== 0 || r.followers == null) continue;
    const k = `${r.platform}|${r.handle}`;
    (series[k] = series[k] || { platform: r.platform, handle: r.handle, rows: [] }).rows.push(r);
  }
  const list = Object.values(series).map(s => {
    s.latest = s.rows[0];
    s.prev = s.rows.find(r => r.date < s.latest.date) || null;
    s.personal = PERSONAL[s.platform] && PERSONAL[s.platform].toLowerCase() === String(s.handle).toLowerCase();
    return s;
  });
  list.sort((a, b) => (b.personal - a.personal) || (PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform)) || (b.latest.followers - a.latest.followers));
  const windows = (data || []).filter(r => r.window_days > 0 && r.impressions != null);
  return { list, windows };
}

/** Posts with their newest metric snapshot attached (reach = impressions or views). */
export async function postsWithMetrics() {
  const [{ data: posts, error: e1 }, { data: snaps, error: e2 }] = await Promise.all([
    sb.from('social_posts').select('id,platform,account_handle,caption,posted_at,media_type,media_url,thumbnail_url,permalink,external_id').limit(2000),
    sb.from('social_post_snapshots').select('post_id,as_of,views,reach,impressions,likes,comments,shares,saves,reposts,source').order('as_of', { ascending: false }).limit(5000),
  ]);
  if (e1) throw e1; if (e2) throw e2;
  const latest = {};
  for (const s of snaps || []) if (!latest[s.post_id]) latest[s.post_id] = s;
  return (posts || []).map(p => {
    const m = latest[p.id] || null;
    // LinkedIn: impressions only (a reaction or view count is never shown as impressions).
    const reach = m ? (p.platform === 'linkedin' ? (m.impressions ?? null) : (m.impressions ?? m.views ?? m.reach ?? null)) : null;
    return {
      ...p, m, reach, as_of: m?.as_of || null,
      reachLabel: p.platform === 'linkedin' ? 'impressions' : 'views',
      thumb: p.thumbnail_url || (p.media_type && /image|carousel/i.test(p.media_type) ? p.media_url : null),
    };
  });
}

export function byPostedDesc(a, b) { return (toDate(b.posted_at) || 0) - (toDate(a.posted_at) || 0); }
