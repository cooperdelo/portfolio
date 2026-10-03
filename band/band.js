// Shared band reviewer. One link per bandmate, one shared set of marks per clip. Saves on its own.
const K = new URLSearchParams(location.search).get("k") || "";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (t) => (t == null ? "—" : `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`);
let clips = [], marks = {}, show = "all", gig = "", cur = -1, saving = null, queued = false, you = "";
const v = $("[data-video]"), track = $("[data-track]");

async function load() {
  const r = await fetch(`/api/band-share?k=${encodeURIComponent(K)}`);
  const d = await r.json();
  if (!r.ok) { $("[data-hi]").textContent = d.error || "This link isn't working."; return; }
  you = d.you; clips = d.clips; marks = {};
  d.marks.forEach((m) => (marks[m.asset] = m));
  $("[data-hi]").textContent = `Hey ${you}. Pick the good stuff.`;
  const gigs = [...new Set(clips.map((c) => c.gig))];
  $("[data-gig]").innerHTML = '<option value="">Every gig</option>' + gigs.map((g) => `<option>${esc(g)}</option>`).join("");
  list(); progress();
}
const mk = (c) => marks[c.id] || { asset: c.id, revision: 0, verdict: "unreviewed", note: "", start: null, end: null };
const visible = () => clips.filter((c) => (!gig || c.gig === gig) && (show === "all" || mk(c).verdict === show));

function list() {
  $("[data-list]").innerHTML = visible().map((c) => {
    const m = mk(c);
    return `<li><button type="button" class="br-item v-${m.verdict}${clips[cur]?.id === c.id ? " on" : ""}" data-id="${c.id}">
      <span class="br-thumb">${c.url ? `<video muted preload="metadata" src="${c.url}#t=0.5"></video>` : ""}<i>${m.verdict === "unreviewed" ? "" : m.verdict}</i></span>
      <span class="br-meta"><b>${esc(c.name.replace(/\.[^.]+$/, ""))}</b><span>${esc(c.gig)}${m.start != null ? ` · trim ${fmt(m.start)}–${fmt(m.end)}` : ""}</span>${m.note ? `<em>${esc(m.note)}</em>` : ""}</span></button></li>`;
  }).join("") || '<li class="br-empty label">Nothing here.</li>';
  document.querySelectorAll(".br-item").forEach((b) => b.addEventListener("click", () => open(clips.findIndex((c) => c.id === b.dataset.id))));
}
function progress() {
  const done = clips.filter((c) => mk(c).verdict !== "unreviewed").length;
  $("[data-done]").textContent = done; $("[data-total]").textContent = clips.length;
  $("[data-bar]").style.transform = `scaleX(${clips.length ? done / clips.length : 0})`;
}

function open(i) {
  if (i < 0 || i >= clips.length) return;
  cur = i; const c = clips[i], m = mk(c);
  $("[data-player]").hidden = false; document.body.classList.add("playing");
  $("[data-gigname]").textContent = c.gig; $("[data-name]").textContent = c.name.replace(/\.[^.]+$/, "");
  $("[data-note]").value = m.note || "";
  v.src = c.url || ""; v.currentTime = 0;
  status(c.url ? (m.by ? `Last marked by ${m.by}` : "") : "No preview for this clip yet.");
  paint(); list();
  if (matchMedia("(max-width: 900px)").matches) window.scrollTo({ top: 0 });
}

// ---------- the timeline: drag handles to trim, click or drag the track to scrub ----------
const dur = () => v.duration || clips[cur]?.duration || 0;
function paint() {
  const m = mk(clips[cur] || {}); const d = dur() || 1;
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
}
const timeAt = (x) => { const r = track.getBoundingClientRect(); return Math.min(Math.max((x - r.left) / r.width, 0), 1) * dur(); };
function setTrim(which, t) {
  const c = clips[cur]; const m = { ...mk(c) }; const d = dur();
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
const toggle = () => (v.paused ? v.play() : v.pause());
$("[data-play]").addEventListener("click", toggle); v.addEventListener("click", toggle);
$("[data-loop]").addEventListener("click", () => { const m = mk(clips[cur]); if (m.start == null) return status("Drag the handles to set a trim first."); loop = true; v.currentTime = m.start; v.play(); });
document.querySelectorAll("[data-mark]").forEach((b) => b.addEventListener("click", () => { setTrim(b.dataset.mark, v.currentTime); save(); }));
$("[data-clear]").addEventListener("click", () => { const c = clips[cur]; marks[c.id] = { ...mk(c), start: null, end: null }; loop = false; paint(); save(); });

// ---------- verdict + note ----------
function verdict(x) { const c = clips[cur]; if (!c) return; const m = mk(c); marks[c.id] = { ...m, verdict: m.verdict === x ? "unreviewed" : x }; paint(); save(); progress(); }
document.querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => verdict(b.dataset.v)));
let noteT = 0;
$("[data-note]").addEventListener("input", (e) => { const c = clips[cur]; marks[c.id] = { ...mk(c), note: e.target.value }; clearTimeout(noteT); noteT = setTimeout(save, 700); });

// ---------- saving (one at a time, last change wins locally, server refuses stale revisions) ----------
function status(t) { $("[data-status]").textContent = t; }
async function save() {
  if (saving) { queued = true; return; }
  const c = clips[cur]; if (!c) return; const m = mk(c);
  status("Saving…");
  saving = fetch("/api/band-share", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ k: K, asset: c.id, revision: m.revision || 0, verdict: m.verdict, note: m.note || "", start: m.start, end: m.end }) })
    .then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (r.ok) { marks[c.id] = { ...marks[c.id], revision: d.mark.revision, by: d.mark.by }; status(`Saved · ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`); }
      else if (d.code === "CHANGED") { status(d.error); await load(); open(cur); }
      else status(d.error || "Not saved.");
    }).catch(() => status("Offline. Not saved."))
    .finally(() => { saving = null; list(); if (queued) { queued = false; save(); } });
}

// ---------- browsing ----------
document.querySelectorAll("[data-show]").forEach((b) => b.addEventListener("click", () => { show = b.dataset.show; document.querySelectorAll("[data-show]").forEach((x) => x.classList.toggle("on", x === b)); list(); }));
$("[data-gig]").addEventListener("change", (e) => { gig = e.target.value; list(); });
document.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => step(+b.dataset.step)));
$("[data-back]").addEventListener("click", () => { $("[data-player]").hidden = true; document.body.classList.remove("playing"); v.pause(); });
function step(n) { const vis = visible(); const i = vis.findIndex((c) => c.id === clips[cur]?.id); const nx = vis[i + n] || vis[n > 0 ? 0 : vis.length - 1]; if (nx) open(clips.indexOf(nx)); }
document.addEventListener("keydown", (e) => {
  if (e.target.matches("textarea, input, select") || cur < 0) return;
  const k = e.key.toLowerCase();
  if (k === " ") { e.preventDefault(); toggle(); }
  else if (k === "k") verdict("keep"); else if (k === "f") verdict("favorite"); else if (k === "d") verdict("delete");
  else if (k === "i") { setTrim("start", v.currentTime); save(); } else if (k === "o") { setTrim("end", v.currentTime); save(); }
  else if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1);
});
load();
