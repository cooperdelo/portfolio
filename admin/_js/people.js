// /admin/_js/people.js — People in orbit.
// Reads/writes: engagers (new). Ongoing feed: LinkedIn notification emails,
// parsed by a separate agent. Manual add is here so nothing is blocked on it.
import { sb } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';
import { requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc, fmtDay, ago, platMark, emptyState, initials, pageHead } from '/admin/_shell/ui.js';

if (!(await requireFullAdminOrRedirect())) throw new Error('not full admin');
await mountShell({ title: 'People in orbit' });
const app = document.getElementById('app');

app.innerHTML = pageHead('Grow', 'People in orbit', '<button class="btn primary" id="add-btn">Add a person</button>') + `
  <div class="sv-card" id="add" style="display:none;margin-bottom:1rem">
    <form class="form-grid" id="add-form">
      <div class="field"><label>Name</label><input name="name" required placeholder="First name is enough"></div>
      <div class="field"><label>Headline</label><input name="headline" placeholder="e.g. Founder at ..."></div>
      <div class="field"><label>Platform</label><select name="platform"><option>linkedin</option><option>instagram</option><option>tiktok</option><option>youtube</option><option>x</option></select></div>
      <div class="field"><label>Handle or profile link</label><input name="handle" placeholder="optional"></div>
      <div class="field"><label>What they did</label><input name="last_interaction" placeholder="commented on the launch post"></div>
      <div class="field" style="justify-content:flex-end"><button class="btn primary" type="submit">Save</button></div>
    </form>
  </div>
  <div class="filters"><div class="seg" id="seg"></div><input type="search" id="q" placeholder="Search names and headlines"></div>
  <div class="sv-grid c3" id="stats" style="margin-bottom:1rem"></div>
  <div class="sv-card"><div class="rows" id="list"><div class="shimmer" style="height:80px"></div></div></div>`;

let rows = [], plat = 'all';
document.getElementById('add-btn').onclick = () => { const a = document.getElementById('add'); a.style.display = a.style.display === 'none' ? 'block' : 'none'; };
document.getElementById('add-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const isUrl = /^https?:\/\//.test(f.handle || '');
  const rec = { name: f.name.trim(), headline: f.headline || null, platform: f.platform, handle: isUrl ? '' : (f.handle || '').replace(/^@/, ''), profile_url: isUrl ? f.handle : null, last_interaction: f.last_interaction || null, source: 'manual (admin)' };
  const { error } = await sb.from('engagers').insert(rec);
  if (error) return toast(error.message, 'err');
  e.target.reset(); toast('Saved', 'ok'); load();
};
document.getElementById('q').oninput = render;

async function load() {
  const { data, error } = await sb.from('engagers').select('*').order('last_seen', { ascending: false }).order('interactions', { ascending: false });
  if (error) { document.getElementById('list').innerHTML = emptyState("Couldn't load", esc(error.message)); return; }
  rows = data || []; render();
}
function render() {
  const plats = ['all', ...new Set(rows.map(r => r.platform))];
  document.getElementById('seg').innerHTML = plats.map(p => `<button class="${p === plat ? 'on' : ''}" data-p="${p}">${p === 'all' ? 'All' : esc(p)}</button>`).join('');
  document.querySelectorAll('#seg button').forEach(b => b.onclick = () => { plat = b.dataset.p; render(); });
  const q = document.getElementById('q').value.toLowerCase();
  const vis = rows.filter(r => (plat === 'all' || r.platform === plat) && (!q || `${r.name} ${r.headline || ''}`.toLowerCase().includes(q)));
  const week = rows.filter(r => r.last_seen && (Date.now() - new Date(r.last_seen)) < 7 * 864e5).length;
  const repeat = rows.filter(r => r.interactions > 1).length;
  document.getElementById('stats').innerHTML = [['People tracked', rows.length], ['Seen this week', week], ['Came back more than once', repeat]]
    .map(([k, v]) => `<div class="sv-card"><div class="sv-label">${k}</div><div class="sv-num md">${v}</div><div class="sv-meta">engagers table</div></div>`).join('');
  document.getElementById('list').innerHTML = vis.map(r => `<div class="row">
      ${r.avatar_url ? `<img class="avatar" src="${esc(r.avatar_url)}" alt="" onerror="this.outerHTML='<span class=&quot;avatar&quot;>${esc(initials(r.name))}</span>'">` : `<span class="avatar">${esc(initials(r.name))}</span>`}
      <div class="grow"><div class="t">${esc(r.name)}</div><div class="s">${esc(r.headline || r.last_interaction || '')}</div></div>
      ${platMark(r.platform)}
      <span class="chip ${r.interactions > 1 ? 'accent' : ''}">${r.interactions}x</span>
      <span class="sv-muted" style="font-size:.76rem;white-space:nowrap">last ${esc(fmtDay(r.last_seen))}</span>
      ${r.profile_url ? `<a class="btn small" href="${esc(r.profile_url)}" target="_blank" rel="noopener">Profile</a>` : ''}
    </div>`).join('') || emptyState(rows.length ? 'No matches' : 'Nobody tracked yet',
      'Fed by the LinkedIn notification-email agent (it reads "X reacted to / commented on your post" emails and adds one row per person). LinkedIn\'s official API does not expose who engaged, so this is the no-scraper route. You can also add someone by hand with "Add a person". Instagram usernames can come from the social-pull task later.');
}
load();
