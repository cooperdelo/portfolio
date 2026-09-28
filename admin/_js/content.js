// /admin/_js/content.js — Content: automatic "All posts" feed + calendar.
// Reads: v_social_posts_latest via live-data.js socialPostsLatest() (posts, newest
// metrics, permanent thumbnail in storage bucket social-thumbs). Nothing on this
// page is typed or pasted: posts arrive from the social-pull collector.
// Key metric: LinkedIn = impressions when a real impressions figure exists for that
// post, otherwise reactions (labelled as reactions); IG/TikTok/YouTube = views.
// 2026-09-28 v5: the manual queue (content_queue add form + stage buttons) is removed
// from this page; content_queue was empty and should be fed from CONTENT-STATUS.md.
import { mountShell } from '/admin/_shell/admin-shell.js';
import { requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc, fmtDay, fmtNum, fmtCompact, emptyState, pageHead, ymd, toDate, todayET, platName } from '/admin/_shell/ui.js';
import { socialPostsLatest, FEED_ACCOUNTS, isPlugverseHandle, isDemo } from '/admin/_shell/live-data.js';
import { reveal, onVisible, pop, spotlight } from '/admin/_shell/motion.js';

if (!isDemo() && !(await requireFullAdminOrRedirect())) throw new Error('not full admin');
await mountShell({ title: 'Content', demo: true });
const app = document.getElementById('app');
const PLATS = ['linkedin', 'instagram', 'tiktok', 'youtube'];
const MARK = { linkedin: 'in', instagram: 'IG', tiktok: 'TT', youtube: 'YT' };
const PAGE = 24;

app.innerHTML = pageHead('Grow', 'Content') + `
  <section class="sv-section" style="margin-top:0" aria-label="All posts">
    <div class="pf-bar" id="chips" role="tablist"></div>
    <div class="pfeed" id="feed"><div class="shimmer" style="height:320px"></div><div class="shimmer" style="height:320px"></div><div class="shimmer" style="height:320px"></div></div>
    <div class="pf-more" id="more" hidden><button class="btn">Show more</button></div>
  </section>
  <section class="sv-section">
    <div class="sv-card pad-lg">
      <div class="sv-h"><h2 id="mlabel"></h2><div class="seg"><button id="prev">Prev</button><button id="now">Today</button><button id="next">Next</button></div></div>
      <div id="cal"></div>
    </div>
  </section>`;
spotlight(document);

let posts = [], filter = 'all', shown = PAGE;
const cursor = toDate(todayET()); cursor.setDate(1);
const inFeed = (p) => (FEED_ACCOUNTS[p.platform] || []).includes(String(p.account_handle || '').toLowerCase());
const firstLine = (s) => String(s || '').split('\n').map(x => x.trim()).find(Boolean) || '';

async function load() {
  try {
    const rows = await socialPostsLatest({ limit: 400 });
    // Only real posts: a link to the live post and a real post time.
    posts = rows.filter(p => inFeed(p) && p.posted_at && p.permalink)
      .sort((a, b) => new Date(b.posted_at) - new Date(a.posted_at));
  } catch (e) {
    console.error(e);
    document.getElementById('feed').innerHTML = emptyState("Couldn't load posts", esc(e?.message || String(e)));
    return;
  }
  drawChips(); drawFeed(true); drawCal();
}

function drawChips() {
  const n = (p) => p === 'all' ? posts.length : posts.filter(x => x.platform === p).length;
  const list = ['all', ...PLATS.filter(p => n(p))];
  const el = document.getElementById('chips');
  el.innerHTML = list.map(p => `<button class="pf-chip${p === filter ? ' on' : ''}" role="tab" aria-selected="${p === filter}" data-p="${p}">${p === 'all' ? 'All' : esc(platName(p))}<span class="n">${n(p)}</span></button>`).join('');
  el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
    if (filter === b.dataset.p) return;
    filter = b.dataset.p; shown = PAGE;
    el.querySelectorAll('.pf-chip').forEach(c => { const on = c.dataset.p === filter; c.classList.toggle('on', on); c.setAttribute('aria-selected', on); });
    drawFeed(true);
  });
}

function card(p) {
  const pv = isPlugverseHandle(p.account_handle);
  const handle = p.platform === 'tiktok' && /^cooper delo$/i.test(p.account_handle) ? 'cooperdelo' : p.account_handle;
  const date = fmtDay(p.posted_at, { month: 'short', day: 'numeric', year: toDate(p.posted_at).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  const cap = firstLine(p.caption);
  const val = p.reach;
  const th = p.thumb_url
    ? `<img alt="" loading="lazy" decoding="async" src="${esc(p.thumb_url)}"><span class="tag"><span class="pm ${esc(p.platform)}">${MARK[p.platform]}</span></span>`
    : `<div class="none"><span class="pm ${esc(p.platform)}">${MARK[p.platform]}</span></div>`;
  return `<a class="pcard${pv ? ' pv' : ''}" href="${esc(p.permalink)}" target="_blank" rel="noopener" title="${esc(cap)}">
    <div class="th">${th}</div>
    <div class="bd">
      <div class="meta"><span class="h">${esc(platName(p.platform))} · @${esc(handle)}</span><span class="d">${esc(date)}</span></div>
      <div class="cap">${esc(cap) || '<span class="sv-muted">No caption</span>'}</div>
      <div class="km"><span class="v${val == null ? ' nil' : ''}" title="${val == null ? '' : fmtNum(val)}">${val == null ? '—' : esc(fmtCompact(val))}</span><span class="l">${esc(val == null ? 'no metrics yet' : p.reachLabel)}</span></div>
      ${p.as_of && val != null ? `<div class="asof">as of ${esc(fmtDay(p.as_of, { month: 'short', day: 'numeric' }))}</div>` : ''}
    </div></a>`;
}

function drawFeed(reset) {
  const list = filter === 'all' ? posts : posts.filter(p => p.platform === filter);
  const feed = document.getElementById('feed');
  const from = reset ? 0 : feed.querySelectorAll('.pcard').length;
  const html = list.slice(from, shown).map(card).join('');
  if (reset) feed.innerHTML = html || emptyState('No posts yet.', '');
  else feed.insertAdjacentHTML('beforeend', html);
  const fresh = [...feed.querySelectorAll('.pcard')].slice(from);
  fresh.forEach(c => { const img = c.querySelector('img'); if (!img) return; const on = () => img.classList.add('ld'); if (img.complete && img.naturalWidth) on(); else { img.addEventListener('load', on, { once: true }); img.addEventListener('error', () => { img.parentElement.innerHTML = `<div class="none">${img.nextElementSibling?.innerHTML || ''}</div>`; }, { once: true }); } });
  reveal(fresh.slice(0, 12), { stagger: 40, y: 8, dur: 520 });
  fresh.slice(12).forEach(c => onVisible(c, () => reveal(c, { y: 8, dur: 520 })));
  pop(fresh.slice(0, 12).map(c => c.querySelector('.km')).filter(Boolean), { delay: 200, stagger: 30 });
  const more = document.getElementById('more');
  more.hidden = list.length <= shown;
  more.querySelector('button').onclick = () => { shown += PAGE; drawFeed(false); };
}

function drawCal() {
  document.getElementById('mlabel').textContent = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const start = new Date(cursor); start.setDate(1 - start.getDay());
  const today = todayET();
  const byDay = {};
  posts.forEach(p => (byDay[ymd(p.posted_at)] = byDay[ymd(p.posted_at)] || []).push(p));
  let html = '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="sv-muted" style="font-size:.72rem;padding:.2rem .3rem">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = ymd(d), items = byDay[k] || [], inMonth = d.getMonth() === cursor.getMonth();
    html += `<div style="min-height:74px;border-radius:10px;padding:.35rem;background:${k === today ? 'var(--accent-tint)' : 'var(--surface-2)'};border:1px solid var(--border);opacity:${inMonth ? 1 : .45};min-width:0">
      <div style="font-size:.72rem;font-weight:600;color:${k === today ? 'var(--accent-ink)' : 'var(--text-3)'}">${d.getDate()}</div>
      ${items.slice(0, 3).map(p => `<a href="${esc(p.permalink)}" target="_blank" rel="noopener" title="${esc(firstLine(p.caption))}${p.reach != null ? ' · ' + fmtNum(p.reach) + ' ' + p.reachLabel : ''}" style="display:block;font-size:.68rem;margin-top:3px;padding:2px 5px;border-radius:6px;background:var(--text);color:var(--canvas);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(MARK[p.platform] || p.platform)} ${esc(firstLine(p.caption).slice(0, 24))}</a>`).join('')}
      ${items.length > 3 ? `<div class="sv-muted" style="font-size:.66rem">+${items.length - 3} more</div>` : ''}
    </div>`;
  }
  document.getElementById('cal').innerHTML = html + '</div>';
}

document.getElementById('prev').onclick = () => { cursor.setMonth(cursor.getMonth() - 1); drawCal(); };
document.getElementById('next').onclick = () => { cursor.setMonth(cursor.getMonth() + 1); drawCal(); };
document.getElementById('now').onclick = () => { const t = toDate(todayET()); cursor.setFullYear(t.getFullYear(), t.getMonth(), 1); drawCal(); };
load();
