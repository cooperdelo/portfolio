// =====================================================================
// /admin/_shell/admin-shell.js
// - Enforces auth before rendering admin pages
// - Injects the left rail (sidebar) into every page
// - Highlights active nav item
// - Filters nav rail + tile grid by admin_role (full vs plugverse)
// - Exposes toast(), signOut, and a small DOM helper
// =====================================================================

import { requireAdminOrRedirect, signOut, getSession, getAdminRole } from './supabase.js';
import { icon } from './icons.js';

// Read a theme token at runtime (legacy Chart.js pages use this so their
// axes and tooltips follow light/dark instead of hard-coded cream).
window.__cv = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

// `roles` declares which admin_role values can see each nav item.
// Default is both. Items not listed in `roles` are visible to everyone signed in.
// Consolidated into 5 life domains (2026-07 redesign). Each domain groups the
// pages that actually get used; deep/rarely-used reports live inside their
// dashboard rather than as top-level rail items. Life pages are read-only and
// auto-synced by the nightly/weekly agent.
// 2026-09-27 Stanley-style redesign: Today / Grow / System sections added on
// top; every existing page is kept under its old section.
const NAV = [
  {section: 'Workspaces', items: [
    {href:'/admin/',label:'Choose workspace',ic:'home',roles:['full']},
    {href:'/admin/personal/',label:'Personal',ic:'compass',roles:['full']},
    {href:'/admin/plugverse/',label:'PlugVerse',ic:'workflow',roles:['full','plugverse','acquisition']},
    {href:'/admin/content/',label:'All content',ic:'film',roles:['full']},
    {href:'/admin/finance/',label:'Money',ic:'wallet',roles:['full','plugverse']},
    {href:'/admin/more/',label:'More tools',ic:'archive',roles:['full','plugverse']}
  ]},
  {section: 'Acquisition', items: [
    {href:'/admin/acquisition/',label:'Sending queue',ic:'users',roles:['full','acquisition']},
    {href:'/admin/acquisition/?view=replies',label:'Replies & follow-ups',ic:'repeat',roles:['full','acquisition']},
    {href:'/admin/acquisition/?view=results',label:'Experiments & results',ic:'chart-line',roles:['full','acquisition']}
  ]}
];
const TABS = {
  full:[['/admin/','Workspaces','home'],['/admin/personal/','Personal','compass'],['/admin/plugverse/','PlugVerse','workflow'],['/admin/content/','Content','film']],
  plugverse:[['/admin/plugverse/','PlugVerse','workflow'],['/admin/finance/','Money','wallet']],
  acquisition:[['/admin/plugverse/','PlugVerse','workflow'],['/admin/acquisition/','Queue','users'],['/admin/acquisition/?view=replies','Replies','repeat']]
};

// Pages that pin a theme in their own <html data-theme> (carousels, broll) are left alone.
// v6 film (2026-09-29): the admin is dark only (near-black ground under glass),
// so every page resolves to dark regardless of the stored or system theme.
function applyTheme() {
  const root = document.documentElement;
  if (root.dataset.themePinned) return;
  root.dataset.theme = 'dark';
}
// Brand marker kept for page-specific rules. Type is the same everywhere since v6:
// Druk Wide Bold + Nimbus Sans (+ Geist Mono for tiny metadata). See admin-shell.css v6.
(function initBrand() {
  const p = location.pathname.toLowerCase();
  if (p.startsWith('/admin/plugverse/') || p === '/admin/finance/plugverse.html') document.documentElement.dataset.brand = 'plugverse';
})();
(function initTheme() {
  const root = document.documentElement;
  if (root.dataset.theme) { root.dataset.themePinned = '1'; return; }
  applyTheme();
})();


function visibleForRole(item, role) {
  if (!item.roles) return role === 'full' || role === 'plugverse';
  return item.roles.includes(role);
}

function railHTML(activePath, email, role) {
  const sections = NAV.map(sec => {
    const items = sec.items
      .filter(it => visibleForRole(it, role))
      .map(it => {
        const isActive = normalizePath(it.href) === normalizePath(activePath);
        return `<a class="nav-item ${isActive ? 'active' : ''}" href="${it.href}"${isActive ? ' aria-current="page"' : ''}>${icon(it.ic, { size: 16, cls: 'ni' })}<span>${it.label}</span></a>`;
      }).join('');
    if (!items) return ''; // hide whole section if every item is gated out
    return `<div class="rail-section">
              <div class="eyebrow">${sec.section}</div>
              ${items}
            </div>`;
  }).join('');

  const roleBadge = role !== 'full' ? '<small class="role-badge">' + (role === 'acquisition' ? 'Acquisition' : 'PlugVerse') + '</small>' : '';

  return `
    <aside class="rail">
      <a class="brand" href="/admin/" aria-label="Admin home">Cooper Delo${roleBadge}</a>
      <button class="rail-search" data-openpalette aria-label="Search">${icon('search', { size: 15, cls: 'rs-mag' })}<span>Search</span><kbd>Ctrl K</kbd></button>
      <button class="rail-toggle" data-railtoggle aria-label="Menu" aria-expanded="false">${icon('menu', { size: 18 })}</button>
      <nav class="rail-nav" aria-label="All pages">
        ${sections}
        <div class="rail-foot">
          <span class="who" title="Signed in">${email || ''}</span>
          <div class="rf-btns">
            <button class="signout" data-signout>${icon('log-out', { size: 14 })}<span>Sign out</span></button>
          </div>
        </div>
      </nav>
    </aside>
    <div class="rail-scrim" data-railclose></div>`;
}

function tabbarHTML(activePath, role) {
  const tabs = TABS[role] || TABS.full;
  const links = tabs.map(([href, label, ic]) =>
    `<a href="${href}" class="${normalizePath(href) === normalizePath(activePath) ? 'active' : ''}">${icon(ic, { size: 19, cls: 'ti' })}<span>${label}</span></a>`).join('');
  return `<nav class="tabbar" aria-label="Primary">${links}<a href="#" data-tabmenu>${icon('ellipsis', { size: 19, cls: 'ti' })}<span>More</span></a></nav>`;
}

function normalizePath(p) {
  if (!p) return '';
  const url = new URL(p, location.origin);
  let n = url.pathname.replace(/index\.html$/, '');
  if (!n.endsWith('/') && !n.endsWith('.html')) n += '/';
  return n.toLowerCase() + (url.searchParams.has('view') ? '?view=' + url.searchParams.get('view') : '');
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
// Command palette (⌘K / Ctrl+K, or "/"), jump to any page or run a quick
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
  if (idx >= 0) return 120 - idx;            // substring match, strongest, prefer early
  let qi = 0, score = 0, last = -2;
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) { score += (i === last + 1 ? 3 : 1); last = i; qi++; }
  }
  return qi === q.length ? score : -1;
}
function recentHrefs() { try { return JSON.parse(localStorage.getItem('cd_recent') || '[]'); } catch { return []; } }
function pushRecent(href) { try { const r = recentHrefs().filter(h => h !== href); r.unshift(href); localStorage.setItem('cd_recent', JSON.stringify(r.slice(0, 5))); } catch {} }

function mountPalette(role) {
  const pages = NAV.flatMap(sec => sec.items.filter(it => visibleForRole(it, role)).map(it => ({ label: it.label, href: it.href, ic: it.ic, group: sec.section })));
  const actions = QUICK_ACTIONS.filter(a => visibleForRole(a, role));
  const byHref = (h) => pages.find(p => normalizePath(p.href) === normalizePath(h));

  const overlay = el(`<div class="cmdk" aria-hidden="true">
    <div class="cmdk-box" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="cmdk-inwrap">${icon('search', { size: 17, cls: 'cmdk-mag' })}<input class="cmdk-input" placeholder="Search pages and actions" autocomplete="off" spellcheck="false" /></div>
      <div class="cmdk-list"></div>
      <div class="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
    </div></div>`);
  document.body.appendChild(overlay);
  const input = overlay.querySelector('.cmdk-input');
  const list = overlay.querySelector('.cmdk-list');
  let items = [], active = 0, open = false;

  const rowHTML = (it, i) => `<button class="cmdk-item" data-i="${i}">
      <span class="ci-ic">${icon(it.signout ? 'log-out' : it.act ? 'plus' : (it.ic || 'arrow-right'), { size: 15 })}</span>
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

/**
 * Localhost-only design preview (?demo on http://localhost / 127.0.0.1).
 * Lets the layout render from a local, gitignored snapshot file for
 * screenshots. On any other host this is always false, so production and
 * Vercel previews always go through the normal auth gate below. No data is
 * read from Supabase in demo mode.
 */
export function isLocalDemo() {
  const local = location.protocol === 'http:' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  return local && new URLSearchParams(location.search).has('demo');
}

export async function mountShell({ title, demo = false } = {}) {
  // Pages that pass demo:true render their snapshot data. Since v6 every page also
  // skips the gate on localhost ?demo (design review of the chrome; queries then run
  // unauthenticated, so RLS returns nothing). Never true on any real host.
  const demoMode = isLocalDemo();
  void demo;
  // 1) Gate the page on auth (membership in admin_allowlist, any role)
  if (!demoMode) {
    const ok = await requireAdminOrRedirect();
    if (!ok) throw new Error('Sign-in required');
  }

  // 2) Resolve role + email
  const session = demoMode ? null : await getSession();
  const email = demoMode ? 'demo · localhost only' : (session?.user?.email || '');
  const role  = demoMode ? 'full' : (await getAdminRole());

  const acquisitionRoutes = ['/admin/plugverse/', '/admin/acquisition/'];
  if (!['full','plugverse','acquisition'].includes(role)) throw new Error('Access unavailable');
  if (role === 'acquisition' && !acquisitionRoutes.includes(normalizePath(location.pathname))) {
    location.replace('/admin/acquisition/');
    throw new Error('Acquisition access only');
  }
  // Navigation is only a convenience. Server/RLS checks remain mandatory.
  // 3) Wrap existing main content
  const main = document.querySelector('main');
  if (!main) return null;
  if (title) document.title = `${title} · CD Admin`;

  const wrap = document.createElement('div');
  wrap.className = 'admin-app';
  wrap.innerHTML = railHTML(location.pathname + location.search, email, role) + '<div class="main" id="top"></div>';
  document.body.prepend(wrap);

  const mainSlot = wrap.querySelector('.main');
  mainSlot.appendChild(main);
  main.style.display = 'contents';

  // 4) Hook sign-out
  wrap.querySelector('[data-signout]')?.addEventListener('click', signOut);

  // 4b) Mobile hamburger, expands the rail's nav sections + sign-out into an
  // in-flow dropdown panel (below 900px the rail collapses to a slim top bar
  // and hides the nav by default; this is the only way to reach it on mobile).
  const railEl = wrap.querySelector('.rail');
  const toggleBtn = wrap.querySelector('[data-railtoggle]');
  let tabMenu = null;
  const setMenu = (open) => {
    railEl.classList.toggle('menu-open', open);
    toggleBtn?.setAttribute('aria-expanded', String(open));
    tabMenu?.setAttribute('aria-expanded', String(open));
    if (toggleBtn) toggleBtn.innerHTML = icon(open ? 'x' : 'menu', { size: 18 });
  };
  // keep the current page visible in a rail that is taller than the screen
  const navEl = railEl.querySelector('.rail-nav'), activeEl = railEl.querySelector('.nav-item.active');
  if (navEl && activeEl && innerWidth > 900) {
    const top = activeEl.getBoundingClientRect().top - navEl.getBoundingClientRect().top;
    const over = top + activeEl.offsetHeight - (navEl.clientHeight - 60);
    if (over > 0) navEl.scrollTop = over;
  }
  toggleBtn?.addEventListener('click', () => setMenu(!railEl.classList.contains('menu-open')));
  railEl.querySelectorAll('a.nav-item').forEach(a => a.addEventListener('click', () => setMenu(false)));
  wrap.querySelector('[data-railclose]')?.addEventListener('click', () => setMenu(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && railEl.classList.contains('menu-open')) setMenu(false); });

  // 4c) Mobile bottom tab pill; "More" slides the full menu up as a glass sheet
  const tabbar = el(tabbarHTML(location.pathname + location.search, role));
  document.body.appendChild(tabbar);
  tabMenu = tabbar.querySelector('[data-tabmenu]');
  tabMenu?.setAttribute('aria-expanded', 'false');
  tabMenu?.addEventListener('click', (e) => {
    e.preventDefault(); setMenu(!railEl.classList.contains('menu-open'));
  });

  // 5) Tile-level role gating (anything in the DOM with data-role)
  filterTilesByRole(role);

  // 5b) House style: no em dashes on screen, even inside agent-written rows.
  // Text nodes only (never input values); " x \u2014 y" reads "x, y".
  const EM = /\s*\u2014\s*/g;
  const scrub = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.includes('\u2014') && !n.parentElement?.closest('textarea,script,style,code,pre')) n.nodeValue = n.nodeValue.replace(EM, (m) => (/^\s|\s$/.test(m) ? ', ' : '\u2013'));
  };
  scrub(document.body);
  let scrubT = 0;
  new MutationObserver(() => { clearTimeout(scrubT); scrubT = setTimeout(() => scrub(document.body), 30); }).observe(document.body, { childList: true, subtree: true, characterData: true });

  // 6) Command palette + recent-page tracking
  mountPalette(role);
  wrap.querySelectorAll('[data-openpalette]').forEach(b => b.addEventListener('click', () => window.__openPalette && window.__openPalette()));
  pushRecent(normalizePath(location.pathname));

  return { session, email, role, demo: demoMode };
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
