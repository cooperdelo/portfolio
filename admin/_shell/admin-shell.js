// =====================================================================
// /admin/_shell/admin-shell.js
// - Enforces auth before rendering admin pages
// - Injects the left rail (sidebar) into every page
// - Highlights active nav item
// - Filters nav rail + tile grid by admin_role (full vs plugverse)
// - Exposes toast(), signOut, and a small DOM helper
// =====================================================================

import { requireAdminOrRedirect, signOut, getSession, getAdminRole } from './supabase.js';

// `roles` declares which admin_role values can see each nav item.
// Default is both. Items not listed in `roles` are visible to everyone signed in.
// Consolidated into 5 life domains (2026-07 redesign). Each domain groups the
// pages that actually get used; deep/rarely-used reports live inside their
// dashboard rather than as top-level rail items. Life pages are read-only and
// auto-synced by the nightly/weekly agent.
const NAV = [
  { section: 'Overview', items: [
    { href: '/admin/',                          label: 'Home' },
  ]},
  { section: 'Money', items: [
    { href: '/admin/finance/',                  label: 'Finance Dashboard' },
    { href: '/admin/finance/networth.html',     label: 'Net Worth', roles: ['full'] },
    { href: '/admin/finance/transactions.html', label: 'Transactions' },
    { href: '/admin/finance/entry.html',        label: 'Quick Add' },
    { href: '/admin/finance/investments.html',  label: 'Investments', roles: ['full'] },
    { href: '/admin/finance/funding.html',      label: 'Funding Sources' },
    { href: '/admin/finance/tax.html',          label: 'Tax Prep', roles: ['full'] },
    { href: '/admin/finance/export.html',       label: 'Export XLSX', roles: ['full'] },
  ]},
  { section: 'Health & Body', items: [
    { href: '/admin/health/log.html',           label: 'Daily Log', roles: ['full'] },
    { href: '/admin/health/dashboard.html',     label: 'Insights', roles: ['full'] },
  ]},
  { section: 'Build · Plugverse', items: [
    { href: '/admin/plugverse/',                label: 'KPIs' },
    { href: '/admin/plugverse/ops.html',        label: 'Ops · pipeline · team · QA' },
    { href: '/admin/finance/plugverse.html',    label: 'P&L' },
    { href: '/admin/finance/fund.html',         label: '1789 Fund' },
  ]},
  { section: 'Life · auto-synced', items: [
    { href: '/admin/life/',                     label: 'Review', roles: ['full'] },
    { href: '/admin/life/relationships.html',   label: 'Relationships', roles: ['full'] },
    { href: '/admin/life/music.html',           label: 'Music', roles: ['full'] },
    { href: '/admin/academics/',                label: 'Academics', roles: ['full'] },
  ]},
  { section: 'Brand', items: [
    { href: '/admin/social/',                   label: 'Content' },
    { href: '/admin/carousels/',                label: 'Carousel Studio', roles: ['full'] },
    { href: '/admin/playbook/',                 label: 'Playbook' },
    { href: '/admin/contacts/',                 label: 'Contacts' },
    { href: '/admin/merch/',                    label: 'Merch Tracker', roles: ['full'] },
  ]},
];

function visibleForRole(item, role) {
  if (!item.roles) return true;
  return item.roles.includes(role);
}

function railHTML(activePath, email, role) {
  const sections = NAV.map(sec => {
    const items = sec.items
      .filter(it => visibleForRole(it, role))
      .map(it => {
        const isActive = normalizePath(it.href) === normalizePath(activePath);
        return `<a class="nav-item ${isActive ? 'active' : ''}" href="${it.href}">
                  <span class="pulse"></span><span>${it.label}</span>
                </a>`;
      }).join('');
    if (!items) return ''; // hide whole section if every item is gated out
    return `<div class="rail-section">
              <div class="eyebrow">${sec.section}</div>
              ${items}
            </div>`;
  }).join('');

  const roleBadge = role === 'plugverse' ? '<small class="role-badge">Plugverse</small>' : '';

  return `
    <aside class="rail">
      <div class="brand"><span class="dot"></span>CD <small>Admin</small>${roleBadge}</div>
      <button class="rail-search" data-openpalette><span class="rs-mag">⌕</span><span>Search…</span><kbd>⌘K</kbd></button>
      <button class="rail-toggle" data-railtoggle aria-label="Menu" aria-expanded="false">&#9776;</button>
      ${sections}
      <div class="rail-foot">
        <span>Signed in as</span>
        <span class="who">${email || ''}</span>
        <button class="signout" data-signout>Sign out</button>
      </div>
    </aside>`;
}

function normalizePath(p) {
  if (!p) return '';
  let n = p.replace(/index\.html$/, '');
  if (!n.endsWith('/') && !n.endsWith('.html')) n += '/';
  return n.toLowerCase();
}

/**
 * Hide tiles on the home page (or any page using the same role-data attrs)
 * that aren't allowed for the current role. Tiles with `data-role="full"`
 * are hidden for plugverse-scoped admins.
 */
function filterTilesByRole(role) {
  document.querySelectorAll('[data-role]').forEach(el => {
    const allowed = String(el.dataset.role || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!allowed.length) return;
    if (!allowed.includes(role)) el.style.display = 'none';
  });
}

// =====================================================================
// Command palette (⌘K / Ctrl+K, or "/") — jump to any page or run a quick
// action from anywhere. The single biggest "get around fast" win.
// =====================================================================
const QUICK_ACTIONS = [
  { label: 'Log a meal', href: '/admin/health/log.html', roles: ['full'], act: true },
  { label: 'Log a bathroom trip', href: '/admin/health/log.html', roles: ['full'], act: true },
  { label: 'Log a previous day', href: '/admin/health/log.html', roles: ['full'], act: true },
  { label: 'Quick add expense / income', href: '/admin/finance/entry.html', act: true },
  { label: 'Add a contact', href: '/admin/contacts/', act: true },
  { label: 'New playbook item', href: '/admin/playbook/', act: true },
  { label: 'Export finances (XLSX)', href: '/admin/finance/export.html', roles: ['full'], act: true },
  { label: 'Sign out', act: true, signout: true },
];

function fuzzy(q, s) {
  q = (q || '').toLowerCase(); s = (s || '').toLowerCase();
  if (!q) return 0;
  const idx = s.indexOf(q);
  if (idx >= 0) return 120 - idx;            // substring match — strongest, prefer early
  let qi = 0, score = 0, last = -2;
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) { score += (i === last + 1 ? 3 : 1); last = i; qi++; }
  }
  return qi === q.length ? score : -1;
}
function recentHrefs() { try { return JSON.parse(localStorage.getItem('cd_recent') || '[]'); } catch { return []; } }
function pushRecent(href) { try { const r = recentHrefs().filter(h => h !== href); r.unshift(href); localStorage.setItem('cd_recent', JSON.stringify(r.slice(0, 5))); } catch {} }

function mountPalette(role) {
  const pages = NAV.flatMap(sec => sec.items.filter(it => visibleForRole(it, role)).map(it => ({ label: it.label, href: it.href, group: sec.section })));
  const actions = QUICK_ACTIONS.filter(a => visibleForRole(a, role));
  const byHref = (h) => pages.find(p => normalizePath(p.href) === normalizePath(h));

  const overlay = el(`<div class="cmdk" aria-hidden="true">
    <div class="cmdk-box" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="cmdk-inwrap"><span class="cmdk-mag">⌕</span><input class="cmdk-input" placeholder="Search pages & actions…" autocomplete="off" spellcheck="false" /></div>
      <div class="cmdk-list"></div>
      <div class="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
    </div></div>`);
  document.body.appendChild(overlay);
  const input = overlay.querySelector('.cmdk-input');
  const list = overlay.querySelector('.cmdk-list');
  let items = [], active = 0, open = false;

  const rowHTML = (it, i) => `<button class="cmdk-item" data-i="${i}">
      <span class="ci-ic">${it.act ? '⚡' : '↳'}</span>
      <span class="ci-label">${it.label}</span>
      <span class="ci-hint">${it.act ? 'action' : (it.group || '')}</span></button>`;

  function build(q) {
    let groups = [];
    if (!q) {
      const rec = recentHrefs().map(byHref).filter(Boolean);
      if (rec.length) groups.push(['Recent', rec]);
      groups.push(['Quick actions', actions]);
      const byG = {}; pages.forEach(p => (byG[p.group] = byG[p.group] || []).push(p));
      Object.entries(byG).forEach(([g, arr]) => groups.push([g, arr]));
    } else {
      const score = (x) => Math.max(fuzzy(q, x.label), x.group ? fuzzy(q, x.group) - 25 : -1);
      const all = [...actions, ...pages];
      const ranked = all.map(x => ({ x, sc: score(x) })).filter(o => o.sc >= 0).sort((a, b) => b.sc - a.sc).slice(0, 9).map(o => o.x);
      groups = [['Results', ranked]];
    }
    items = []; list.innerHTML = '';
    for (const [g, arr] of groups) {
      if (!arr.length) continue;
      list.appendChild(el(`<div class="cmdk-group">${g}</div>`));
      for (const it of arr) {
        const i = items.length; items.push(it);
        const row = el(rowHTML(it, i));
        row.addEventListener('click', () => go(it));
        row.addEventListener('pointermove', () => { active = i; paint(); });
        list.appendChild(row);
      }
    }
    if (!items.length) list.appendChild(el(`<div class="cmdk-empty">No matches</div>`));
    active = 0; paint();
  }
  function paint() {
    list.querySelectorAll('.cmdk-item').forEach(r => r.classList.toggle('on', +r.dataset.i === active));
    list.querySelector('.cmdk-item.on')?.scrollIntoView({ block: 'nearest' });
  }
  function go(it) { if (!it) return; close(); if (it.signout) return signOut(); location.href = it.href; }
  function openP() { open = true; overlay.classList.add('show'); overlay.setAttribute('aria-hidden', 'false'); input.value = ''; build(''); setTimeout(() => input.focus(), 20); }
  function close() { open = false; overlay.classList.remove('show'); overlay.setAttribute('aria-hidden', 'true'); }

  input.addEventListener('input', () => build(input.value.trim()));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    const typing = /INPUT|TEXTAREA|SELECT/.test(tag) && document.activeElement !== input;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open ? close() : openP(); return; }
    if (e.key === '/' && !open && !typing) { e.preventDefault(); openP(); return; }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, items.length - 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(items[active]); }
  });
  window.__openPalette = openP;
}

export async function mountShell({ title } = {}) {
  // 1) Gate the page on auth (membership in admin_allowlist, any role)
  const ok = await requireAdminOrRedirect();
  if (!ok) return null;

  // 2) Resolve role + email
  const session = await getSession();
  const email = session?.user?.email || '';
  const role  = (await getAdminRole()) || 'full';

  // 3) Wrap existing main content
  const main = document.querySelector('main');
  if (!main) return null;
  if (title) document.title = `${title} · CD Admin`;

  const wrap = document.createElement('div');
  wrap.className = 'admin-app';
  wrap.innerHTML = railHTML(location.pathname, email, role) + '<div class="main"></div>';
  document.body.prepend(wrap);

  const mainSlot = wrap.querySelector('.main');
  mainSlot.appendChild(main);
  main.style.display = 'contents';

  // 4) Hook sign-out
  wrap.querySelector('[data-signout]')?.addEventListener('click', signOut);

  // 4b) Mobile hamburger — expands the rail's nav sections + sign-out into an
  // in-flow dropdown panel (below 900px the rail collapses to a slim top bar
  // and hides the nav by default; this is the only way to reach it on mobile).
  const railEl = wrap.querySelector('.rail');
  const toggleBtn = wrap.querySelector('[data-railtoggle]');
  const setMenu = (open) => {
    railEl.classList.toggle('menu-open', open);
    toggleBtn?.setAttribute('aria-expanded', String(open));
    if (toggleBtn) toggleBtn.innerHTML = open ? '&times;' : '&#9776;';
  };
  toggleBtn?.addEventListener('click', () => setMenu(!railEl.classList.contains('menu-open')));
  railEl.querySelectorAll('a.nav-item').forEach(a => a.addEventListener('click', () => setMenu(false)));

  // 5) Tile-level role gating (anything in the DOM with data-role)
  filterTilesByRole(role);

  // 6) Command palette + recent-page tracking
  mountPalette(role);
  wrap.querySelectorAll('[data-openpalette]').forEach(b => b.addEventListener('click', () => window.__openPalette && window.__openPalette()));
  pushRecent(normalizePath(location.pathname));

  return { session, email, role };
}

// ---------- Toast ----------

let toastEl = null;
export function toast(msg, kind = 'ok', ms = 2200) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.className = `toast ${kind} show`;
  toastEl.textContent = msg;
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), ms);
}

// ---------- DOM helper ----------

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---------- Date helpers ----------

export function monthsBack(n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(d);
  }
  return out;
}

export function monthKey(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
}
