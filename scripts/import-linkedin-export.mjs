// =====================================================================
// scripts/import-linkedin-export.mjs
// One-shot / repeatable importer for LinkedIn's official data export.
//
// LinkedIn gives no usable API for reading your own post history, so the
// reliable path is: Settings -> Data Privacy -> "Get a copy of your data"
// -> include "Posts" / "Shares". You receive a ZIP; unzip it and point this
// script at the Shares.csv (and/or Posts.csv) inside.
//
// It upserts every post + caption into social_posts (platform='linkedin'),
// idempotently — safe to re-run after each fresh export.
//
// Usage (PowerShell, from repo root):
//   $env:SUPABASE_ADMIN_SERVICE_ROLE_KEY="<service_role_key>"
//   node scripts/import-linkedin-export.mjs "C:\path\to\Shares.csv"
//   node scripts/import-linkedin-export.mjs "C:\path\to\export-folder"   # scans for Shares.csv/Posts.csv
//
// Optional 2nd arg sets the handle stored on each row:
//   node scripts/import-linkedin-export.mjs "Shares.csv" cooper-delo
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';

const ADMIN_URL = 'https://eibtnkaoqsgwiqttiwjo.supabase.co';
const SVC = process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;

if (!SVC) {
  console.error('ERROR: set SUPABASE_ADMIN_SERVICE_ROLE_KEY in your env first.');
  process.exit(1);
}

const inputArg = process.argv[2];
const handleArg = process.argv[3] || null;
if (!inputArg) {
  console.error('Usage: node scripts/import-linkedin-export.mjs <Shares.csv | export-folder> [handle]');
  process.exit(1);
}

// ---- Minimal RFC-4180 CSV parser (handles quotes, commas, newlines in fields) ----
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  // strip BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* ignore */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(c => (c || '').trim() !== ''))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

// Pull a value by trying several possible column names (LinkedIn renames over time).
function pick(obj, ...names) {
  for (const n of names) {
    const hit = Object.keys(obj).find(k => k.toLowerCase() === n.toLowerCase());
    if (hit && (obj[hit] || '').trim() !== '') return obj[hit].trim();
  }
  return '';
}

// ---- Resolve input to a list of CSV files ----
function resolveCsvFiles(input) {
  const stat = fs.statSync(input);
  if (stat.isFile()) return [input];
  // directory: look for the usual LinkedIn export filenames (case-insensitive)
  const wanted = ['shares.csv', 'posts.csv'];
  return fs.readdirSync(input)
    .filter(f => wanted.includes(f.toLowerCase()))
    .map(f => path.join(input, f));
}

function parseDate(s) {
  if (!s) return null;
  // LinkedIn dates look like "2024-01-15 13:22:41" (UTC) or ISO. Normalize to ISO.
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function hashId(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
  return 'li_' + (h >>> 0).toString(36);
}

function rowToPost(o) {
  const caption = pick(o, 'ShareCommentary', 'Commentary', 'PostCommentary', 'Text');
  const link    = pick(o, 'ShareLink', 'PostLink', 'Url', 'PermaLink', 'Permalink');
  const shared  = pick(o, 'SharedUrl', 'SharedURL');
  const media   = pick(o, 'MediaUrl', 'MediaURL');
  const dateRaw = pick(o, 'Date', 'CreatedDate', 'Created Date', 'ShareDate');
  if (!caption && !link) return null; // skip empty/junk rows

  const externalId = link || hashId(`${dateRaw}|${caption.slice(0, 80)}`);
  const hashtags = (caption.match(/#[\p{L}\p{N}_]+/gu) || []).map(t => t.toLowerCase());

  return {
    platform: 'linkedin',
    external_id: externalId,
    account_handle: handleArg,
    caption: caption || null,
    posted_at: parseDate(dateRaw),
    media_type: media ? 'MEDIA' : 'TEXT',
    media_url: media || shared || null,
    thumbnail_url: null,
    permalink: link || null,
    hashtags,
    raw: o,
    updated_at: new Date().toISOString(),
  };
}

async function upsertBatch(posts) {
  // Dedupe within the batch on external_id so PostgREST doesn't choke on
  // duplicate keys in one payload.
  const seen = new Map();
  for (const p of posts) seen.set(p.external_id, p);
  const payload = [...seen.values()];

  const r = await fetch(`${ADMIN_URL}/rest/v1/social_posts?on_conflict=platform,external_id`, {
    method: 'POST',
    headers: {
      apikey: SVC,
      Authorization: `Bearer ${SVC}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`upsert failed: ${r.status} ${await r.text()}`);
  return payload.length;
}

async function main() {
  const files = resolveCsvFiles(inputArg);
  if (!files.length) {
    console.error(`No Shares.csv / Posts.csv found at ${inputArg}`);
    process.exit(1);
  }

  let all = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    const objs = toObjects(parseCsv(text));
    const posts = objs.map(rowToPost).filter(Boolean);
    console.log(`  ${path.basename(f)}: ${posts.length} posts parsed`);
    all = all.concat(posts);
  }

  if (!all.length) { console.log('Nothing to import.'); return; }

  // Upsert in chunks of 200.
  let total = 0;
  for (let i = 0; i < all.length; i += 200) {
    total += await upsertBatch(all.slice(i, i + 200));
  }
  console.log(`\nDone. Upserted ${total} LinkedIn posts into social_posts.`);
  console.log('Open /admin/social/ and click the LinkedIn tab to see them.');
}

main().catch(e => { console.error(e); process.exit(1); });
