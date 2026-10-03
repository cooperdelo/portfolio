// Shared band reviewer behind a signed link (no login). Cooper sends each bandmate their own link from
// scripts/band-links.mjs. Everyone edits one shared set of marks per clip: keep / favorite / delete, a note,
// and a trim range. Originals stay in Google Drive and on G:; this only serves small private previews.
//
// GET  /api/band-share?mint=<name>              (owner, signed in) make a bandmate link
// GET  /api/band-share?k=<link>                  clips, signed preview URLs (1 hour), shared marks
// POST /api/band-share {k, asset, revision, verdict, note, start, end}   save, optimistic on revision
import { createHmac, timingSafeEqual } from 'node:crypto';
import { authorize } from './_lib/admin-auth.mjs';

const BASE = 'https://eibtnkaoqsgwiqttiwjo.supabase.co';
export const BAND = '00000000-0000-4000-8000-0000000b0a4d'; // the shared reviewer id for every bandmate link
const VERDICTS = { keep: 'keep', favorite: 'favorite', delete: 'reject', unreviewed: 'unreviewed' };
const OUT = { keep: 'keep', favorite: 'favorite', reject: 'delete', unreviewed: 'unreviewed' };

const secret = (env = process.env) => (env.SUPABASE_ADMIN_SERVICE_ROLE_KEY ? createHmac('sha256', env.SUPABASE_ADMIN_SERVICE_ROLE_KEY).update('band-share-v1').digest() : null);
export function makeLink(name, days = 120, env = process.env) {
  const body = Buffer.from(JSON.stringify({ n: String(name).slice(0, 40), e: Math.floor(Date.now() / 1000) + days * 86400 })).toString('base64url');
  return `${body}.${createHmac('sha256', secret(env)).update(body).digest('base64url')}`;
}
export function readLink(k, env = process.env) {
  const s = secret(env);
  if (!s || typeof k !== 'string' || !/^[\w-]+\.[\w-]+$/.test(k)) return null;
  const [body, mac] = k.split('.');
  const want = Buffer.from(createHmac('sha256', s).update(body).digest('base64url'));
  const got = Buffer.from(mac);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.e > Date.now() / 1000 ? p : null; } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Robots-Tag', 'noindex');
  const key = process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
  const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (req.method === 'GET' && req.query?.mint) { // Cooper makes a link for a bandmate from /admin/assets
    const auth = await authorize(req, ['full']);
    if (!auth.ok) return res.status(auth.status || 401).json({ error: 'Owner only' });
    const name = String(req.query.mint).trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: 'Add a name' });
    const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'www.cooperdelo.com';
    return res.status(200).json({ url: `https://${host}/band?k=${makeLink(name)}`, name, days: 120 });
  }
  const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) : {};
  const who = readLink(req.method === 'GET' ? req.query?.k : body.k);
  if (!who) return res.status(401).json({ error: 'This link has expired or is not valid. Ask Cooper for a new one.' });
  const get = async (path) => { const r = await fetch(`${BASE}/rest/v1/${path}`, { headers: H, signal: AbortSignal.timeout(12000) }); if (!r.ok) throw new Error('read'); return r.json(); };
  try {
    if (req.method === 'GET') {
      const [assets, reviews] = await Promise.all([
        get('band_media_assets?select=id,name,gig,duration,proxy_path&retired_at=is.null&order=gig,name'),
        get(`band_media_reviews?select=*&reviewer=eq.${BAND}`)]);
      // Each preview has a still next to it (<drive id>/poster.jpg) so phones show a real frame in the list.
      const poster = (p) => p.replace(/[^/]+$/, 'poster.jpg');
      const paths = assets.filter((a) => a.proxy_path).flatMap((a) => [a.proxy_path, poster(a.proxy_path)]);
      const urls = {};
      if (paths.length) {
        const r = await fetch(`${BASE}/storage/v1/object/sign/band-review`, { method: 'POST', headers: H, body: JSON.stringify({ expiresIn: 3600, paths }), signal: AbortSignal.timeout(12000) });
        if (r.ok) for (const s of await r.json()) if (s.signedURL) urls[s.path] = `${BASE}/storage/v1${s.signedURL}`;
      }
      return res.status(200).json({
        you: who.n,
        clips: assets.map((a) => ({ id: a.id, name: a.name, gig: a.gig, duration: a.duration, url: urls[a.proxy_path] || null, poster: (a.proxy_path && urls[poster(a.proxy_path)]) || null })),
        marks: reviews.map((r) => ({ asset: r.asset_id, revision: r.revision, verdict: OUT[r.verdict] || 'unreviewed', note: r.note, start: r.trim_start, end: r.trim_end, by: r.updated_by || null, at: r.updated_at })),
      });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    const { asset, revision, verdict, note = '', start = null, end = null } = body;
    if (typeof asset !== 'string' || !/^[0-9a-f-]{36}$/i.test(asset) || !Number.isInteger(revision) || revision < 0 || !VERDICTS[verdict]
      || typeof note !== 'string' || note.length > 4000) return res.status(400).json({ error: 'Something in that save looks off.' });
    for (const n of [start, end]) if (n !== null && (typeof n !== 'number' || !Number.isFinite(n) || n < 0)) return res.status(400).json({ error: 'Bad trim time.' });
    if ((start === null) !== (end === null) || (start !== null && end <= start)) return res.status(400).json({ error: 'The trim end has to come after the start.' });
    const row = { verdict: VERDICTS[verdict], note, trim_start: start, trim_end: end, revision: revision + 1, updated_at: new Date().toISOString(), updated_by: who.n };
    const send = async (r) => {
      if (revision === 0) return fetch(`${BASE}/rest/v1/band_media_reviews`, { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify({ ...r, asset_id: asset, reviewer: BAND }) });
      return fetch(`${BASE}/rest/v1/band_media_reviews?asset_id=eq.${asset}&reviewer=eq.${BAND}&revision=eq.${revision}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(r) });
    };
    let r = await send(row);
    if (r.status === 400) { const e = await r.clone().json().catch(() => ({})); if (/updated_by/.test(e.message || '')) { const { updated_by, ...rest } = row; r = await send(rest); } }
    if (r.status === 409) return res.status(409).json({ error: 'Someone else just changed this clip. Reloading their version.', code: 'CHANGED' });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      if (/verdict_check/.test(e.message || '')) return res.status(400).json({ error: '"Keep" switches on once Cooper finishes setting this up. Favorite and Delete work now.' });
      return res.status(400).json({ error: 'That did not save. Try again.' });
    }
    const saved = await r.json();
    if (!saved.length) return res.status(409).json({ error: 'Someone else just changed this clip. Reloading their version.', code: 'CHANGED' });
    const s = saved[0];
    return res.status(200).json({ mark: { asset: s.asset_id, revision: s.revision, verdict: OUT[s.verdict], note: s.note, start: s.trim_start, end: s.trim_end, by: s.updated_by || who.n, at: s.updated_at } });
  } catch { return res.status(503).json({ error: 'Could not reach the reviewer. Your change was not saved.' }); }
}
