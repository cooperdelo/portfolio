// /admin/_js/content.js — content calendar + queue.
// Reads: social_posts (what went out), content_queue (what's planned).
// Writes: content_queue (add, move status, register a LinkedIn link).
import { sb } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';
import { requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc, fmtDay, platMark, emptyState, pageHead, ymd, toDate, todayET, fmtNum } from '/admin/_shell/ui.js';
import { postsWithMetrics, PERSONAL } from '/admin/_shell/data.js';

if (!(await requireFullAdminOrRedirect())) throw new Error('not full admin');
await mountShell({ title: 'Content calendar' });
const app = document.getElementById('app');
const STATUSES = ['idea', 'scripted', 'filmed', 'edited', 'scheduled', 'posted'];

app.innerHTML = pageHead('Grow', 'Content calendar') + `
  <section class="sv-grid split">
    <div class="sv-card pad-lg">
      <div class="sv-h"><h2 id="mlabel"></h2><div class="seg"><button id="prev">Prev</button><button id="now">Today</button><button id="next">Next</button></div></div>
      <div id="cal"></div>
      <div class="sv-meta">Filled dots are posts that went out (social_posts). Outlined are planned items (content_queue).</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:1rem">
      <div class="sv-card">
        <h3>Register a LinkedIn post</h3>
        <div class="sv-meta" style="margin:.1rem 0 .6rem">Paste the link after you post. It lands in the queue as posted, so the next analytics pull can match it.</div>
        <form id="li" style="display:flex;gap:.5rem;flex-wrap:wrap"><div class="field" style="flex:1 1 220px"><input name="url" type="url" required placeholder="https://www.linkedin.com/posts/..."></div><div class="field" style="flex:1 1 220px"><input name="first" placeholder="First line (optional)"></div><button class="btn primary">Add</button></form>
      </div>
      <div class="sv-card">
        <h3>Add to the queue</h3>
        <form id="add" class="form-grid" style="margin-top:.6rem">
          <div class="field"><label>What</label><input name="title" required placeholder="Working title"></div>
          <div class="field"><label>Platform</label><select name="platform"><option>linkedin</option><option>instagram</option><option>tiktok</option><option>youtube</option></select></div>
          <div class="field"><label>Stage</label><select name="status">${STATUSES.map(s => `<option>${s}</option>`).join('')}</select></div>
          <div class="field"><label>Date</label><input name="date" type="date"></div>
          <div class="field" style="justify-content:flex-end"><button class="btn primary">Add</button></div>
        </form>
      </div>
    </div>
  </section>
  <section class="sv-section"><div class="sv-h"><h2>Queue</h2><span class="sv-sub">Click a stage to move an item</span></div><div class="sv-grid c3" id="queue"></div></section>`;

const cursor = toDate(todayET()); cursor.setDate(1);
let posts = [], queue = [];

async function load() {
  const [p, q] = await Promise.all([postsWithMetrics(), sb.from('content_queue').select('*').order('scheduled_for', { ascending: true, nullsFirst: false })]);
  posts = p.filter(x => x.posted_at && PERSONAL[x.platform] && String(x.account_handle).toLowerCase() === PERSONAL[x.platform].toLowerCase());
  if (q.error) toast(q.error.message, 'err');
  queue = q.data || [];
  drawCal(); drawQueue();
}

function drawCal() {
  document.getElementById('mlabel').textContent = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const start = new Date(cursor); start.setDate(1 - start.getDay());
  const today = todayET();
  const byDay = {};
  posts.forEach(p => (byDay[ymd(p.posted_at)] = byDay[ymd(p.posted_at)] || []).push({ kind: 'post', p }));
  queue.filter(q => q.scheduled_for && q.status !== 'posted').forEach(q => (byDay[ymd(q.scheduled_for)] = byDay[ymd(q.scheduled_for)] || []).push({ kind: 'plan', q }));
  let html = '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="sv-muted" style="font-size:.72rem;padding:.2rem .3rem">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = ymd(d), items = byDay[k] || [], inMonth = d.getMonth() === cursor.getMonth();
    html += `<div style="min-height:74px;border-radius:10px;padding:.35rem;background:${k === today ? 'var(--accent-tint)' : 'var(--surface-2)'};border:1px solid var(--border);opacity:${inMonth ? 1 : .45};min-width:0">
      <div style="font-size:.72rem;font-weight:600;color:${k === today ? 'var(--accent-ink)' : 'var(--text-3)'}">${d.getDate()}</div>
      ${items.slice(0, 3).map(it => it.kind === 'post'
        ? `<a href="${esc(it.p.permalink || '/admin/insights/')}" ${it.p.permalink ? 'target="_blank" rel="noopener"' : ''} title="${esc(String(it.p.caption || '').split('\n')[0])}${it.p.reach != null ? ' · ' + fmtNum(it.p.reach) + ' ' + it.p.reachLabel : ''}" style="display:block;font-size:.68rem;margin-top:3px;padding:2px 5px;border-radius:6px;background:var(--accent);color:#fff;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(it.p.platform.slice(0, 2).toUpperCase())} ${esc(String(it.p.caption || '').slice(0, 24))}</a>`
        : `<div title="${esc(it.q.title)}" style="font-size:.68rem;margin-top:3px;padding:1px 5px;border-radius:6px;border:1px solid var(--accent);color:var(--accent-ink);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(it.q.title)}</div>`).join('')}
      ${items.length > 3 ? `<div class="sv-muted" style="font-size:.66rem">+${items.length - 3} more</div>` : ''}
    </div>`;
  }
  document.getElementById('cal').innerHTML = html + '</div>';
}

function drawQueue() {
  const cols = [['Ideas', ['idea']], ['In production', ['scripted', 'filmed', 'edited']], ['Scheduled + posted', ['scheduled', 'posted']]];
  document.getElementById('queue').innerHTML = cols.map(([label, sts]) => {
    const items = queue.filter(q => sts.includes(q.status));
    return `<div class="sv-card"><h3>${label} <span class="chip">${items.length}</span></h3><div class="rows">${items.map(q => `<div class="row" style="flex-wrap:wrap">
        <div class="grow"><div class="t">${esc(q.title)}</div><div class="s">${q.scheduled_for ? esc(fmtDay(q.scheduled_for)) + ' · ' : ''}${esc(q.status)}${q.post_url ? ` · <a href="${esc(q.post_url)}" target="_blank" rel="noopener" style="color:var(--accent-ink)">link</a>` : ''}</div></div>
        ${platMark(q.platform)}
        <div class="seg" style="width:100%">${STATUSES.map(s => `<button class="${s === q.status ? 'on' : ''}" data-id="${q.id}" data-s="${s}">${s}</button>`).join('')}</div>
      </div>`).join('') || `<div class="sv-meta">Nothing here. Add items above; ideas you approve can live here.</div>`}</div></div>`;
  }).join('');
  document.querySelectorAll('#queue [data-s]').forEach(b => b.onclick = async () => {
    const { error } = await sb.from('content_queue').update({ status: b.dataset.s, updated_at: new Date().toISOString() }).eq('id', b.dataset.id);
    if (error) return toast(error.message, 'err'); toast('Moved to ' + b.dataset.s, 'ok'); load();
  });
}

document.getElementById('prev').onclick = () => { cursor.setMonth(cursor.getMonth() - 1); drawCal(); };
document.getElementById('next').onclick = () => { cursor.setMonth(cursor.getMonth() + 1); drawCal(); };
document.getElementById('now').onclick = () => { const t = toDate(todayET()); cursor.setFullYear(t.getFullYear(), t.getMonth(), 1); drawCal(); };
document.getElementById('add').onsubmit = async (e) => {
  e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
  const { error } = await sb.from('content_queue').insert({ title: f.title, platform: f.platform, status: f.status, scheduled_for: f.date ? new Date(f.date + 'T12:00:00').toISOString() : null, source: 'admin' });
  if (error) return toast(error.message, 'err'); e.target.reset(); toast('Added', 'ok'); load();
};
document.getElementById('li').onsubmit = async (e) => {
  e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
  if (!/linkedin\.com\//i.test(f.url)) return toast('That is not a LinkedIn link', 'err');
  const { error } = await sb.from('content_queue').insert({ title: f.first || 'LinkedIn post (link registered)', platform: 'linkedin', status: 'posted', post_url: f.url, scheduled_for: new Date().toISOString(), source: 'admin: pasted link' });
  if (error) return toast(error.message, 'err'); e.target.reset(); toast('Registered', 'ok'); load();
};
load();
