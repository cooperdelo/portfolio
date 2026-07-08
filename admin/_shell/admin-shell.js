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
const NAV = [
  { section: 'Overview', items: [
    { href: '/admin/',                          label: 'Home' },
    { href: '/admin/finance/',                  label: 'Finance Dashboard' },
  ]},
  { section: 'Health', items: [
    { href: '/admin/health/log.html',           label: 'Daily Log', roles: ['full'] },
    { href: '/admin/health/dashboard.html',     label: 'Health Insights', roles: ['full'] },
  ]},
  { section: 'Academics', items: [
    { href: '/admin/academics/',                label: 'Degree Progress', roles: ['full'] },
  ]},
  { section: 'Finance', items: [
    { href: '/admin/finance/transactions.html', label: 'Transactions' },
    { href: '/admin/finance/entry.html',        label: 'Quick Add' },
    { href: '/admin/finance/investments.html',  label: 'Investments', roles: ['full'] },
  ]},
  { section: 'Inventory', items: [
    { href: '/admin/merch/',                    label: 'Merch Tracker', roles: ['full'] },
  ]},
  { section: 'Projects', items: [
    { href: '/admin/plugverse/',                label: 'Plugverse KPIs' },
    { href: '/admin/social/',                   label: 'Social Analytics', roles: ['full'] },
  ]},
  { section: 'Brand', items: [
    { href: '/admin/carousels/',                label: 'Carousel Studio', roles: ['full'] },
    { href: '/admin/playbook/',                 label: 'Playbook' },
    { href: '/admin/contacts/',                 label: 'Contacts' },
  ]},
  { section: 'Reports', items: [
    { href: '/admin/finance/plugverse.html',    label: 'Plugverse P&L' },
    { href: '/admin/finance/funding.html',      label: 'Funding Sources' },
    { href: '/admin/finance/fund.html',         label: '1789 Fund' },
    { href: '/admin/finance/food-log.html',     label: 'Food Log', roles: ['full'] },
    { href: '/admin/finance/tax.html',          label: 'Tax Prep', roles: ['full'] },
  ]},
  { section: 'Data', items: [
    { href: '/admin/finance/export.html',       label: 'Export XLSX', roles: ['full'] },
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

  // 5) Tile-level role gating (anything in the DOM with data-role)
  filterTilesByRole(role);

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
