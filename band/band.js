// Shared band reviewer. One link per bandmate, one shared set of marks per clip. Saves on its own.
const K = new URLSearchParams(location.search).get("k") || "";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (t) => (t == null ? "—" : `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`);
const SHOTS = [["wide", "Wide"], ["medium", "Medium"], ["close", "Close"], ["lowangle", "Low angle"], ["pov", "POV"], ["static", "Static"], ["detail", "Detail"]];
const SUBJECTS = ["band", "crowd", "singer", "guitarist", "bassist", "drummer", "stage", "setup"].map((s) => [s, s[0].toUpperCase() + s.slice(1)]);
const CHIPS = { shot: SHOTS, subject: SUBJECTS };
let clips = [], marks = {}, confirmed = {}, show = "all", kind = "", gig = "", cur = -1, you = "", noteT = 0, noteId = "", advT = 0, toastT = 0;
const v = $("[data-video]"), img = $("[data-photo]"), track = $("[data-track]");

const blank = (id) => ({ asset: id, revision: 0, verdict: "unreviewed", note: "", start: null, end: null, band: false, broll: false, shot: null, subject: null });
const mk = (c) => marks[c.id] || blank(c.id);
const isPhoto = (c) => c?.kind === "photo";
const isKeep = (m) => m.verdict === "keep" || m.verdict === "favorite";
const visible = () => clips.filter((c) => (!gig || c.gig === gig) && (!kind || (isPhoto(c) ? "photo" : "video") === kind) && (show === "all" || mk(c).verdict === show));

async function load() {
  const r = await fetch(`/api/band-share?k=${encodeURIComponent(K)}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { $("[data-hi]").textContent = d.error || "This link isn't working."; return; }
  you = d.you; clips = (d.clips || []).map((c) => ({ ...c, kind: c.kind === "photo" ? "photo" : "video" })); marks = {};
  (d.marks || []).forEach((m) => (marks[m.asset] = { ...blank(m.asset), ...m, band: !!m.band, broll: !!m.broll, shot: m.shot || null, subject: m.subject || null }));
  const gigs = d.gigs?.length ? d.gigs : [...new Set(clips.map((c) => c.gig))];
  $("[data-hi]").textContent = `Hey ${you}. Pick the good stuff.`;
  $("[data-pile]").textContent = gigs.length ? `Your pile: ${gigs.join(", ")}` : "";
  $("[data-gig]").innerHTML = '<option value="">Every gig</option>' + gigs.map((g) => `<option>${esc(g)}</option>`).join("");
  if (gig && !gigs.includes(gig)) gig = "";
  $("[data-gig]").value = gig;
  confirmed = { ...marks };
  list(); progress();
  // On a laptop the player sits beside the list, so start on the first clip nobody has marked yet.
  if (cur < 0 && matchMedia("(min-width: 901px)").matches) { const first = clips.find((c) => c.url && mk(c).verdict === "unreviewed") || clips.find((c) => c.url); if (first) open(clips.indexOf(first)); }
}

function tagLine(m) {
  if (!isKeep(m)) return "";
  const t = [m.band && "Band post", m.broll && ["B-roll", m.shot && SHOTS.find((s) => s[0] === m.shot)?.[1], m.subject].filter(Boolean).join(" ")].filter(Boolean);
  return t.length ? ` · ${t.join(" · ")}` : "";
}
function list() {
  $("[data-list]").innerHTML = visible().map((c) => {
    const m = mk(c), photo = isPhoto(c), src = c.poster || (photo ? c.url : "");
    return `<li><button type="button" class="br-item v-${m.verdict}${clips[cur]?.id === c.id ? " on" : ""}" data-id="${c.id}">
      <span class="br-thumb">${src ? `<img src="${esc(src)}" alt="" loading="lazy" />` : ""}<i>${m.verdict === "unreviewed" ? "" : m.verdict}</i></span>
      <span class="br-meta"><b>${esc(c.name.replace(/\.[^.]+$/, ""))}</b><span>${photo ? "Photo · " : ""}${esc(c.gig)}${m.start != null ? ` · trim ${fmt(m.start)}–${fmt(m.end)}` : ""}${esc(tagLine(m))}</span>${m.note ? `<em>${esc(m.note)}</em>` : ""}</span></button></li>`;
  }).join("") || '<li class="br-empty label">Nothing here.</li>';
  document.querySelectorAll(".br-item").forEach((b) => b.addEventListener("click", () => open(clips.findIndex((c) => c.id === b.dataset.id))));
}
function progress() {
  const done = clips.filter((c) => mk(c).verdict !== "unreviewed").length;
  $("[data-done]").textContent = done; $("[data-total]").textContent = clips.length;
  $("[data-bar]").style.transform = `scaleX(${clips.length ? done / clips.length : 0})`;
}

function flushNote() { if (noteT) { clearTimeout(noteT); noteT = 0; save(noteId); } }
function open(i) {
  if (i < 0 || i >= clips.length) return;
  flushNote(); clearTimeout(advT);
  cur = i; const c = clips[i], m = mk(c), photo = isPhoto(c);
  $("[data-player]").hidden = false; document.body.classList.add("playing");
  $("[data-gigname]").textContent = c.gig; $("[data-name]").textContent = c.name.replace(/\.[^.]+$/, "");
  const dl = $("[data-dl]"); dl.hidden = !c.download; if (c.download) { dl.href = c.download; dl.textContent = c.hd ? "Download HD" : "Download (preview quality, HD coming)"; }
  $("[data-note]").value = m.note || "";
  loop = false; v.pause();
  v.hidden = photo; img.hidden = !photo; $("[data-tl]").hidden = photo; $("[data-play]").hidden = photo;
  if (photo) { v.removeAttribute("src"); v.load(); img.src = c.url || ""; }
  else { img.removeAttribute("src"); v.poster = c.poster || ""; v.src = c.url || ""; v.currentTime = 0; }
  status(c.url ? (m.by ? `Last marked by ${m.by}` : "") : "No preview for this clip yet.");
  paint(); list();
  if (matchMedia("(max-width: 900px)").matches) window.scrollTo({ top: 0 });
}

// ---------- the timeline: drag handles to trim, click or drag the track to scrub ----------
const dur = () => v.duration || clips[cur]?.duration || 0;
function paint() {
  const c = clips[cur]; if (!c) return;
  const m = mk(c); const d = dur() || 1;
  const pct = (t) => `${(Math.min(Math.max(t, 0), d) / d) * 100}%`;
  const s = m.start, e = m.end;
  const sIn = $(".tl-in"), sOut = $(".tl-out");
  sIn.style.left = pct(s ?? 0); sOut.style.left = pct(e ?? d);
  sIn.classList.toggle("set", s != null); sOut.classList.toggle("set", e != null);
  $("[data-range]").style.left = pct(s ?? 0); $("[data-range]").style.width = `calc(${pct(e ?? d)} - ${pct(s ?? 0)})`;
  $("[data-range]").classList.toggle("set", s != null);
  $("[data-head]").style.left = pct(v.currentTime || 0);
  $("[data-t-start]").textContent = `Start ${fmt(s)}`; $("[data-t-end]").textContent = `End ${fmt(e)}`; $("[data-t-now]").textContent = fmt(v.currentTime || 0);
  document.querySelectorAll("[data-v]").forEach((b) => b.classList.toggle("on", b.dataset.v === m.verdict));
  paintUse(m);
}
function paintUse(m) {
  $("[data-use]").hidden = !isKeep(m);
  document.querySelectorAll("[data-tag]").forEach((b) => { const on = !!m[b.dataset.tag]; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  document.querySelectorAll("[data-chips]").forEach((row) => {
    row.hidden = !m.broll;
    row.querySelectorAll("button").forEach((b) => { const on = m[row.dataset.chips] === b.dataset.c; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  });
}
document.querySelectorAll("[data-chips]").forEach((row) => {
  row.innerHTML = `<span class="label">${row.getAttribute("aria-label")}</span>` + CHIPS[row.dataset.chips].map(([k, l]) => `<button type="button" data-c="${k}" aria-pressed="false">${l}</button>`).join("");
  row.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => chip(row.dataset.chips, b.dataset.c)));
});
const timeAt = (x) => { const r = track.getBoundingClientRect(); return Math.min(Math.max((x - r.left) / r.width, 0), 1) * dur(); };
function setTrim(which, t) {
  const c = clips[cur]; if (!c || isPhoto(c)) return; const m = { ...mk(c) }; const d = dur();
  t = Math.round(t * 10) / 10;
  if (which === "start") { m.start = Math.min(t, (m.end ?? d) - 0.2); if (m.end == null) m.end = Math.round(d * 10) / 10; }
  else { m.end = Math.max(t, (m.start ?? 0) + 0.2); if (m.start == null) m.start = 0; }
  marks[c.id] = m; paint();
}
let drag = null;
track.addEventListener("pointerdown", (e) => {
  if (!clips[cur]) return;
  const h = e.target.closest("[data-h]");
  drag = h ? h.dataset.h : "scrub"; track.setPointerCapture(e.pointerId); v.pause();
  move(e);
});
track.addEventListener("pointermove", (e) => drag && move(e));
const end = () => { if (drag && drag !== "scrub") save(); drag = null; };
track.addEventListener("pointerup", end); track.addEventListener("pointercancel", end);
function move(e) { const t = timeAt(e.clientX); v.currentTime = t; if (drag !== "scrub") setTrim(drag, t); else paint(); }

let loop = false;
v.addEventListener("timeupdate", () => { const m = mk(clips[cur] || {}); if (loop && m.end != null && v.currentTime >= m.end) v.currentTime = m.start; paint(); });
v.addEventListener("loadedmetadata", paint);
v.addEventListener("play", () => $("[data-play]").classList.add("gone")); v.addEventListener("pause", () => $("[data-play]").classList.remove("gone"));
const toggle = () => { if (isPhoto(clips[cur]) || !v.src) return; v.paused ? v.play() : v.pause(); };
$("[data-play]").addEventListener("click", toggle); v.addEventListener("click", toggle);
$("[data-loop]").addEventListener("click", () => { const m = mk(clips[cur]); if (m.start == null) return status("Drag the handles to set a trim first."); loop = true; v.currentTime = m.start; v.play(); });
document.querySelectorAll("[data-mark]").forEach((b) => b.addEventListener("click", () => { setTrim(b.dataset.mark, v.currentTime); save(); }));
$("[data-clear]").addEventListener("click", () => { const c = clips[cur]; marks[c.id] = { ...mk(c), start: null, end: null }; loop = false; paint(); save(); });

// ---------- verdict, used-for tags, note ----------
function edit(patch) { const c = clips[cur]; if (!c) return; marks[c.id] = { ...mk(c), ...patch }; paint(); list(); save(); }
function verdict(x) {
  const c = clips[cur]; if (!c) return; const m = mk(c), vis = visible();
  const nv = m.verdict === x ? "unreviewed" : x, patch = { verdict: nv };
  if ((nv === "keep" || nv === "favorite") && !m.band && !m.broll) { patch.band = true; patch.broll = true; }
  edit(patch); progress(); advance(c, vis);
}
// Hop to the next unmarked item, but stay put when a trim is set so tags can be checked.
function advance(c, vis) {
  clearTimeout(advT); const m = mk(c);
  if (m.verdict === "unreviewed" || (!isPhoto(c) && (m.start != null || m.end != null))) return;
  const i = vis.findIndex((x) => x.id === c.id);
  const nx = [...vis.slice(i + 1), ...vis.slice(0, Math.max(i, 0))].find((x) => x.id !== c.id && mk(x).verdict === "unreviewed");
  if (!nx) return status("Last one in this view.");
  advT = setTimeout(() => { if (clips[cur]?.id === c.id) open(clips.indexOf(nx)); }, 250);
}
const useTag = (f) => { const m = mk(clips[cur] || {}); if (clips[cur] && isKeep(m)) edit({ [f]: !m[f] }); };
const chip = (f, val) => { const m = mk(clips[cur] || {}); if (clips[cur] && isKeep(m) && m.broll) edit({ [f]: m[f] === val ? null : val }); };
document.querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => verdict(b.dataset.v)));
document.querySelectorAll("[data-tag]").forEach((b) => b.addEventListener("click", () => useTag(b.dataset.tag)));
$("[data-note]").addEventListener("input", (e) => { const c = clips[cur]; marks[c.id] = { ...mk(c), note: e.target.value }; clearTimeout(noteT); noteId = c.id; noteT = setTimeout(() => { noteT = 0; save(noteId); }, 700); });

// ---------- saving (one at a time, full mark each time, server refuses stale revisions) ----------
function status(t) { $("[data-status]").textContent = t; }
function toast(t) { const el = $("[data-toast]"); el.textContent = t; el.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), 4000); }
const pending = new Set(); let saving = false;
function save(id = clips[cur]?.id) { if (!id) return; pending.add(id); if (!saving) run(); }
async function run() {
  saving = true;
  while (pending.size) {
    const id = pending.values().next().value; pending.delete(id);
    const c = clips.find((x) => x.id === id); if (!c) continue;
    const m = mk(c), k = isKeep(m), photo = isPhoto(c);
    status("Saving…");
    try {
      const r = await fetch("/api/band-share", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ k: K, asset: id, revision: m.revision || 0, verdict: m.verdict, note: m.note || "", start: photo ? null : m.start, end: photo ? null : m.end,
          band: k && m.band, broll: k && m.broll, shot: k && m.broll ? m.shot : null, subject: k && m.broll ? m.subject : null }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        marks[id] = { ...mk(c), revision: d.mark.revision, by: d.mark.by };
        confirmed[id] = { ...m, revision: d.mark.revision, by: d.mark.by };
        status(`Saved · ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
        if (d.notice) toast(d.notice);
      } else if (d.code === "CHANGED") {
        clearTimeout(noteT); noteT = 0; pending.clear(); const here = clips[cur]?.id; await load(); const i = clips.findIndex((x) => x.id === here); if (i >= 0) open(i);
        status(d.error || "Someone else changed this one. Reloaded."); break;
      } else {
        if (confirmed[id]) marks[id] = confirmed[id]; else delete marks[id];
        if (clips[cur]?.id === id) { $("[data-note]").value = mk(c).note || ""; paint(); }
        list(); progress(); status(d.error || "Not saved.");
      }
    } catch { status("Offline. Not saved."); }
  }
  saving = false; list(); progress();
}

// ---------- browsing ----------
document.querySelectorAll("[data-show]").forEach((b) => b.addEventListener("click", () => { show = b.dataset.show; document.querySelectorAll("[data-show]").forEach((x) => x.classList.toggle("on", x === b)); list(); }));
document.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => { kind = kind === b.dataset.kind ? "" : b.dataset.kind; document.querySelectorAll("[data-kind]").forEach((x) => x.classList.toggle("on", x.dataset.kind === kind)); list(); }));
$("[data-gig]").addEventListener("change", (e) => { gig = e.target.value; list(); });
document.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => step(+b.dataset.step)));
$("[data-back]").addEventListener("click", () => { flushNote(); clearTimeout(advT); $("[data-player]").hidden = true; document.body.classList.remove("playing"); v.pause(); });
function step(n) { clearTimeout(advT); const vis = visible(); const i = vis.findIndex((c) => c.id === clips[cur]?.id); const nx = vis[i + n] || vis[n > 0 ? 0 : vis.length - 1]; if (nx) open(clips.indexOf(nx)); }
document.addEventListener("keydown", (e) => {
  if (e.target.matches("textarea, input, select") || cur < 0 || $("[data-player]").hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === " ") { e.preventDefault(); toggle(); }
  else if (k === "k") verdict("keep"); else if (k === "f") verdict("favorite"); else if (k === "d") verdict("delete");
  else if (k === "b") useTag("band"); else if (k === "r") useTag("broll");
  else if (k === "i") { setTrim("start", v.currentTime); save(); } else if (k === "o") { setTrim("end", v.currentTime); save(); }
  else if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1);
});
load();
