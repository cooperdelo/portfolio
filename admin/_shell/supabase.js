// =====================================================================
// /admin/_shell/supabase.js
// Shared Supabase client + auth helpers for all /admin/* pages.
// Two roles, controlled at the DB layer via admin_allowlist.admin_role:
//   - 'full'      → Cooper (delocooper6@gmail.com): sees and writes everything
//   - 'plugverse' → Adler (adlerrice@gmail.com) + future cofounders:
//                   sees and writes only rows tied to Plugverse / 1789 fund
// RLS is the source of truth. The role helpers below drive UI gating only.
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = 'https://eibtnkaoqsgwiqttiwjo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpYnRua2FvcXNnd2lxdHRpd2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMTI4MTYsImV4cCI6MjA2NzU4ODgxNn0.8gBRu_k_4YPVOq8rf8dfuyXKbCSgqZ4UQeoIXUIlgxo';

// Kept for any legacy import that grabs ADMIN_EMAIL by name. The real
// allowlist lives in the admin_allowlist table.
export const ADMIN_EMAIL = 'delocooper6@gmail.com';

export const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'cd-admin-auth',
  },
});

// ---------- Session helpers ----------

export async function getSession() {
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

// Cached role lookup — one round-trip per page load, then memoized.
let _roleCache = { email: null, role: null, fetchedAt: 0 };
async function fetchRoleForCurrentSession() {
  const s = await getSession();
  if (!s?.user?.email) {
    _roleCache = { email: null, role: null, fetchedAt: Date.now() };
    return null;
  }
  // The admin_allowlist policy lets a signed-in user read their own row only.
  // If the row isn't found, they're not an admin → role = null.
  const { data, error } = await sb
    .from('admin_allowlist')
    .select('admin_role')
    .eq('email', s.user.email)
    .maybeSingle();
  const role = (!error && data?.admin_role) || null;
  _roleCache = { email: s.user.email, role, fetchedAt: Date.now() };
  return role;
}

/** Returns 'full' | 'plugverse' | null. Memoized per session. */
export async function getAdminRole() {
  const s = await getSession();
  const email = s?.user?.email || null;
  // Bust cache if the session changed (sign out + sign in as a different user)
  if (_roleCache.email !== email) return fetchRoleForCurrentSession();
  if (_roleCache.role != null) return _roleCache.role;
  return fetchRoleForCurrentSession();
}

/** True if the caller is in the allowlist with any role. */
export async function isAdmin() {
  return (await getAdminRole()) != null;
}

/** True only for the 'full' admin (sees everything). */
export async function isFullAdmin() {
  return (await getAdminRole()) === 'full';
}

/** True for 'full' or 'plugverse' — i.e. anyone with Plugverse-finance access. */
export async function isPlugverseAdmin() {
  const r = await getAdminRole();
  return r === 'full' || r === 'plugverse';
}

export async function requireAdminOrRedirect() {
  if (!(await isAdmin())) {
    const back = encodeURIComponent(location.pathname + location.search);
    location.replace(`/admin/login.html?next=${back}`);
    return false;
  }
  return true;
}

/**
 * Gate a page to a specific role. Use on pages that should be hidden from
 * plugverse-scoped admins (Investments, Merch, Social, Food Log, Tax Prep,
 * Export). Plugverse role → bounced to /admin/. Not signed in → login.
 */
export async function requireFullAdminOrRedirect() {
  const role = await getAdminRole();
  if (role == null) {
    const back = encodeURIComponent(location.pathname + location.search);
    location.replace(`/admin/login.html?next=${back}`);
    return false;
  }
  if (role !== 'full') {
    location.replace('/admin/');
    return false;
  }
  return true;
}

export async function signOut() {
  _roleCache = { email: null, role: null, fetchedAt: Date.now() };
  await sb.auth.signOut();
  location.replace('/admin/login.html');
}

/**
 * Send a magic link to the given email. The email is checked against
 * admin_allowlist on the server (RLS-protected); to outside addresses we
 * return ok-masked so the allowlist never leaks.
 */
export async function sendMagicLink(email, redirectTo) {
  const e = (email || '').trim().toLowerCase();
  if (!e || !e.includes('@')) return { ok: false, error: 'invalid email' };

  // Pre-check via an anon RPC-style probe: is this email allowlisted?
  // We can't read the table anonymously (RLS blocks it), but we can check via
  // a public stored function. For simplicity we just try to send the magic
  // link and rely on auth.users + downstream RLS to do the gating. If the
  // email isn't allowlisted, supabase still sends the magic link, but the
  // user won't be able to read any data when they click it.
  const { error } = await sb.auth.signInWithOtp({
    email: e,
    options: { emailRedirectTo: redirectTo || `${location.origin}/admin/` },
  });
  return { ok: !error, error };
}

// ---------- Money/date formatters ----------

export const fmtUSD = (n) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2,
}).format(Number(n || 0));

export const fmtUSDCompact = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1000) return '$' + (v / 1000).toFixed(1) + 'k';
  return fmtUSD(v);
};

export const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', {
  year: 'numeric', month: 'short', day: 'numeric',
});

export const fmtMonth = (d) => new Date(d).toLocaleDateString('en-US', {
  year: 'numeric', month: 'short',
});

// ---------- Realtime subscription helper ----------

export function subscribeTransactions(handler, debounceMs = 350) {
  let timer = null;
  let lastPayload = null;
  const debounced = (payload) => {
    lastPayload = payload;
    clearTimeout(timer);
    timer = setTimeout(() => handler(lastPayload), debounceMs);
  };
  const channel = sb
    .channel('finance-tx')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'financial_transactions' },
      debounced)
    .subscribe();
  return () => { clearTimeout(timer); sb.removeChannel(channel); };
}

// Generic debounced subscription helper for any table
export function subscribeTable(table, handler, debounceMs = 350) {
  let timer = null;
  let lastPayload = null;
  const debounced = (payload) => {
    lastPayload = payload;
    clearTimeout(timer);
    timer = setTimeout(() => handler(lastPayload), debounceMs);
  };
  const channel = sb
    .channel(`tbl-${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, debounced)
    .subscribe();
  return () => { clearTimeout(timer); sb.removeChannel(channel); };
}
