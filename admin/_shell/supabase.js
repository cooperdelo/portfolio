// =====================================================================
// /admin/_shell/supabase.js
// Shared Supabase client + auth helpers for all /admin/* pages.
// Single-user gate: only delocooper6@gmail.com can read/write.
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = 'https://eibtnkaoqsgwiqttiwjo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpYnRua2FvcXNnd2lxdHRpd2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMTI4MTYsImV4cCI6MjA2NzU4ODgxNn0.8gBRu_k_4YPVOq8rf8dfuyXKbCSgqZ4UQeoIXUIlgxo';
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

export async function isAdmin() {
  const s = await getSession();
  return !!s && s.user?.email === ADMIN_EMAIL;
}

export async function requireAdminOrRedirect() {
  if (!(await isAdmin())) {
    const back = encodeURIComponent(location.pathname + location.search);
    location.replace(`/admin/login.html?next=${back}`);
    return false;
  }
  return true;
}

export async function signOut() {
  await sb.auth.signOut();
  location.replace('/admin/login.html');
}

export async function sendMagicLink(email, redirectTo) {
  if (email.trim().toLowerCase() !== ADMIN_EMAIL) {
    // Lie to outsiders — never reveal the allowlist
    return { ok: true, masked: true };
  }
  const { error } = await sb.auth.signInWithOtp({
    email,
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

export function subscribeTransactions(handler) {
  const channel = sb
    .channel('finance-tx')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'financial_transactions' },
      handler)
    .subscribe();
  return () => sb.removeChannel(channel);
}
