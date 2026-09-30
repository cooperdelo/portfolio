// /admin/_js/brain.js, Brain: playbook_items + vault_documents viewer.
// Reads: v_playbook_active, vault_documents. Read-only (edit playbook rows in /admin/playbook/).
import { sb } from '/admin/_shell/supabase.js';
import { mountShell } from '/admin/_shell/admin-shell.js';
import { requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc, ago, fmtDay, emptyState, pageHead } from '/admin/_shell/ui.js';

if (!(await requireFullAdminOrRedirect())) throw new Error('not full admin');
await mountShell({ title: 'Brain' });
const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
let tab = params.get('path') ? 'vault' : (params.get('tab') || 'playbook');

app.innerHTML = pageHead('Brand', 'Brain', '<a class="btn" href="/admin/playbook/">Edit playbook</a>') + `
  <div class="filters"><div class="seg" id="tabs"></div><input type="search" id="q" placeholder="Search" style="flex:1 1 240px"><select id="type"></select></div>
  <div class="grid"><div class="sv-card span-7" style="padding:8px 20px"><div class="rows" id="list"><div class="shimmer" style="height:120px;margin:1rem 0"></div></div></div>
  <div class="sv-card pad-lg span-5" id="detail" style="position:sticky;top:20px;align-self:start"></div></div>`;

const [{ data: pb, error: e1 }, { data: vd, error: e2 }] = await Promise.all([
  sb.from('v_playbook_active').select('id,scope,item_type,title,summary,body_markdown,category,tags,is_pinned,priority,source_vault_path,updated_at').order('is_pinned', { ascending: false }).order('priority', { ascending: true }).limit(2000),
  sb.from('vault_documents').select('path,owner_task,updated_at,direction').order('updated_at', { ascending: false }).limit(2000),
]);
const playbook = pb || [], vault = vd || [];

function drawTabs() {
  document.getElementById('tabs').innerHTML = [['playbook', `Playbook (${playbook.length})`], ['vault', `Vault files (${vault.length})`]].map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-k="${k}">${l}</button>`).join('');
  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { tab = b.dataset.k; drawTabs(); fillType(); draw(); });
}
function fillType() {
  const vals = tab === 'playbook' ? [...new Set(playbook.map(p => p.item_type))].sort() : [...new Set(vault.map(v => v.path.split('/')[0]))].sort();
  document.getElementById('type').innerHTML = `<option value="">${tab === 'playbook' ? 'All types' : 'All folders'}</option>` + vals.map(v => `<option>${esc(v)}</option>`).join('');
}
function draw() {
  const q = document.getElementById('q').value.toLowerCase(), t = document.getElementById('type').value;
  const list = document.getElementById('list');
  if (tab === 'playbook') {
    if (e1) { list.innerHTML = emptyState("Couldn't load playbook", esc(e1.message)); return; }
    const vis = playbook.filter(p => (!t || p.item_type === t) && (!q || `${p.title} ${p.summary || ''} ${(p.tags || []).join(' ')}`.toLowerCase().includes(q)));
    list.innerHTML = vis.slice(0, 300).map(p => `<a class="row" href="#" data-id="${p.id}"><div class="grow"><div class="t">${p.is_pinned ? '<span class="chip">pinned</span> ' : ''}${esc(p.title)}</div><div class="s">${esc(p.summary || '')}</div></div><span class="chip">${esc(p.item_type)}</span></a>`).join('') || emptyState('Nothing matches', 'Fed by playbook_items (chat sessions write rows after each session).');
    list.querySelectorAll('[data-id]').forEach(a => a.onclick = (e) => { e.preventDefault(); showItem(playbook.find(p => p.id === a.dataset.id)); });
  } else {
    if (e2) { list.innerHTML = emptyState("Couldn't load vault files", esc(e2.message)); return; }
    const vis = vault.filter(v => (!t || v.path.startsWith(t + '/') || v.path === t) && (!q || v.path.toLowerCase().includes(q) || (v.owner_task || '').includes(q)));
    list.innerHTML = vis.slice(0, 300).map(v => `<a class="row" href="#" data-path="${esc(v.path)}"><div class="grow"><div class="t">${esc(v.path)}</div><div class="s">${esc(v.owner_task || 'no owner task')} · updated ${esc(ago(v.updated_at))}</div></div></a>`).join('') || emptyState('Nothing matches', 'Fed by the vault sync (vault_documents).');
    list.querySelectorAll('[data-path]').forEach(a => a.onclick = (e) => { e.preventDefault(); showDoc(a.dataset.path); });
  }
}
function showItem(p) {
  document.getElementById('detail').innerHTML = `<div class="sv-label"><span class="chip">${esc(p.item_type)}</span><span class="chip">${esc(p.scope)}</span>${p.category ? `<span class="chip">${esc(p.category)}</span>` : ''}</div>
    <h2 style="font-size:17px;font-weight:700;margin:12px 0 6px;text-transform:none;letter-spacing:0">${esc(p.title)}</h2>
    ${p.summary ? `<p class="sv-text">${esc(p.summary)}</p>` : ''}
    ${p.body_markdown ? `<div class="doc" style="margin-top:.8rem">${esc(p.body_markdown)}</div>` : ''}
    <div class="sv-meta">${p.source_vault_path ? `source <a href="#" data-src="${esc(p.source_vault_path)}" style="color:var(--accent-ink)">${esc(p.source_vault_path)}</a> · ` : ''}updated ${esc(fmtDay(p.updated_at))}</div>`;
  document.querySelector('[data-src]')?.addEventListener('click', (e) => { e.preventDefault(); showDoc(p.source_vault_path); });
}
async function showDoc(path) {
  const det = document.getElementById('detail');
  det.innerHTML = '<div class="shimmer" style="height:200px"></div>';
  const { data, error } = await sb.from('vault_documents').select('path,content,owner_task,updated_at').eq('path', path).maybeSingle();
  if (error || !data) { det.innerHTML = emptyState('Not in the synced vault.', ''); return; }
  det.innerHTML = `<div class="sv-label">${esc(data.owner_task || 'vault file')}</div><h2 style="font-size:15px;font-weight:700;margin:6px 0 12px;word-break:break-all">${esc(data.path.split('/').pop())}</h2>
    <div class="doc">${esc(data.content)}</div><div class="sv-meta">${esc(ago(data.updated_at))}</div><div class="sv-meta" style="text-transform:none">C:\\Users\\coope\\Desktop\\Claude\\${esc(data.path.replace(/\//g, '\\'))}</div>`;
}
document.getElementById('q').oninput = draw;
document.getElementById('type').onchange = draw;
drawTabs(); fillType(); draw();
document.getElementById('detail').innerHTML = `<div class="sv-h"><h2>Open</h2></div>${emptyState('Pick a row.', '')}`;
if (params.get('path')) showDoc(params.get('path'));
