// =====================================================================
// migrate-broll-to-portfolio.mjs
// One-time: copy b-roll media + thumbnails OUT of the PlugVerse project
// and INTO the portfolio project (eibtnkaoqsgwiqttiwjo), preserving
// bucket+path so only the host changes. Then repoints broll_assets rows.
// Idempotent: skips rows already on portfolio; upserts on upload.
// =====================================================================
import fs from 'node:fs';

const SRC_REF  = 'yhemvsksnoojplnxirlv';
const DEST_REF = 'eibtnkaoqsgwiqttiwjo';
const DEST     = `https://${DEST_REF}.supabase.co`;

// service_role key lives outside the repo
const ENV_PATH = 'C:\\Users\\coope\\Desktop\\Claude\\Projects\\personal-brand\\factory\\.env';
const envRaw = fs.readFileSync(ENV_PATH, 'utf8');
const SVC = (envRaw.match(/service_role\s*=\s*(\S+)/) || [])[1];
if (!SVC) { console.error('No service_role key found in .env'); process.exit(1); }
const H = { apikey: SVC, Authorization: `Bearer ${SVC}` };

const log = (...a) => { const m = `[${new Date().toISOString()}] ${a.join(' ')}`; console.log(m); fs.appendFileSync('F:\\Github\\Portfolio\\scripts\\broll-migrate.log', m + '\n'); };

// Parse a Supabase public object URL -> { bucket, path }
function parsePublic(url) {
  const m = String(url || '').match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

async function ensureBucket(id) {
  const r = await fetch(`${DEST}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name: id, public: true }),
  });
  if (r.ok) { log('created bucket', id); return; }
  const t = await r.text();
  if (/already exists|Duplicate/i.test(t)) { log('bucket exists', id); return; }
  log('WARN bucket', id, r.status, t.slice(0, 120));
}

async function copyOne(srcUrl) {
  const p = parsePublic(srcUrl);
  if (!p) return { ok: false, reason: 'unparseable' };
  // download from PlugVerse public URL
  const dl = await fetch(srcUrl, { signal: AbortSignal.timeout(45000) });
  if (!dl.ok) return { ok: false, reason: `download ${dl.status}` };
  const buf = Buffer.from(await dl.arrayBuffer());
  const ct = dl.headers.get('content-type') || 'application/octet-stream';
  // upload to portfolio, same bucket+path, overwrite if present
  const up = await fetch(`${DEST}/storage/v1/object/${p.bucket}/${p.path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': ct, 'x-upsert': 'true', 'cache-control': 'public, max-age=31536000, immutable' },
    body: buf,
    signal: AbortSignal.timeout(120000),
  });
  if (!up.ok && up.status !== 200) {
    const t = await up.text();
    if (!/already exists/i.test(t)) return { ok: false, reason: `upload ${up.status} ${t.slice(0,80)}` };
  }
  return { ok: true, bucket: p.bucket, bytes: buf.length };
}

async function patchRow(id, fields) {
  const r = await fetch(`${DEST}/rest/v1/broll_assets?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(fields),
  });
  if (!r.ok) log('WARN patch', id, r.status, (await r.text()).slice(0, 100));
  return r.ok;
}

async function main() {
  await ensureBucket('broll');
  await ensureBucket('memtriage');

  // pull all rows
  const res = await fetch(`${DEST}/rest/v1/broll_assets?select=id,media_url,thumb_url,media_host&limit=2000`, { headers: H });
  const rows = await res.json();
  log(`loaded ${rows.length} rows`);

  let mediaCopied = 0, thumbCopied = 0, rowsPatched = 0, skipped = 0, failed = 0;

  for (const row of rows) {
    const fields = {};
    // media
    if (row.media_url && row.media_url.includes(SRC_REF)) {
      let r; for (let a=0;a<3;a++){ try { r = await copyOne(row.media_url); } catch(e){ r={ok:false,reason:e.message}; } if (r.ok) break; }
      if (r.ok) { fields.media_url = row.media_url.replaceAll(SRC_REF, DEST_REF); mediaCopied++; }
      else { failed++; log('media FAIL', row.id, r.reason); }
    }
    // thumb
    if (row.thumb_url && row.thumb_url.includes(SRC_REF)) {
      let r; for (let a=0;a<3;a++){ try { r = await copyOne(row.thumb_url); } catch(e){ r={ok:false,reason:e.message}; } if (r.ok) break; }
      if (r.ok) { fields.thumb_url = row.thumb_url.replaceAll(SRC_REF, DEST_REF); thumbCopied++; }
      else { failed++; log('thumb FAIL', row.id, r.reason); }
    }
    if (Object.keys(fields).length) {
      if (await patchRow(row.id, fields)) rowsPatched++;
    } else { skipped++; }
    if ((mediaCopied + thumbCopied) % 50 === 0 && (mediaCopied + thumbCopied) > 0) {
      log(`progress: media=${mediaCopied} thumb=${thumbCopied} patched=${rowsPatched} failed=${failed}`);
    }
  }
  log(`DONE media=${mediaCopied} thumb=${thumbCopied} rowsPatched=${rowsPatched} skipped=${skipped} failed=${failed}`);
}
main().catch(e => { log('FATAL', e.message); process.exit(1); });
