// =====================================================================
// /admin/_shell/demo-db.js, localhost-only design preview database.
// Loaded by supabase.js ONLY when the page is served over http from
// localhost/127.0.0.1 with ?demo in the URL. It answers sb.from(table)
// queries from the `tables` block of admin/_dev/snapshot.local.json
// (gitignored, never deployed; real rows pulled read-only from Supabase).
// Writes are accepted and dropped. Auth still goes through the real client.
// On every other host this file is never imported.
// =====================================================================
let TABLES = null;
async function tables() {
  if (TABLES) return TABLES;
  try { TABLES = (await (await fetch('/admin/_dev/snapshot.local.json', { cache: 'no-store' })).json())?.tables || {}; }
  catch { TABLES = {}; }
  return TABLES;
}
const likeRe = (p) => new RegExp('^' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
const cmp = (a, b) => (a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : a < b ? -1 : a > b ? 1 : 0);

function builder(table) {
  const where = [], order = [];
  let lim = null, rng = null, single = null, write = false, head = false;
  const b = {
    select(_cols, opts) { if (opts?.head) head = true; return b; },
    insert() { write = true; return b; }, update() { write = true; return b; }, upsert() { write = true; return b; }, delete() { write = true; return b; },
    eq(c, v) { where.push(r => String(r[c]) === String(v)); return b; },
    neq(c, v) { where.push(r => String(r[c]) !== String(v)); return b; },
    gt(c, v) { where.push(r => r[c] != null && r[c] > v); return b; },
    gte(c, v) { where.push(r => r[c] != null && r[c] >= v); return b; },
    lt(c, v) { where.push(r => r[c] != null && r[c] < v); return b; },
    lte(c, v) { where.push(r => r[c] != null && r[c] <= v); return b; },
    in(c, a) { const s = (a || []).map(String); where.push(r => s.includes(String(r[c]))); return b; },
    is(c, v) { where.push(r => (v === null ? r[c] == null : r[c] === v)); return b; },
    not(c, op, v) {
      if (op === 'is') where.push(r => (v === null ? r[c] != null : r[c] !== v));
      else if (op === 'eq') where.push(r => String(r[c]) !== String(v));
      else if (op === 'in') { const s = String(v).replace(/[()]/g, '').split(',').map(x => x.trim().replace(/^"|"$/g, '')); where.push(r => !s.includes(String(r[c]))); }
      return b;
    },
    ilike(c, p) { const re = likeRe(p); where.push(r => re.test(String(r[c] ?? ''))); return b; },
    like(c, p) { return b.ilike(c, p); },
    match(o) { for (const k in o) b.eq(k, o[k]); return b; },
    or() { return b; }, filter() { return b; }, contains() { return b; }, textSearch() { return b; }, overlaps() { return b; },
    order(c, o = {}) { order.push([c, o.ascending !== false]); return b; },
    limit(n) { lim = n; return b; }, range(a, z) { rng = [a, z]; return b; },
    maybeSingle() { single = 'maybe'; return b; }, single() { single = 'one'; return b; },
    returns() { return b; }, abortSignal() { return b; }, csv() { return b; }, throwOnError() { return b; },
    then(res, rej) { return run().then(res, rej); },
  };
  async function run() {
    if (write) return { data: null, error: null };
    let rows = ((await tables())[table] || []).filter(r => where.every(f => f(r)));
    if (order.length) rows = [...rows].sort((x, y) => { for (const [c, asc] of order) { const d = cmp(x[c], y[c]); if (d) return asc ? d : -d; } return 0; });
    const count = rows.length;
    if (rng) rows = rows.slice(rng[0], rng[1] + 1);
    if (lim != null) rows = rows.slice(0, lim);
    if (single === 'maybe') return { data: rows[0] ?? null, error: null };
    if (single === 'one') return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: 'No row in the demo snapshot' } };
    return { data: head ? null : rows, error: null, count };
  }
  return b;
}

export function demoClient(real) {
  const bucket = () => ({
    createSignedUrl: async () => ({ data: null, error: null }), createSignedUrls: async () => ({ data: [], error: null }),
    upload: async () => ({ data: null, error: null }), remove: async () => ({ data: null, error: null }), list: async () => ({ data: [], error: null }),
    getPublicUrl: () => ({ data: { publicUrl: '' } }),
  });
  return new Proxy(real, {
    get(t, p) {
      if (p === 'from') return builder;
      if (p === 'rpc') return async (fn) => ({ data: (await tables())['rpc:' + fn] ?? null, error: null });
      if (p === 'storage') return { from: bucket };
      if (p === 'channel') return () => { const ch = { on: () => ch, subscribe: () => ch, unsubscribe: () => {} }; return ch; };
      if (p === 'removeChannel') return () => {};
      const v = t[p];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
}
