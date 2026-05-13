// =====================================================================
// /admin/_shell/admin-shell.js
// - Enforces auth before rendering admin pages
// - Injects the left rail (sidebar) into every page
// - Highlights active nav item
// - Exposes toast(), signOut, and a small DOM helper
// =====================================================================

import { requireAdminOrRedirect, signOut, getSession } from './supabase.js';

const NAV = [
  { section: 'Overview', items: [
    { href: '/admin/',                   label: 'Home' },
    { href: '/admin/finance/',           label: 'Finance Dashboard' },
  ]},
  { section: 'Finance', items: [
    { href: '/admin/finance/transactions.html', label: 'Transactions' },
    { href: '/admin/finance/entry.html',        label: 'Quick Add' },
    { href: '/admin/finance/investments.html',  label: 'Investments' },
  ]},
  { section: 'Inventory', items: [
    { href: '/admin/merch/',                    label: 'Merch Tracker' },
  ]},
  { section: 'Reports', items: [
    { href: '/admin/finance/plugverse.html',  label: 'Plugverse P&L' },
    { href: '/admin/finance/fund.html',       label: '1789 Fund' },
    { href: '/admin/finance/food-log.html',   label: 'Food Log' },
    { href: '/admin/finance/tax.html',        label: 'Tax Prep' },
  ]},
  { section: 'Data', items: [
    { href: '/admin/finance/export.html', label: 'Export XLSX' },
  ]},
];

function railHTML(activePath, email) {
  const sections = NAV.map(sec => {
    const items = sec.items.map(it => {
      const isActive = normalizePath(it.href) === normalizePath(activePath);
      return `<a class="nav-item ${isActive ? 'active' : ''}" href="${it.href}">
                <span class="pulse"></span><span>${it.label}</span>
              </a>`;
    }).join('');
    return `<div class="rail-section">
              <div class="eyebrow">${sec.section}</div>
              ${items}
            </div>`;
  }).join('');

  return `
    <aside class="rail">
      <div class="brand"><span class="dot"></span>CD <small>Admin</small></div>
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

export async function mountShell({ title } = {}) {
  // 1) Gate the page on auth
  const ok = await requireAdminOrRedirect();
  if (!ok) return null;

  // 2) Get user email for the footer
  const session = await getSession();
  const email = session?.user?.email || '';

  // 3) Wrap existing main content
  const main = document.querySelector('main');
  if (!main) return null;
  if (title) document.title = `${title} · CD Admin`;

  const wrap = document.createElement('div');
  wrap.className = 'admin-app';
  wrap.innerHTML = railHTML(location.pathname, email) + '<div class="main"></div>';
  document.body.prepend(wrap);

  const mainSlot = wrap.querySelector('.main');
  mainSlot.appendChild(main);
  // Hide the original <main> wrapper styles if any; keep its children
  main.style.display = 'contents';

  // 4) Hook sign-out
  wrap.querySelector('[data-signout]')?.addEventListener('click', signOut);

  return { session, email };
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
