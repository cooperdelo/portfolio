// =====================================================================
// /admin/contacts/_js/contacts.js
// Pipeline + network vault. Reads v_contacts_active for the main list,
// v_contacts_due_today for the "Due this week" strip, v_contacts_stale
// for "Going cold". Writes back to plugverse_contacts. Soft-delete via
// deleted_at. Realtime on plugverse_contacts → atomic updates show up
// on the open admin tab within ~350ms.
// Mirrors the Playbook page's architecture exactly.
// =====================================================================
import { sb, subscribeTable } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';

await mountShell({ title: 'Contacts · Pipeline' });

// ---------- Stage / type vocabulary ----------
const STAGES = ['identified', 'engaged', 'contacted', 'demo', 'committed', 'team', 'dead'];
const STAGE_LABELS = {
  identified: 'Identified',
  engaged:    'Engaged',
  contacted:  'Contacted',
  demo:       'Demo',
  committed:  'Committed',
  team:       'Team',
  dead:       'Dead',
};
const PIPELINE_TYPES = ['artist', 'organizer', 'venue', 'partnership', 'team'];
const ACTIVE_PIPELINE = new Set(['engaged', 'contacted', 'demo', 'committed']);

// ---------- State ----------
const state = {
  items: [],
  due: [],
  cold: [],
  filters: { stage: 'all', type: 'all', college: 'all', pinned: false },
  q: '',
  sort: 'due',
};

// ---------- Helpers ----------
const $  = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => [...el.querySelectorAll(q)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const labelStage = s => STAGE_LABELS[s] || cap(String(s || ''));
const todayISO = () => new Date().toISOString().slice(0, 10);

const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);
const daysAgo = d => d ? daysBetween(d, new Date()) : null;
const daysUntil = d => d ? daysBetween(new Date(), d) : null;

const fromNow = d => {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60)    return s + 's ago';
  if (s < 3600)  return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  const days = Math.floor(s / 86400);
  return days < 7 ? days + 'd ago' : (new Date(d)).toLocaleDateString('en-US', { month:'short', day:'numeric' });
};
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '';
const dueLabel = d => {
  const n = daysUntil(d);
  if (n == null) return '';
  if (n < 0)  return `Overdue ${-n}d`;
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  return `Due in ${n}d`;
};
const staleLabel = d => {
  const n = daysAgo(d);
  if (n == null) return 'Never contacted';
  if (n === 0) return 'Contacted today';
  if (n === 1) return '1d since contact';
  return `${n}d since contact`;
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
  const [activeRes, dueRes, coldRes] = await Promise.all([
    sb.from('v_contacts_active').select('*'),
    sb.from('v_contacts_due_today').select('*'),
    sb.from('v_contacts_stale').select('*').limit(8),
  ]);
  if (activeRes.error) {
    toast('Failed to load contacts: ' + activeRes.error.message, 'err');
    return;
  }
  state.items = activeRes.data || [];
  state.due   = dueRes.data || [];
  state.cold  = coldRes.data || [];
  render();
}

// ---------- Filtering / sorting ----------
function filtered() {
  const q = state.q.trim().toLowerCase();
  let rows = state.items.filter(it => {
    if (state.filters.stage   !== 'all' && it.pipeline_stage !== state.filters.stage) return false;
    if (state.filters.type    !== 'all' && it.pipeline_type  !== state.filters.type) return false;
    if (state.filters.college !== 'all' && it.college        !== state.filters.college) return false;
    if (state.filters.pinned && !it.is_pinned) return false;
    if (q) {
      const hay = [
        it.full_name, it.preferred_name, it.role, it.title, it.organization,
        it.college, it.org_type, it.notes, it.next_step, it.warm_path,
        it.email, it.phone, it.instagram, it.twitter, it.linkedin,
        (it.tags || []).join(' '),
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sortFns = {
    due: (a, b) => {
      const ad = a.next_step_due ? new Date(a.next_step_due).getTime() : Infinity;
      const bd = b.next_step_due ? new Date(b.next_step_due).getTime() : Infinity;
      return ad - bd;
    },
    recent: (a, b) => (new Date(b.last_contacted || 0)) - (new Date(a.last_contacted || 0)),
    stale: (a, b) => {
      const ad = a.last_contacted ? new Date(a.last_contacted).getTime() : 0;
      const bd = b.last_contacted ? new Date(b.last_contacted).getTime() : 0;
      return ad - bd;
    },
    priority: (a, b) => (a.priority ?? 100) - (b.priority ?? 100),
    name: (a, b) => String(a.full_name).localeCompare(b.full_name),
    org:  (a, b) => String(a.organization || '').localeCompare(b.organization || ''),
  };
  rows.sort(sortFns[state.sort] || sortFns.due);
  // Pinned always floats to the top regardless of sort
  rows.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
  return rows;
}

// ---------- Render ----------
function render() {
  // KPIs
  $('#k-total').textContent  = state.items.length;
  $('#k-pinned').textContent = state.items.filter(x => x.is_pinned).length;
  $('#k-pipe').textContent   = state.items.filter(x => ACTIVE_PIPELINE.has(x.pipeline_stage)).length;
  const totalOwed = state.items.reduce((a, x) => a + Number(x.payout_owed || 0), 0);
  $('#k-owed').textContent   = totalOwed > 0 ? '$' + totalOwed.toFixed(0) : '$0';

  // Alert strips
  renderDue();
  renderCold();

  // Filter pills (rebuilt with counts)
  renderStagePills();
  renderTypePills();
  renderCollegePills();

  // List
  const rows = filtered();
  $('#ax-count').textContent = `${rows.length} ${rows.length === 1 ? 'contact' : 'contacts'}`;

  const list = $('#ct-list');
  if (!rows.length) {
    list.innerHTML = `<div class="ct-empty">Nothing matches. Loosen a filter, or tap "+ New contact".</div>`;
    return;
  }
  list.innerHTML = rows.map(contactCard).join('');
}

function renderDue() {
  $('#due-n').textContent = state.due.length;
  const top = state.due.slice(0, 6);
  $('#due-list').innerHTML = top.length
    ? top.map(r => {
        const n = Number(r.days_until_due);
        const overdue = n < 0;
        const lbl = overdue ? `Overdue ${-n}d` : (n === 0 ? 'Today' : (n === 1 ? 'Tomorrow' : `In ${n}d`));
        return `<div class="row" data-action="view" data-id="${r.id}">
          <div class="who">${esc(r.full_name)}<small>${esc(r.organization || '')}${r.next_step ? ' · ' + esc(r.next_step) : ''}</small></div>
          <div class="when ${overdue ? 'overdue' : ''}">${lbl}</div>
        </div>`;
      }).join('')
    : `<div class="empty">Clear — no upcoming next-steps.</div>`;
}

function renderCold() {
  $('#cold-n').textContent = state.cold.length;
  const top = state.cold.slice(0, 6);
  $('#cold-list').innerHTML = top.length
    ? top.map(r => {
        const n = r.days_since_contact == null ? null : Number(r.days_since_contact);
        const lbl = n == null ? 'Never' : `${n}d cold`;
        return `<div class="row" data-action="view" data-id="${r.id}">
          <div class="who">${esc(r.full_name)}<small>${esc(r.organization || '')} · ${esc(labelStage(r.pipeline_stage))}</small></div>
          <div class="when">${lbl}</div>
        </div>`;
      }).join('')
    : `<div class="empty">No cold leads in the active pipeline.</div>`;
}

function renderStagePills() {
  // Count from full items (not filtered) so the badge counts don't shift when other filters change
  const counts = { all: state.items.length };
  for (const s of STAGES) counts[s] = state.items.filter(x => x.pipeline_stage === s).length;
  $('#stage-row').innerHTML =
    `<span class="lbl">Stage</span>` +
    `<button class="pill ${state.filters.stage === 'all' ? 'on' : ''}" data-filter="stage" data-v="all">All <span class="n">${counts.all}</span></button>` +
    STAGES.map(s =>
      `<button class="pill ${state.filters.stage === s ? 'on' : ''}" data-filter="stage" data-v="${esc(s)}">${esc(labelStage(s))} <span class="n">${counts[s]}</span></button>`
    ).join('');
}

function renderTypePills() {
  const present = [...new Set(state.items.map(x => x.pipeline_type).filter(Boolean))]
    .sort((a, b) => state.items.filter(x => x.pipeline_type === b).length - state.items.filter(x => x.pipeline_type === a).length);
  // Always include canonical types even when empty (so adding new ones doesn't feel hidden)
  for (const t of PIPELINE_TYPES) if (!present.includes(t)) present.push(t);
  $('#type-row').innerHTML =
    `<span class="lbl">Type</span>` +
    `<button class="pill ${state.filters.type === 'all' ? 'on' : ''}" data-filter="type" data-v="all">All</button>` +
    present.map(t => {
      const n = state.items.filter(x => x.pipeline_type === t).length;
      return `<button class="pill ${state.filters.type === t ? 'on' : ''}" data-filter="type" data-v="${esc(t)}">${esc(cap(t))} <span class="n">${n}</span></button>`;
    }).join('');
}

function renderCollegePills() {
  const counts = {};
  for (const x of state.items) if (x.college) counts[x.college] = (counts[x.college] || 0) + 1;
  const colleges = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  $('#college-row').innerHTML =
    `<span class="lbl">College</span>` +
    `<button class="pill ${state.filters.college === 'all' ? 'on' : ''}" data-filter="college" data-v="all">All</button>` +
    colleges.map(c =>
      `<button class="pill ${state.filters.college === c ? 'on' : ''}" data-filter="college" data-v="${esc(c)}">${esc(c)} <span class="n">${counts[c]}</span></button>`
    ).join('');
}

function contactCard(c) {
  const stageBadge = c.pipeline_stage ? `<span class="badge stage-${esc(c.pipeline_stage)}">${esc(labelStage(c.pipeline_stage))}</span>` : '';
  const typeBadge  = c.pipeline_type  ? `<span class="badge type">${esc(cap(c.pipeline_type))}</span>` : '';
  const pinBadge   = c.is_pinned ? `<span class="badge pin">Pinned</span>` : '';
  const owedBadge  = Number(c.payout_owed) > 0 ? `<span class="badge owed">$${Number(c.payout_owed).toFixed(0)} owed</span>` : '';
  const pref = c.preferred_name && c.preferred_name !== c.full_name ? `<span class="pref">"${esc(c.preferred_name)}"</span>` : '';
  const where = [
    c.role || c.title ? `<strong>${esc(c.role || c.title)}</strong>` : '',
    c.organization ? esc(c.organization) : '',
    c.college ? esc(c.college) : '',
  ].filter(Boolean).join(' · ');
  let next = '';
  if (c.next_step) {
    const n = daysUntil(c.next_step_due);
    const cls = n != null && n < 0 ? 'overdue' : '';
    const when = c.next_step_due ? `<span class="when ${cls}">${esc(dueLabel(c.next_step_due))}</span>` : '';
    next = `<div class="next">${when}${esc(c.next_step)}</div>`;
  }
  const foot = [
    c.warm_path     ? `<span><span class="v">${esc(c.warm_path)}</span></span>` : '',
    c.last_contacted ? `<span>${esc(staleLabel(c.last_contacted))}</span>` : (c.next_step_due ? '' : `<span>Never contacted</span>`),
    c.referred_by_name ? `<span>Ref: ${esc(c.referred_by_name)}</span>` : '',
    c.bookings_attributed > 0 ? `<span>${c.bookings_attributed} booking${c.bookings_attributed === 1 ? '' : 's'}</span>` : '',
  ].filter(Boolean).join('');
  return `<div class="ct-card ${c.is_pinned ? 'pinned' : ''}" data-action="view" data-id="${c.id}">
    <button class="card-edit" data-action="edit" data-id="${c.id}" title="Edit">Edit</button>
    <div class="meta-row">${stageBadge}${typeBadge}${pinBadge}${owedBadge}</div>
    <h3>${esc(c.full_name)}${pref}</h3>
    ${where ? `<div class="where">${where}</div>` : ''}
    ${next}
    ${foot ? `<div class="footline">${foot}</div>` : ''}
  </div>`;
}

// ---------- Drawer (read-only contact view) ----------
function contactView(c) {
  const stageBadge = c.pipeline_stage ? `<span class="badge stage-${esc(c.pipeline_stage)}">${esc(labelStage(c.pipeline_stage))}</span>` : '';
  const typeBadge  = c.pipeline_type  ? `<span class="badge type">${esc(cap(c.pipeline_type))}</span>` : '';
  const pinBadge   = c.is_pinned ? `<span class="badge pin">Pinned</span>` : '';
  const owedBadge  = Number(c.payout_owed) > 0 ? `<span class="badge owed">$${Number(c.payout_owed).toFixed(0)} owed</span>` : '';

  // Inline pipeline editor — pills mutate the row immediately
  const stagePills = STAGES.map(s =>
    `<button class="pill ${c.pipeline_stage === s ? 'on' : ''}" data-pipe-set="${esc(s)}">${esc(labelStage(s))}</button>`
  ).join('');

  // Copy chips — only show ones with values
  const copyChips = [
    c.email     ? { lbl: 'Email',    val: c.email, copy: c.email } : null,
    c.phone     ? { lbl: 'Phone',    val: c.phone, copy: c.phone } : null,
    c.instagram ? { lbl: 'Instagram', val: '@' + String(c.instagram).replace(/^@/, ''), copy: '@' + String(c.instagram).replace(/^@/, '') } : null,
    c.twitter   ? { lbl: 'Twitter / X', val: '@' + String(c.twitter).replace(/^@/, ''), copy: '@' + String(c.twitter).replace(/^@/, '') } : null,
    c.linkedin  ? { lbl: 'LinkedIn', val: c.linkedin, copy: c.linkedin } : null,
  ].filter(Boolean);
  const otherLinks = c.other_links && typeof c.other_links === 'object'
    ? Object.entries(c.other_links).map(([k, v]) => ({ lbl: k, val: v, copy: v }))
    : [];
  const allCopy = [...copyChips, ...otherLinks];
  const copyGrid = allCopy.length
    ? `<div class="copy-grid">${allCopy.map((x, i) => `
        <button class="copy-chip" data-copy="${esc(x.copy)}" data-copy-id="${i}" title="Click to copy">
          <span class="lbl">${esc(x.lbl)}</span>
          <span class="val">${esc(x.val)}</span>
        </button>`).join('')}</div>`
    : '';

  const activity = `
    <div class="activity-line">
      <div class="ax">
        <div class="lbl">Last contacted</div>
        <div class="val ${c.last_contacted ? 'muted' : 'warn'}">${c.last_contacted ? (fmtDate(c.last_contacted) + ' · ' + staleLabel(c.last_contacted)) : 'Never'}</div>
      </div>
      <div class="ax">
        <div class="lbl">Warm path</div>
        <div class="val muted">${esc(c.warm_path || '—')}</div>
      </div>
    </div>`;

  const nextBlock = c.next_step ? `
    <div class="next-block">
      <div class="lbl">Next step</div>
      <div class="val">${esc(c.next_step)}</div>
      ${c.next_step_due ? `<div class="due">${esc(fmtDate(c.next_step_due))} · ${esc(dueLabel(c.next_step_due))}</div>` : ''}
    </div>` : '';

  const tags = (c.tags || []).length ? `<div class="tags-row">${(c.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : '';
  const notes = c.notes ? `<div class="notes-block">${esc(c.notes)}</div>` : '';

  const referral = c.referred_by_name ? `
    <div class="hint" style="margin:0 0 1rem;opacity:1;color:var(--ink-2)">Referred by ${esc(c.referred_by_name)} · ${c.bookings_attributed || 0} bookings · $${Number(c.payout_owed || 0).toFixed(0)} owed</div>` : '';

  return `<div class="ct-view" data-id="${c.id}">
    <div class="meta-row">${stageBadge}${typeBadge}${pinBadge}${owedBadge}</div>
    <h2 class="vname">${esc(c.full_name)}${c.preferred_name && c.preferred_name !== c.full_name ? ` <span style="font-weight:400;color:var(--ink-2);font-size:1rem">"${esc(c.preferred_name)}"</span>` : ''}</h2>
    ${(c.role || c.title || c.organization || c.college) ? `<div class="vrole">${[
        c.role || c.title ? `<strong>${esc(c.role || c.title)}</strong>` : '',
        c.organization ? esc(c.organization) : '',
        c.college ? esc(c.college) : '',
      ].filter(Boolean).join(' · ')}</div>` : ''}
    ${referral}

    <div class="pipe-edit">
      <div class="pe-lbl">Pipeline stage · click to update</div>
      <div class="pe-row">${stagePills}</div>
    </div>

    ${copyGrid}
    ${activity}
    ${nextBlock}
    ${tags}
    ${notes}

    <div class="action-bar">
      <button class="btn-rust" data-action="mark-contacted-today">Mark contacted today</button>
      <button class="btn-ghost" data-action="edit" data-id="${c.id}">Edit details</button>
    </div>
    <button class="btn-ghost" data-action="close" style="margin-top:.55rem">Close</button>
    ${c.source_vault_path ? `<div class="hint" style="margin-top:1rem">Source: ${esc(c.source_vault_path)}</div>` : ''}
  </div>`;
}

// ---------- Form (create / edit) ----------
function contactForm(c) {
  const editing = !!c;
  const stageOpts = STAGES.map(s => `<option value="${s}" ${c?.pipeline_stage === s ? 'selected' : ''}>${labelStage(s)}</option>`).join('');
  const typeChoices = [...PIPELINE_TYPES];
  if (c?.pipeline_type && !typeChoices.includes(c.pipeline_type)) typeChoices.push(c.pipeline_type);
  const typeOpts = `<option value="" ${!c?.pipeline_type ? 'selected' : ''}>—</option>` +
    typeChoices.map(t => `<option value="${t}" ${c?.pipeline_type === t ? 'selected' : ''}>${cap(t)}</option>`).join('');
  const tagsStr = (c?.tags || []).join(', ');

  return `<h2>${editing ? 'Edit contact' : 'New contact'}</h2>
    <p class="sub">${editing ? 'Updates land in the vault and across all open admin tabs in &lt;1s.' : 'New contacts also feed the alert strips at the top.'}</p>
    <form id="ct-form" data-id="${c?.id || ''}">
      <div class="grid-2">
        <div class="field"><label>Full name *</label><input name="full_name" required value="${esc(c?.full_name || '')}" placeholder="e.g. Kendall Smith"></div>
        <div class="field"><label>Preferred name</label><input name="preferred_name" value="${esc(c?.preferred_name || '')}" placeholder="optional"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Role</label><input name="role" value="${esc(c?.role || '')}" placeholder="e.g. President, Booker"></div>
        <div class="field"><label>Title</label><input name="title" value="${esc(c?.title || '')}" placeholder="optional"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Organization</label><input name="organization" value="${esc(c?.organization || '')}" placeholder="e.g. Beta Theta Pi"></div>
        <div class="field"><label>Org type</label><input name="org_type" value="${esc(c?.org_type || '')}" placeholder="e.g. greek-org, venue"></div>
      </div>
      <div class="field"><label>College</label><input name="college" value="${esc(c?.college || '')}" placeholder="e.g. UNC"></div>

      <div class="grid-2">
        <div class="field"><label>Email</label><input name="email" type="email" value="${esc(c?.email || '')}" placeholder="name@example.com"></div>
        <div class="field"><label>Phone</label><input name="phone" type="tel" value="${esc(c?.phone || '')}" placeholder="+1 555 123 4567"></div>
      </div>
      <div class="grid-3">
        <div class="field"><label>Instagram</label><input name="instagram" value="${esc(c?.instagram || '')}" placeholder="@handle"></div>
        <div class="field"><label>Twitter / X</label><input name="twitter" value="${esc(c?.twitter || '')}" placeholder="@handle"></div>
        <div class="field"><label>LinkedIn</label><input name="linkedin" value="${esc(c?.linkedin || '')}" placeholder="URL or slug"></div>
      </div>

      <div class="grid-2">
        <div class="field"><label>Pipeline stage</label><select name="pipeline_stage"><option value="">—</option>${stageOpts}</select></div>
        <div class="field"><label>Pipeline type</label><select name="pipeline_type">${typeOpts}</select></div>
      </div>
      <div class="field"><label>Warm path</label><input name="warm_path" value="${esc(c?.warm_path || '')}" placeholder="e.g. Cooper direct, Kendall intro"></div>

      <div class="grid-2">
        <div class="field"><label>Last contacted</label><input name="last_contacted" type="date" value="${esc(c?.last_contacted || '')}"></div>
        <div class="field"><label>Next step due</label><input name="next_step_due" type="date" value="${esc(c?.next_step_due || '')}"></div>
      </div>
      <div class="field"><label>Next step</label><input name="next_step" value="${esc(c?.next_step || '')}" placeholder="What's the next move?"></div>

      <div class="field"><label>Notes</label><textarea name="notes" rows="4" placeholder="Context, history, alternates…">${esc(c?.notes || '')}</textarea></div>
      <div class="field"><label>Tags (comma-separated)</label><input name="tags" value="${esc(tagsStr)}" placeholder="referral, hot, spring-2026"></div>

      <div class="grid-3">
        <div class="field"><label>Bookings attributed</label><input name="bookings_attributed" type="number" min="0" value="${c?.bookings_attributed ?? 0}"></div>
        <div class="field"><label>Payout owed ($)</label><input name="payout_owed" type="number" step="0.01" min="0" value="${c?.payout_owed ?? 0}"></div>
        <div class="field"><label>Priority</label><input name="priority" type="number" value="${c?.priority ?? 100}"></div>
      </div>

      <label class="toggle-row">
        <input type="checkbox" name="is_pinned" ${c?.is_pinned ? 'checked' : ''}>
        <span>Pinned (rises to top, rust border)</span>
      </label>

      <button class="btn-rust" type="submit" style="margin-top:.9rem">${editing ? 'Save changes' : 'Create contact'}</button>
      ${editing ? '<button class="btn-danger" type="button" data-action="delete">Soft-delete this contact</button>' : ''}
      <button class="btn-ghost" type="button" data-action="close">Cancel</button>
    </form>`;
}

// ---------- Filter interactions ----------
document.addEventListener('click', e => {
  const t = e.target.closest('[data-filter]');
  if (!t) return;
  const f = t.dataset.filter, v = t.dataset.v;
  if (f === 'stage')   state.filters.stage   = v;
  if (f === 'type')    state.filters.type    = v;
  if (f === 'college') state.filters.college = v;
  if (f === 'pinned')  state.filters.pinned  = !state.filters.pinned;
  if (f === 'pinned')  t.classList.toggle('on', state.filters.pinned);
  render();
});

$('#q').addEventListener('input', e => { state.q = e.target.value; render(); });
$('#sort').addEventListener('change', e => { state.sort = e.target.value; render(); });

// ---------- Inline pipeline pills (in drawer) ----------
document.addEventListener('click', async e => {
  const pe = e.target.closest('[data-pipe-set]');
  if (!pe) return;
  e.stopPropagation();
  const newStage = pe.dataset.pipeSet;
  const view = pe.closest('.ct-view');
  const id = view?.dataset.id;
  if (!id) return;
  // Optimistic visual
  view.querySelectorAll('[data-pipe-set]').forEach(b => b.classList.toggle('on', b.dataset.pipeSet === newStage));
  const { error } = await sb.from('plugverse_contacts').update({ pipeline_stage: newStage }).eq('id', id);
  if (error) { toast('Stage update failed: ' + error.message, 'err'); return; }
  toast(`Stage → ${labelStage(newStage)}`, 'ok');
  // Refresh underlying data; drawer stays open with optimistic state.
  await loadAll();
  // Update the badge in the open drawer
  const newC = state.items.find(x => x.id === id);
  if (newC) {
    const badge = view.querySelector('.badge[class*="stage-"]');
    if (badge) {
      badge.className = `badge stage-${newC.pipeline_stage}`;
      badge.textContent = labelStage(newC.pipeline_stage);
    }
  }
});

// ---------- Copy chips ----------
document.addEventListener('click', async e => {
  const chip = e.target.closest('[data-copy]');
  if (!chip) return;
  e.stopPropagation();
  const text = chip.dataset.copy;
  try {
    await navigator.clipboard.writeText(text);
    chip.classList.add('copied');
    const orig = chip.querySelector('.lbl').textContent;
    chip.querySelector('.lbl').textContent = 'Copied';
    setTimeout(() => { chip.classList.remove('copied'); chip.querySelector('.lbl').textContent = orig; }, 1400);
  } catch {
    toast('Copy failed — select manually', 'err');
  }
});

// ---------- Generic click dispatch ----------
document.addEventListener('click', async e => {
  // Stop card-click "view" from firing when user clicked the inner Edit chip
  const editBtn = e.target.closest('.card-edit');
  if (editBtn) e.stopPropagation();

  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;
  if (a === 'close')         return closeSheet();
  if (a === 'new-contact')   return openSheet(contactForm(null));
  if (a === 'view') {
    const c = state.items.find(x => x.id === t.dataset.id);
    if (c) openSheet(contactView(c));
    return;
  }
  if (a === 'edit') {
    const c = state.items.find(x => x.id === t.dataset.id);
    if (c) openSheet(contactForm(c));
    return;
  }
  if (a === 'mark-contacted-today') {
    const view = t.closest('.ct-view');
    const id = view?.dataset.id;
    if (!id) return;
    const { error } = await sb.from('plugverse_contacts').update({ last_contacted: todayISO() }).eq('id', id);
    if (error) return toast('Update failed: ' + error.message, 'err');
    toast('Marked contacted today', 'ok');
    await loadAll();
    const fresh = state.items.find(x => x.id === id);
    if (fresh) openSheet(contactView(fresh));
    return;
  }
  if (a === 'delete') {
    const id = $('#ct-form')?.dataset.id;
    if (!id) return;
    if (!confirm('Soft-delete this contact? It will hide from the list but stay in the DB.')) return;
    const { error } = await sb.from('plugverse_contacts').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast(error.message, 'err');
    toast('Deleted', 'ok');
    closeSheet();
    await loadAll();
  }
});

// ---------- Submit ----------
document.addEventListener('submit', async e => {
  if (e.target.id !== 'ct-form') return;
  e.preventDefault();
  const f = e.target;
  const fd = new FormData(f);
  const payload = {
    full_name:           (fd.get('full_name') || '').trim(),
    preferred_name:      (fd.get('preferred_name') || '').trim() || null,
    role:                (fd.get('role') || '').trim() || null,
    title:               (fd.get('title') || '').trim() || null,
    organization:        (fd.get('organization') || '').trim() || null,
    org_type:            (fd.get('org_type') || '').trim() || null,
    college:             (fd.get('college') || '').trim() || null,
    email:               (fd.get('email') || '').trim() || null,
    phone:               (fd.get('phone') || '').trim() || null,
    instagram:           (fd.get('instagram') || '').trim() || null,
    twitter:             (fd.get('twitter') || '').trim() || null,
    linkedin:            (fd.get('linkedin') || '').trim() || null,
    pipeline_stage:      (fd.get('pipeline_stage') || '').trim() || null,
    pipeline_type:       (fd.get('pipeline_type') || '').trim() || null,
    warm_path:           (fd.get('warm_path') || '').trim() || null,
    last_contacted:      (fd.get('last_contacted') || '').trim() || null,
    next_step:           (fd.get('next_step') || '').trim() || null,
    next_step_due:       (fd.get('next_step_due') || '').trim() || null,
    notes:               (fd.get('notes') || '').trim() || null,
    tags:                parseTags(fd.get('tags')),
    bookings_attributed: Number(fd.get('bookings_attributed') || 0),
    payout_owed:         Number(fd.get('payout_owed') || 0),
    priority:            Number(fd.get('priority') || 100),
    is_pinned:           fd.get('is_pinned') === 'on',
  };
  if (!payload.full_name) { toast('Full name is required', 'err'); return; }
  const id = f.dataset.id;
  let res;
  if (id) {
    res = await sb.from('plugverse_contacts').update(payload).eq('id', id);
  } else {
    res = await sb.from('plugverse_contacts').insert(payload);
  }
  if (res.error) return toast(res.error.message, 'err');
  toast(id ? 'Saved' : 'Created', 'ok');
  closeSheet();
  await loadAll();
});

// ---------- Realtime ----------
const indicator = $('#live-indicator');
subscribeTable('plugverse_contacts', () => {
  indicator.textContent = 'Live · updated';
  loadAll().then(() => setTimeout(() => indicator.textContent = 'Live syncing', 1800));
});

await loadAll();
