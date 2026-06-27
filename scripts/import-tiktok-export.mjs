// =====================================================================
// scripts/import-tiktok-export.mjs
// Repeatable importer for TikTok's official "Download your data" export.
//
// Get it: TikTok app -> Profile -> Settings and privacy -> Account ->
// Download your data -> request (JSON format preferred). You receive a ZIP;
// unzip it and point this script at the user_data*.json (or the .txt).
//
// It upserts your posted videos + captions into social_posts
// (platform='tiktok'), idempotently — safe to re-run after each export.
// No live metrics (that needs the Display API); this is the captions+dates
// corpus for training the agents, shown under the TikTok tab in /admin/social.
//
// Usage (PowerShell, from repo root):
//   $env:SUPABASE_ADMIN_SERVICE_ROLE_KEY="<service_role_key>"
//   node scripts/import-tiktok-export.mjs "C:\path\to\user_data.json" [handle]
//   node scripts/import-tiktok-export.mjs "C:\path\to\export-folder"   [handle]
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';

const ADMIN_URL = 'https://eibtnkaoqsgwiqttiwjo.supabase.co';
const SVC = process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
if (!SVC) { console.error('ERROR: set SUPABASE_ADMIN_SERVICE_ROLE_KEY in your env first.'); process.exit(1); }

const inputArg = process.argv[2];
const handleArg = process.argv[3] || null;
if (!inputArg) {
  console.error('Usage: node scripts/import-tiktok-export.mjs <user_data.json | folder> [handle]');
  process.exit(1);
}

const VIDEO_URL = /https?:\/\/[^\s"']*tiktok[^\s"']*\/(?:video|share\/video)\/\d+|https?:\/\/[^\s"']*tiktok[^\s"']*\/@[^\s"']+\/video\/\d+/i;

function resolveFile(input) {
  const stat = fs.statSync(input);
  if (stat.isFile()) return input;
  // directory: prefer JSON export, else a .txt
  const files = fs.readdirSync(input);
  const json = files.find(f => /user_data.*\.json$/i.test(f)) || files.find(f => f.toLowerCase().endsWith('.json'));
  if (json) return path.join(input, json);
  const txt = files.find(f => f.toLowerCase().endsWith('.txt'));
  if (txt) return path.join(input, txt);
  throw new Error(`No .json or .txt export found in ${input}`);
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(String(s).includes('T') ? s : String(s).replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function videoId(link) { const m = String(link).match(/video\/(\d+)/); return m ? m[1] : null; }
function hashId(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return 'tt_' + (h >>> 0).toString(36); }
function hashtags(cap) { return (String(cap || '').match(/#[\p{L}\p{N}_]+/gu) || []).map(t => t.toLowerCase()); }

// Recursively collect objects that look like a posted-video record (have a key
// whose value is a TikTok video URL). Resilient to TikTok renaming the path.
function scanJson(node, out) {
  if (Array.isArray(node)) { for (const el of node) scanJson(el, out); return; }
  if (node && typeof node === 'object') {
    const entries = Object.entries(node);
    const linkEntry = entries.find(([, v]) => typeof v === 'string' && VIDEO_URL.test(v));
    if (linkEntry) {
      const get = (re) => { const e = entries.find(([k]) => re.test(k)); return e ? e[1] : ''; };
      out.push({
        link: linkEntry[1],
        date: get(/^date$|time|created/i),
        caption: get(/title|caption|desc|text|content/i),
        likes: get(/like/i),
      });
    }
    for (const [, v] of entries) if (v && typeof v === 'object') scanJson(v, out);
  }
}

// Fallback: scan raw text (TXT export) for Date/Link blocks.
function scanText(text) {
  const out = [];
  const blocks = text.split(/\n\s*\n/);
  for (const b of blocks) {
    const link = (b.match(VIDEO_URL) || [])[0];
    if (!link) continue;
    const date = (b.match(/Date:\s*(.+)/i) || [])[1] || (b.match(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/) || [])[0];
    const caption = (b.match(/(?:Title|Caption|Description):\s*(.+)/i) || [])[1] || '';
    const likes = (b.match(/Likes?:\s*(\d+)/i) || [])[1] || '';
    out.push({ link, date, caption, likes });
  }
  return out;
}

function toPost(r) {
  if (!r.link) return null;
  const id = videoId(r.link) || hashId(`${r.date}|${r.link}`);
  const caption = (r.caption || '').trim() || null;
  return {
    platform: 'tiktok',
    external_id: id,
    account_handle: handleArg,
    caption,
    posted_at: parseDate(r.date),
    media_type: 'VIDEO',
    media_url: r.link,
    thumbnail_url: null,
    permalink: r.link,
    hashtags: hashtags(caption),
    raw: r,
    updated_at: new Date().toISOString(),
  };
}

async function upsertBatch(posts) {
  const seen = new Map();
  for (const p of posts) seen.set(p.external_id, p);
  const payload = [...seen.values()];
  const r = await fetch(`${ADMIN_URL}/rest/v1/social_posts?on_conflict=platform,external_id`, {
    method: 'POST',
    headers: {
      apikey: SVC, Authorization: `Bearer ${SVC}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`upsert failed: ${r.status} ${await r.text()}`);
  return payload.length;
}

async function main() {
  const file = resolveFile(inputArg);
  const text = fs.readFileSync(file, 'utf8');
  let records = [];
  try { const json = JSON.parse(text); scanJson(json, records); }
  catch { records = scanText(text); }

  const posts = records.map(toPost).filter(Boolean);
  console.log(`${path.basename(file)}: ${posts.length} TikTok posts parsed`);
  if (!posts.length) {
    console.log('No posted videos found. If this is the TXT export, check it contains your "Videos" section.');
    return;
  }

  let total = 0;
  for (let i = 0; i < posts.length; i += 200) total += await upsertBatch(posts.slice(i, i + 200));
  console.log(`\nDone. Upserted ${total} TikTok posts into social_posts.`);
  console.log('Open /admin/social/ and click the TikTok tab to see them.');
}

main().catch(e => { console.error(e); process.exit(1); });
