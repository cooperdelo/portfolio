// =====================================================================
// /api/investments-sync.mjs
// Pulls live quotes for every row in investment_positions and UPSERTs
// current_price + price_updated_at. Called by /admin/finance/investments
// on page load (with a 5-min client-side cache to avoid hammering APIs).
//
// Data sources:
//   - Stocks/ETFs: Yahoo Finance v8/chart endpoint (no key, needs UA)
//   - Crypto:      Coinbase public spot price (no key, no signup)
//
// Auth model: admin JWT in Authorization header, same as plugverse-kpi.
// =====================================================================

const ADMIN_URL  = 'https://eibtnkaoqsgwiqttiwjo.supabase.co';
const ADMIN_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpYnRua2FvcXNnd2lxdHRpd2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMTI4MTYsImV4cCI6MjA2NzU4ODgxNn0.8gBRu_k_4YPVOq8rf8dfuyXKbCSgqZ4UQeoIXUIlgxo';
// Yahoo blocks bare/curl UAs — a normal browser UA passes.
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function verifyAdminJwt(jwt) {
  if (!jwt) return { ok: false, status: 401, error: 'missing token' };
  const r = await fetch(`${ADMIN_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: ADMIN_ANON },
  });
  if (!r.ok) return { ok: false, status: 401, error: 'invalid token' };
  const u = await r.json();
  // Investments are personal — require admin_role = 'full' (not 'plugverse').
  const a = await fetch(`${ADMIN_URL}/rest/v1/admin_allowlist?select=admin_role&email=eq.${encodeURIComponent(u.email || '')}`,
    { headers: { Authorization: `Bearer ${jwt}`, apikey: ADMIN_ANON } });
  if (!a.ok) return { ok: false, status: 403, error: 'forbidden' };
  const rows = await a.json();
  if (!rows.length || rows[0].admin_role !== 'full') return { ok: false, status: 403, error: 'forbidden' };
  return { ok: true };
}

async function safe(label, fn) {
  try { return { ok: true, label, value: await fn() }; }
  catch (e) { return { ok: false, label, error: e?.message || String(e) }; }
}

// ---------- Source: Yahoo ----------

async function fetchYahooPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const r = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`yahoo ${symbol} → ${r.status}`);
  const j = await r.json();
  const meta = j?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== 'number') throw new Error(`yahoo ${symbol} → no price in response`);
  return price;
}

// ---------- Source: Coinbase (public spot price) ----------

// Coinbase ticker mapping for cases where the standard ticker differs.
// Most coins use the same ticker (BTC, ETH, BCH, INJ, SEI, IMX).
// FET (Fetch.ai) — Coinbase still lists as FET despite the ASI Alliance merge.
const COINBASE_TICKER_OVERRIDES = {
  // symbol-from-DB : coinbase-ticker
};

async function fetchCoinbasePrice(symbol) {
  const ticker = (COINBASE_TICKER_OVERRIDES[symbol] || symbol).toUpperCase();
  const url = `https://api.coinbase.com/v2/prices/${encodeURIComponent(ticker)}-USD/spot`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`coinbase ${ticker} → ${r.status}`);
  const j = await r.json();
  const price = parseFloat(j?.data?.amount);
  if (!Number.isFinite(price)) throw new Error(`coinbase ${ticker} → no price in response`);
  return price;
}

// ---------- Admin DB I/O ----------

async function fetchPositions(jwt) {
  const r = await fetch(
    `${ADMIN_URL}/rest/v1/investment_positions?select=id,symbol,asset_type,coingecko_id&shares=gt.0`,
    { headers: { Authorization: `Bearer ${jwt}`, apikey: ADMIN_ANON } },
  );
  if (!r.ok) throw new Error(`positions read → ${r.status} ${await r.text()}`);
  return r.json();
}

async function updatePrice(jwt, id, price) {
  const r = await fetch(`${ADMIN_URL}/rest/v1/investment_positions?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: ADMIN_ANON,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ current_price: price, price_updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`update ${id} → ${r.status} ${await r.text()}`);
}

// ---------- Handler ----------

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const auth = await verifyAdminJwt(jwt);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  let positions;
  try { positions = await fetchPositions(jwt); }
  catch (e) { return res.status(500).json({ error: e.message }); }

  const stocks  = positions.filter(p => p.asset_type === 'stock');
  const cryptos = positions.filter(p => p.asset_type === 'crypto');

  // Stocks: one call per unique symbol, in parallel
  const stockSymbols = [...new Set(stocks.map(s => s.symbol))];
  const stockResults = await Promise.all(
    stockSymbols.map(sym => safe(`yahoo:${sym}`, () => fetchYahooPrice(sym))),
  );
  const stockPrices = {};
  for (const r of stockResults) {
    if (r.ok) stockPrices[r.label.slice('yahoo:'.length)] = r.value;
  }

  // Crypto: one call per unique symbol, in parallel (Coinbase has no batch endpoint)
  const cryptoSymbols = [...new Set(cryptos.map(c => c.symbol))];
  const cryptoResults = await Promise.all(
    cryptoSymbols.map(sym => safe(`coinbase:${sym}`, () => fetchCoinbasePrice(sym))),
  );
  const cryptoPrices = {};
  for (const r of cryptoResults) {
    if (r.ok) cryptoPrices[r.label.slice('coinbase:'.length)] = r.value;
  }

  // Write back
  const errors = [];
  const updated = [];
  await Promise.all(positions.map(async p => {
    const price = p.asset_type === 'stock' ? stockPrices[p.symbol] : cryptoPrices[p.symbol];
    if (typeof price !== 'number') return;
    try {
      await updatePrice(jwt, p.id, price);
      updated.push({ id: p.id, symbol: p.symbol, price });
    } catch (e) {
      errors.push({ id: p.id, symbol: p.symbol, error: e.message });
    }
  }));

  for (const r of stockResults)  if (!r.ok) errors.push({ source: r.label, error: r.error });
  for (const r of cryptoResults) if (!r.ok) errors.push({ source: r.label, error: r.error });

  return res.status(200).json({
    captured_at: new Date().toISOString(),
    updated_count: updated.length,
    updated,
    errors: errors.length ? errors : undefined,
  });
}
