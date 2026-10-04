// Shared band reviewer behind a signed link (no login). Cooper sends each bandmate their own link from
// scripts/band-links.mjs or /admin/assets. Everyone edits one shared set of marks per clip: keep / favorite /
// delete, a note, a trim range and routing tags. Each link is limited to a pile of gigs. Originals stay on
// Cooper's SSD and in Google Drive; this only serves small previews (Drive first, Supabase as the fallback).
//
// GET  /api/band-share?gigs=1                    (owner) gigs with video/photo counts, for the mint form
// GET  /api/band-share?mint=<name>&gig=<label>…  (owner) make a bandmate link limited to those gigs (none = all)
// GET  /api/band-share?k=<link>                  the pile's clips, preview URLs, shared marks
// POST /api/band-share {k, asset, revision, verdict, note, start, end, band, broll, shot, subject}   save, optimistic on revision
import { createHmac, timingSafeEqual } from 'node:crypto';
import { authorize } from './_lib/admin-auth.mjs';

const BASE = 'https://eibtnkaoqsgwiqttiwjo.supabase.co';
export const BAND = '00000000-0000-4000-8000-0000000b0a4d'; // the shared reviewer id for every bandmate link
const VERDICTS = { keep: 'keep', favorite: 'favorite', delete: 'reject', unreviewed: 'unreviewed' };
const OUT = { keep: 'keep', favorite: 'favorite', reject: 'delete', unreviewed: 'unreviewed' };
const TAG = /^[a-z]{2,16}$/;
let driveKey = { v: null, t: 0 };
export const resetDriveKey = () => { driveKey = { v: null, t: 0 }; };

const secret = (env = process.env) => (env.SUPABASE_ADMIN_SERVICE_ROLE_KEY ? createHmac('sha256', env.SUPABASE_ADMIN_SERVICE_ROLE_KEY).update('band-share-v1').digest() : null);
export function makeLink(name, days = 120, env = process.env, gigs = null) {
  const p = { n: String(name).slice(0, 40), e: Math.floor(Date.now() / 1000) + days * 86400 };
  if (Array.isArray(gigs) && gigs.length) p.g = gigs.map(String);
  const body = Buffer.from(JSON.stringify(p)).toString('base64url');
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

const mark = (r, by) => ({ asset: r.asset_id, revision: r.revision, verdict: OUT[r.verdict] || 'unreviewed', note: r.note, start: r.trim_start, end: r.trim_end, band: !!r.use_band, broll: !!r.use_broll, shot: r.shot ?? null, subject: r.subject ?? null, by: r.updated_by || by || null, at: r.updated_at });
const list = (v) => [].concat(v ?? []).map((x) => String(x).trim()).filter(Boolean);
const photo = (a) => /^image\//.test(a.mime_type || '');
const noCol = (e) => /column|42703/.test(e.body || ''); // the v2 columns do not exist until the migration is applied

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Robots-Tag', 'noindex');
  const key = process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
  const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const get = async (path) => {
    const r = await fetch(`${BASE}/rest/v1/${path}`, { headers: H, signal: AbortSignal.timeout(12000) });
    if (!r.ok) { const e = new Error('read'); e.body = await r.text().catch(() => ''); throw e; }
    return r.json();
  };
  const assetsQ = async (cols, oldCols, filter = 'retired_at=is.null') => {
    try { return await get(`band_media_assets?select=${cols}&${filter}&order=gig,name`); } catch (e) { if (!noCol(e)) throw e; return get(`band_media_assets?select=${oldCols}&${filter}&order=gig,name`); }
  };
  if (req.method === 'GET' && (req.query?.mint || req.query?.gigs)) { // Cooper makes a link for a bandmate from /admin/assets
    const auth = await authorize(req, ['full']);
    if (!auth.ok) return res.status(auth.status || 401).json({ error: 'Owner only' });
    try {
      const rows = await assetsQ('gig,mime_type', 'gig');
      const by = new Map();
      for (const a of rows) { const g = by.get(a.gig) || { gig: a.gig, videos: 0, photos: 0 }; if (photo(a)) g.photos++; else g.videos++; by.set(a.gig, g); }
      if (req.query.gigs) return res.status(200).json({ gigs: [...by.values()] });
      const name = String(req.query.mint).trim().slice(0, 40);
      if (!name) return res.status(400).json({ error: 'Add a name' });
      const gigs = [...new Set(list(req.query.gig))];
      if (gigs.length > 20 || gigs.some((g) => !by.has(g))) return res.status(400).json({ error: 'Pick up to 20 gigs from the list.' });
      const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'www.cooperdelo.com';
      return res.status(200).json({ url: `https://${host}/band?k=${makeLink(name, 120, process.env, gigs)}`, name, days: 120, gigs: gigs.length ? gigs : [...by.keys()] });
    } catch { return res.status(503).json({ error: 'Could not read the gigs.' }); }
  }
  const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) : {};
  const who = readLink(req.method === 'GET' ? req.query?.k : body.k);
  if (!who) return res.status(401).json({ error: 'This link has expired or is not valid. Ask Cooper for a new one.' });
  const pile = Array.isArray(who.g) && who.g.length ? who.g : null; // always from the signed link, never the client
  try {
    if (req.method === 'GET') {
      const [all, reviews] = await Promise.all([
        assetsQ('id,name,gig,duration,mime_type,proxy_path,preview_drive_id,poster_drive_id', 'id,name,gig,duration,proxy_path'),
        get(`band_media_reviews?select=*&reviewer=eq.${BAND}`)]);
      const assets = pile ? all.filter((a) => pile.includes(a.gig)) : all;
      const ids = new Set(assets.map((a) => a.id));
      if (assets.some((a) => a.preview_drive_id || a.poster_drive_id) && Date.now() - driveKey.t > 300000) {
        let v = null;
        try { v = (await get('automation_secrets?select=value&key=eq.google_drive_api_key'))[0]?.value || null; } catch {}
        driveKey = { v, t: Date.now() };
      }
      const drive = (id) => (id && driveKey.v ? `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${driveKey.v}` : null);
      // Supabase fallback: each preview has a still next to it (<drive id>/poster.jpg) so phones show a real frame in the list.
      const poster = (p) => p.replace(/[^/]+$/, 'poster.jpg');
      const paths = assets.filter((a) => a.proxy_path).flatMap((a) => [...(drive(a.preview_drive_id) ? [] : [a.proxy_path]), ...(photo(a) || drive(a.poster_drive_id) ? [] : [poster(a.proxy_path)])]);
      const urls = {};
      if (paths.length) {
        const r = await fetch(`${BASE}/storage/v1/object/sign/band-review`, { method: 'POST', headers: H, body: JSON.stringify({ expiresIn: 3600, paths }), signal: AbortSignal.timeout(12000) });
        if (r.ok) for (const s of await r.json()) if (s.signedURL) urls[s.path] = `${BASE}/storage/v1${s.signedURL}`;
      }
      return res.status(200).json({
        you: who.n,
        gigs: pile || [...new Set(all.map((a) => a.gig))],
        clips: assets.map((a) => ({ id: a.id, name: a.name, gig: a.gig, kind: photo(a) ? 'photo' : 'video', duration: a.duration, url: drive(a.preview_drive_id) || urls[a.proxy_path] || null, poster: photo(a) ? null : drive(a.poster_drive_id) || (a.proxy_path && urls[poster(a.proxy_path)]) || null })),
        marks: reviews.filter((r) => ids.has(r.asset_id)).map((r) => mark(r)),
      });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    const { asset, revision, verdict, note = '', start = null, end = null, band = false, broll = false, shot = null, subject = null } = body;
    if (typeof asset !== 'string' || !/^[0-9a-f-]{36}$/i.test(asset) || !Number.isInteger(revision) || revision < 0 || !VERDICTS[verdict]
      || typeof note !== 'string' || note.length > 4000 || typeof band !== 'boolean' || typeof broll !== 'boolean'
      || [shot, subject].some((t) => t !== null && (typeof t !== 'string' || !TAG.test(t)))) return res.status(400).json({ error: 'Something in that save looks off.' });
    for (const n of [start, end]) if (n !== null && (typeof n !== 'number' || !Number.isFinite(n) || n < 0)) return res.status(400).json({ error: 'Bad trim time.' });
    if ((start === null) !== (end === null) || (start !== null && end <= start)) return res.status(400).json({ error: 'The trim end has to come after the start.' });
    const a = (await assetsQ('gig,mime_type', 'gig', `id=eq.${asset}`))[0];
    if (!a) return res.status(404).json({ error: 'That clip is not there anymore.' });
    if (pile && !pile.includes(a.gig)) return res.status(403).json({ error: 'That clip is not in your link.' });
    if (photo(a) && start !== null) return res.status(400).json({ error: 'Photos cannot be trimmed.' });
    const row = { verdict: VERDICTS[verdict], note, trim_start: start, trim_end: end, revision: revision + 1, updated_at: new Date().toISOString(), updated_by: who.n, use_band: band, use_broll: broll, shot, subject };
    const send = async (r) => {
      if (revision === 0) return fetch(`${BASE}/rest/v1/band_media_reviews`, { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify({ ...r, asset_id: asset, reviewer: BAND }) });
      return fetch(`${BASE}/rest/v1/band_media_reviews?asset_id=eq.${asset}&reviewer=eq.${BAND}&revision=eq.${revision}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(r) });
    };
    let r = await send(row), cur = row, notice;
    for (let i = 0; i < 2 && r.status === 400; i++) { // columns the migration has not added yet: save the rest
      const m = (await r.clone().json().catch(() => ({}))).message || '';
      if (/use_band|use_broll|shot|subject/.test(m) && 'use_band' in cur) { const { use_band, use_broll, shot: s1, subject: s2, ...rest } = cur; cur = rest; notice = 'Tags turn on once Cooper finishes setup.'; }
      else if (/updated_by/.test(m) && 'updated_by' in cur) { const { updated_by, ...rest } = cur; cur = rest; }
      else break;
      r = await send(cur);
    }
    if (r.status === 409) return res.status(409).json({ error: 'Someone else just changed this clip. Reloading their version.', code: 'CHANGED' });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      if (/verdict_check/.test(e.message || '')) return res.status(400).json({ error: '"Keep" switches on once Cooper finishes setting this up. Favorite and Delete work now.' });
      return res.status(400).json({ error: 'That did not save. Try again.' });
    }
    const saved = await r.json();
    if (!saved.length) return res.status(409).json({ error: 'Someone else just changed this clip. Reloading their version.', code: 'CHANGED' });
    return res.status(200).json({ mark: mark(saved[0], who.n), ...(notice ? { notice } : {}) });
  } catch { return res.status(503).json({ error: 'Could not reach the reviewer. Your change was not saved.' }); }
}
