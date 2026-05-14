// =====================================================================
// /admin/playbook/_js/playbook.js
// Brand / strategy / voice vault. Reads v_playbook_active (active rows
// only), writes back to playbook_items. Soft-delete via deleted_at.
// Realtime: any insert from a chat session shows up within ~350ms.
// =====================================================================
import { sb, subscribeTable } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';

await mountShell({ title: 'Playbook · Vault' });

// ---------- State ----------
const state = {
  items: [],
  filters: { scope: 'all', type: 'all', pinned: false },
  q: '',
};

const SCOPES = ['personal-brand', 'plugverse', 'both'];
const TYPE_LABELS = {
  'caption-idea':     'Caption ideas',
  'video-idea':       'Video ideas',
  'philosophy-line':  'Philosophy lines',
  'hook':             'Hooks',
  'decision':         'Decisions',
  'identity':         'Identity',
  'pillar':           'Pillars',
  'strategy':         'Strategy',
  'rule':             'Rules',
  'voice-rule':       'Voice rules',
  'framework':        'Frameworks',
  'prompt':           'Prompts',
};

// ---------- Helpers ----------
const $  = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => [...el.querySelectorAll(q)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const labelType = t => TYPE_LABELS[t] || cap(String(t).replace(/-/g, ' '));
const fromNow = d => {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60)    return s + 's ago';
  if (s < 3600)  return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  const days = Math.floor(s / 86400);
  return days < 7 ? days + 'd ago' : (new Date(d)).toLocaleDateString('en-US', { month:'short', day:'numeric' });
};
const parseTags = raw => String(raw || '').split(',').map(t => t.trim()).filter(Boolean);

// ---------- Sheet ----------
const scrim = $('#scrim');
const sheet = $('#sheet');
const sheetBody = $('#sheet-body');
function openSheet(html) {
  sheetBody.innerHTML = html;
  scrim.classList.add('on');
  sheet.classList.add('on');
  document.body.style.overflow = 'hidden';
  // Autofocus first input
  setTimeout(() => sheetBody.querySelector('input, textarea, select')?.focus(), 60);
}
function closeSheet() {
  scrim.classList.remove('on');
  sheet.classList.remove('on');
  document.body.style.overflow = '';
}
scrim.addEventListener('click', closeSheet);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

// ---------- Data ----------
async function loadAll() {
  const { data, error } = await sb
    .from('v_playbook_active')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('priority', { ascending: true })
    .order('updated_at', { ascending: false });
  if (error) {
    toast('Failed to load: ' + error.message, 'err');
    return;
  }
  state.items = data || [];
  render();
}

// ---------- Filtering ----------
function filtered() {
  const q = state.q.trim().toLowerCase();
  return state.items.filter(it => {
    if (state.filters.scope !== 'all' && it.scope !== state.filters.scope) return false;
    if (state.filters.type  !== 'all' && it.item_type !== state.filters.type) return false;
    if (state.filters.pinned && !it.is_pinned) return false;
    if (q) {
      const hay = [it.title, it.summary, it.body_markdown, it.category, it.subcategory, (it.tags || []).join(' ')]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ---------- Render ----------
function render() {
  // KPIs
  $('#k-total').textContent  = state.items.length;
  $('#k-pinned').textContent = state.items.filter(x => x.is_pinned).length;
  $('#k-pb').textContent     = state.items.filter(x => x.scope === 'personal-brand').length;
  $('#k-pv').textContent     = state.items.filter(x => x.scope === 'plugverse').length;

  // Type filter row — rebuild with counts (within the current scope filter, ignoring type filter)
  const scopeMatches = state.items.filter(it =>
    state.filters.scope === 'all' || it.scope === state.filters.scope
  );
  const typeCounts = {};
  for (const it of scopeMatches) typeCounts[it.item_type] = (typeCounts[it.item_type] || 0) + 1;
  const orderedTypes = Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a]);

  const typeRow = $('#type-row');
  typeRow.innerHTML =
    `<span class="lbl">Type</span>
     <button class="pill ${state.filters.type === 'all' ? 'on' : ''}" data-filter="type" data-v="all">All <span class="n">${scopeMatches.length}</span></button>` +
    orderedTypes.map(t =>
      `<button class="pill ${state.filters.type === t ? 'on' : ''}" data-filter="type" data-v="${esc(t)}">${esc(labelType(t))} <span class="n">${typeCounts[t]}</span></button>`
    ).join('');

  // List
  const rows = filtered();
  $('#ax-count').textContent = `${rows.length} ${rows.length === 1 ? 'item' : 'items'}`;

  const list = $('#pb-list');
  if (!rows.length) {
    list.innerHTML = `<div class="pb-empty">Nothing matches. Loosen a filter, or tap "+ New item" to add one.</div>`;
    return;
  }
  list.innerHTML = rows.map(itemCard).join('');
}

function itemCard(it) {
  const scopeBadge = `<span class="badge scope-${esc(it.scope)}">${esc(it.scope.replace('-', ' '))}</span>`;
  const typeBadge  = `<span class="badge type">${esc(labelType(it.item_type))}</span>`;
  const pinBadge   = it.is_pinned ? `<span class="badge pin">Pinned</span>` : '';
  const expBadge   = it.expires_at ? `<span class="badge expires">Expires ${esc(it.expires_at)}</span>` : '';
  const tags = (it.tags || []).slice(0, 8).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  const summary = it.summary || (it.body_markdown ? it.body_markdown.slice(0, 280) + (it.body_markdown.length > 280 ? '…' : '') : '');
  const foot = [
    it.category    ? `<span><span class="v">${esc(it.category)}</span></span>` : '',
    it.subcategory ? `<span>${esc(it.subcategory)}</span>` : '',
    it.priority != null ? `<span>Priority ${esc(it.priority)}</span>` : '',
    it.updated_at  ? `<span>Updated ${fromNow(it.updated_at)}</span>` : '',
  ].filter(Boolean).join('');
  // Card body → view sheet. Edit pencil → edit sheet (does not also fire view).
  return `<div class="pb-card ${it.is_pinned ? 'pinned' : ''}" data-action="view" data-id="${it.id}">
    <button class="card-edit" data-action="edit" data-id="${it.id}" title="Edit">Edit</button>
    <div class="meta-row">${scopeBadge}${typeBadge}${pinBadge}${expBadge}</div>
    <h3>${esc(it.title)}</h3>
    ${summary ? `<div class="summary">${esc(summary)}</div>` : ''}
    ${tags ? `<div class="tags">${tags}</div>` : ''}
    ${foot ? `<div class="footline">${foot}</div>` : ''}
  </div>`;
}

// Minimal markdown renderer — enough for the body field's typical content.
function renderMd(text) {
  if (!text) return '';
  let h = String(text).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  // Inline (bold > italic order matters because ** also matches *)
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
       .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
       .replace(/`([^`\n]+?)`/g, '<code>$1</code>');
  // Headers
  h = h.replace(/^### +(.+)$/gm, '<h4>$1</h4>')
       .replace(/^## +(.+)$/gm,  '<h3>$1</h3>');
  // Bullet lists (contiguous "- " or "* " lines)
  h = h.replace(/(?:^|\n)((?:[-*] .+(?:\n|$))+)/g, (_m, group) => {
    const items = group.trim().split('\n').map(l => l.replace(/^[-*] /, '')).map(l => `<li>${l}</li>`).join('');
    return `\n<ul>${items}</ul>`;
  });
  // Paragraphs from blank-line splits
  return h.split(/\n\s*\n/).map(p => {
    const trimmed = p.trim();
    if (!trimmed) return '';
    if (/^<(h\d|ul|ol|pre)/.test(trimmed)) return trimmed;
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

function itemView(it) {
  const scopeBadge = `<span class="badge scope-${esc(it.scope)}">${esc(it.scope.replace('-', ' '))}</span>`;
  const typeBadge  = `<span class="badge type">${esc(labelType(it.item_type))}</span>`;
  const pinBadge   = it.is_pinned ? `<span class="badge pin">Pinned</span>` : '';
  const expBadge   = it.expires_at ? `<span class="badge expires">Expires ${esc(it.expires_at)}</span>` : '';
  const tags = (it.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  const foot = [
    it.category    ? `<span>${esc(it.category)}</span>` : '',
    it.subcategory ? `<span>${esc(it.subcategory)}</span>` : '',
    it.priority != null ? `<span>Priority ${esc(it.priority)}</span>` : '',
    it.updated_at  ? `<span>Updated ${fromNow(it.updated_at)}</span>` : '',
  ].filter(Boolean).join(' · ');
  return `<div class="pb-view">
    <div class="meta-row">${scopeBadge}${typeBadge}${pinBadge}${expBadge}</div>
    <h2 style="font-size:1.5rem;line-height:1.2;margin:0 0 1rem">${esc(it.title)}</h2>
    ${it.summary ? `<p class="pb-summary">${esc(it.summary)}</p>` : ''}
    ${it.body_markdown ? `<div class="pb-body">${renderMd(it.body_markdown)}</div>` : ''}
    ${tags ? `<div class="tags" style="margin-top:1rem">${tags}</div>` : ''}
    ${foot ? `<div class="footline" style="margin-top:1rem">${foot}</div>` : ''}
    ${it.source_vault_path ? `<div class="hint" style="margin-top:1rem">Source: ${esc(it.source_vault_path)}${it.source_anchor ? ' · ' + esc(it.source_anchor) : ''}</div>` : ''}
    <div style="display:flex;gap:.5rem;margin-top:1.4rem">
      <button class="btn-rust" data-action="edit" data-id="${it.id}" style="flex:1">Edit</button>
      <button class="btn-ghost" data-action="close" style="flex:1">Close</button>
    </div>
  </div>`;
}

// ---------- Filter / search interaction ----------
document.addEventListener('click', e => {
  const t = e.target.closest('[data-filter]');
  if (!t) return;
  const f = t.dataset.filter, v = t.dataset.v;
  if (f === 'scope') { state.filters.scope = v; state.filters.type = 'all'; }
  else if (f === 'type')   state.filters.type = v;
  else if (f === 'pinned') state.filters.pinned = !state.filters.pinned;

  // Visual on-state for sibling pills
  if (f === 'scope') $$('[data-filter="scope"]').forEach(p => p.classList.toggle('on', p.dataset.v === state.filters.scope));
  if (f === 'pinned') t.classList.toggle('on', state.filters.pinned);
  render();
});

$('#q').addEventListener('input', e => {
  state.q = e.target.value;
  render();
});

// ---------- Forms ----------
function itemForm(it) {
  const editing = !!it;
  const scopeOpts = SCOPES.map(s => `<option value="${s}" ${it?.scope === s ? 'selected' : ''}>${s}</option>`).join('');
  const typeChoices = Object.keys(TYPE_LABELS);
  // If the row uses a type we don't have a label for, include it so it doesn't disappear on edit
  if (it?.item_type && !typeChoices.includes(it.item_type)) typeChoices.push(it.item_type);
  const typeOpts = typeChoices.map(t => `<option value="${t}" ${it?.item_type === t ? 'selected' : ''}>${esc(labelType(t))}</option>`).join('');
  const tagsStr = (it?.tags || []).join(', ');

  return `<h2>${editing ? 'Edit item' : 'New playbook item'}</h2>
    <form id="pb-form" data-id="${it?.id || ''}">
      <div class="grid-2">
        <div class="field"><label>Scope</label><select name="scope" required>${scopeOpts || '<option value="personal-brand">personal-brand</option><option value="plugverse">plugverse</option><option value="both">both</option>'}</select></div>
        <div class="field"><label>Type</label><select name="item_type" required>${typeOpts}</select></div>
      </div>
      <div class="field"><label>Title</label><input name="title" required value="${esc(it?.title || '')}" placeholder="One-line title"></div>
      <div class="field"><label>Summary (optional)</label><textarea name="summary" rows="2" placeholder="A sentence or two">${esc(it?.summary || '')}</textarea></div>
      <div class="field"><label>Body (markdown, optional)</label><textarea name="body_markdown" rows="6" placeholder="Longer notes, examples, alternates…">${esc(it?.body_markdown || '')}</textarea></div>
      <div class="grid-2">
        <div class="field"><label>Category</label><input name="category" value="${esc(it?.category || '')}" placeholder="e.g. voice, hooks"></div>
        <div class="field"><label>Subcategory</label><input name="subcategory" value="${esc(it?.subcategory || '')}" placeholder="optional"></div>
      </div>
      <div class="field"><label>Tags (comma-separated)</label><input name="tags" value="${esc(tagsStr)}" placeholder="cut, identity, philosophy"></div>
      <div class="grid-2">
        <div class="field"><label>Priority (lower = higher)</label><input name="priority" type="number" value="${it?.priority ?? 100}"></div>
        <div class="field"><label>Expires (optional)</label><input name="expires_at" type="date" value="${esc(it?.expires_at || '')}"></div>
      </div>
      <label class="toggle-row">
        <input type="checkbox" name="is_pinned" ${it?.is_pinned ? 'checked' : ''}>
        <span>Pinned (rises to top, rust border)</span>
      </label>
      <button class="btn-rust" type="submit" style="margin-top:.9rem">${editing ? 'Save changes' : 'Create item'}</button>
      ${editing ? '<button class="btn-danger" type="button" data-action="delete">Soft-delete this item</button>' : ''}
      <button class="btn-ghost" type="button" data-action="close">Cancel</button>
      ${editing && it.source_vault_path ? `<div class="hint">Source: ${esc(it.source_vault_path)}${it.source_anchor ? ' · ' + esc(it.source_anchor) : ''}</div>` : ''}
    </form>`;
}

// ---------- Click dispatch ----------
document.addEventListener('click', async e => {
  // Stop card-click "view" from firing when the user clicked the inner Edit pencil.
  const editBtn = e.target.closest('.card-edit');
  if (editBtn) e.stopPropagation();

  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;
  if (a === 'close')    return closeSheet();
  if (a === 'new-item') return openSheet(itemForm(null));
  if (a === 'view') {
    const it = state.items.find(x => x.id === t.dataset.id);
    if (it) openSheet(itemView(it));
    return;
  }
  if (a === 'edit') {
    const it = state.items.find(x => x.id === t.dataset.id);
    if (it) openSheet(itemForm(it));
    return;
  }
  if (a === 'delete') {
    const id = $('#pb-form').dataset.id;
    if (!id) return;
    if (!confirm('Soft-delete this item? It will hide from the playbook but stay in the DB.')) return;
    const { error } = await sb.from('playbook_items').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast(error.message, 'err');
    toast('Deleted', 'ok');
    closeSheet();
    await loadAll();
  }
});

// ---------- Submit ----------
document.addEventListener('submit', async e => {
  if (e.target.id !== 'pb-form') return;
  e.preventDefault();
  const f = e.target;
  const fd = new FormData(f);
  const payload = {
    scope:         fd.get('scope'),
    item_type:     fd.get('item_type'),
    title:         (fd.get('title') || '').trim(),
    summary:       (fd.get('summary') || '').trim() || null,
    body_markdown: (fd.get('body_markdown') || '').trim() || null,
    category:      (fd.get('category') || '').trim() || null,
    subcategory:   (fd.get('subcategory') || '').trim() || null,
    tags:          parseTags(fd.get('tags')),
    priority:      Number(fd.get('priority') || 100),
    is_pinned:     fd.get('is_pinned') === 'on',
    expires_at:    (fd.get('expires_at') || '').trim() || null,
  };
  if (!payload.title) { toast('Title is required', 'err'); return; }
  const id = f.dataset.id;
  let res;
  if (id) {
    res = await sb.from('playbook_items').update(payload).eq('id', id);
  } else {
    res = await sb.from('playbook_items').insert(payload);
  }
  if (res.error) return toast(res.error.message, 'err');
  toast(id ? 'Saved' : 'Created', 'ok');
  closeSheet();
  await loadAll();
});

// ---------- Realtime ----------
const indicator = $('#live-indicator');
subscribeTable('playbook_items', () => {
  indicator.textContent = 'Live · updated';
  loadAll().then(() => setTimeout(() => indicator.textContent = 'Live syncing', 1800));
});

await loadAll();
