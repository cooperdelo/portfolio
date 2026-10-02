// Record viewer. Loaded the first time someone opens a record, never before.
// Left: the album as a real object (cover on the front, the tracklist on the back, the record inside) that you can
// turn by dragging; the record slides out and spins while a song plays. Right: Cooper's pick, the tracklist with
// 30-second previews, and links out. His own EP streams through Spotify instead of previews.
import * as THREE from "/assets/vendor/three/three.module.min.js";
import { OrbitControls } from "/assets/vendor/three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "/assets/vendor/three/addons/environments/RoomEnvironment.js";

const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const RPM = (33 + 1 / 3) / 60 * Math.PI * 2;
const PLAY = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5l9 5.5-9 5.5z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor"/></svg>';
const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let data = null, idx = 0, root, els = {}, opener = null;
let three = null; // renderer, scene, camera, controls, album parts
const audio = new Audio();
audio.preload = "none";
let spin = 0, slide = 0, slideTo = 0, raf = 0, last = 0, introT = 1;

async function loadData() {
  if (!data) data = await (await fetch("/content/records.json")).json();
  return data;
}

function build() {
  root = document.createElement("div");
  root.className = "av";
  root.hidden = true;
  root.setAttribute("data-lenis-prevent", "");
  root.innerHTML = `<div class="av-scrim" data-close></div>
  <div class="av-panel" role="dialog" aria-modal="true" aria-labelledby="av-t">
    <div class="av-stage"><p class="av-hint label">Drag to turn it</p></div>
    <div class="av-info">
      <button class="pill av-close" type="button" data-close>Close</button>
      <div><p class="label av-no"></p><h2 class="av-title" id="av-t"></h2><p class="av-artist"></p></div>
      <div class="av-body"></div>
      <div class="av-nav"><button type="button" data-step="-1"></button><button type="button" data-step="1"></button></div>
      <div class="av-bar" hidden><button type="button" aria-label="Pause"></button><div class="now"><span></span><div class="track"><i></i></div></div></div>
    </div>
  </div>`;
  document.body.appendChild(root);
  els = { stage: root.querySelector(".av-stage"), no: root.querySelector(".av-no"), title: root.querySelector(".av-title"), artist: root.querySelector(".av-artist"),
    body: root.querySelector(".av-body"), nav: root.querySelector(".av-nav"), bar: root.querySelector(".av-bar"), hint: root.querySelector(".av-hint"), panel: root.querySelector(".av-panel") };
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) close();
    const st = e.target.closest("[data-step]");
    if (st) show(idx + Number(st.dataset.step));
    const tr = e.target.closest("[data-track]");
    if (tr && !tr.disabled) play(Number(tr.dataset.track));
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key === "Tab") trap(e);
  });
  els.bar.querySelector("button").addEventListener("click", () => (audio.paused ? audio.play() : audio.pause()));
  audio.addEventListener("timeupdate", () => { els.bar.querySelector("i").style.transform = `scaleX(${audio.duration ? audio.currentTime / audio.duration : 0})`; });
  audio.addEventListener("play", syncBar);
  audio.addEventListener("pause", syncBar);
  audio.addEventListener("ended", () => { syncBar(); markPlaying(-1); });
}

function trap(e) {
  const f = [...root.querySelectorAll("button:not([disabled]), a[href], iframe")].filter((x) => x.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], lastEl = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
  else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
}

function syncBar() {
  const b = els.bar.querySelector("button");
  b.innerHTML = audio.paused ? PLAY : PAUSE;
  b.setAttribute("aria-label", audio.paused ? "Play" : "Pause");
}

function markPlaying(i) {
  root.querySelectorAll(".av-tracks li").forEach((li, k) => li.classList.toggle("on", k === i));
}

function play(i) {
  const r = data[idx], t = r.tracks[i];
  if (!t || !t.p) return;
  if (audio.src === t.p && !audio.paused) { audio.pause(); return; }
  audio.src = t.p;
  audio.play().catch(() => {});
  els.bar.hidden = false;
  els.bar.querySelector("span").textContent = `${t.t} · ${r.artist}`;
  markPlaying(i);
  window.cdTrack?.("preview_play", { album: r.title, track: t.t });
}

function render() {
  const r = data[idx];
  els.no.textContent = r.own ? `Mine · ${r.year} EP` : `No. ${String(r.no).padStart(2, "0")} · On repeat · ${r.year}`;
  els.title.textContent = r.title;
  els.artist.textContent = r.artist;
  const favIdx = r.fav ? r.tracks.findIndex((t) => t.t.toLowerCase().startsWith(r.fav.toLowerCase().slice(0, 12))) : -1;
  let h = "";
  if (r.own) {
    h += `<p class="av-mine">This one's mine. Four songs I wrote and recorded.</p>
      <iframe class="av-embed" title="Flicker of Time on Spotify" src="https://open.spotify.com/embed/album/${esc(r.spotifyAlbum)}?utm_source=cooperdelo&theme=0" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>
      <div class="av-links"><a class="pill" href="${esc(r.links.artist)}" target="_blank" rel="noreferrer">Follow on Spotify ${ARROW}</a></div>`;
  } else {
    if (favIdx > -1) {
      const t = r.tracks[favIdx];
      h += `<div class="av-pick"><p class="label">My pick</p><button type="button" data-track="${favIdx}" ${t.p ? "" : "disabled"}>${t.p ? PLAY : ""}<span>${esc(t.t)}</span></button>${r.favNote ? `<p>${esc(r.favNote)}</p>` : ""}</div>`;
    }
    h += `<ol class="av-tracks">${r.tracks.map((t, i) => `<li class="${i === favIdx ? "fav" : ""}"><button type="button" data-track="${i}" ${t.p ? "" : 'disabled title="No preview for this one"'}><span class="no">${String(i + 1).padStart(2, "0")}</span><span class="t">${esc(t.t)}</span><span class="ic">${t.p ? PLAY : ""}</span></button></li>`).join("")}</ol>
      <div class="av-links"><a class="pill" href="${esc(r.links.spotify)}" target="_blank" rel="noreferrer">Spotify ${ARROW}</a><a class="pill" href="${esc(r.links.apple)}" target="_blank" rel="noreferrer">Apple Music ${ARROW}</a></div>
      <p class="av-fine">Previews are 30 seconds, courtesy of Apple Music.</p>`;
  }
  els.body.innerHTML = h;
  const prev = data[(idx - 1 + data.length) % data.length], next = data[(idx + 1) % data.length];
  els.nav.children[0].textContent = `← ${prev.title}`;
  els.nav.children[1].textContent = `${next.title} →`;
  els.panel.querySelector(".av-info").scrollTop = 0;
}

// ---------------------------------------------------------------- 3D
function grooveTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 1024;
  const g = c.getContext("2d"), m = 512;
  g.fillStyle = "#6a6a6a"; g.fillRect(0, 0, 1024, 1024);
  for (let r = 175; r < 505; r += 1.4) { // fine grooves, with lighter bands where the music gets loud or quiet
    const band = 0.5 + 0.5 * Math.sin(r * 0.21) * Math.sin(r * 0.047);
    g.strokeStyle = `rgba(${130 + band * 70},${130 + band * 70},${130 + band * 70},0.55)`;
    g.lineWidth = 0.8; g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.stroke();
  }
  for (const r of [222, 268, 312, 361, 408]) { g.strokeStyle = "#1e1e1e"; g.lineWidth = 3; g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.stroke(); } // track gaps
  g.fillStyle = "#222"; g.beginPath(); g.arc(m, m, 170, 0, Math.PI * 2); g.fill(); // run-out
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
}

function initThree() {
  const canvas = document.createElement("canvas");
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); }
  catch (e) { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  els.stage.prepend(canvas);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;
  const key = new THREE.DirectionalLight(0xfff1e0, 1.5); key.position.set(-2.2, 2.4, 3); scene.add(key);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  camera.position.set(0.35, 0.12, 3.6);
  const controls = new OrbitControls(camera, canvas);
  controls.enableZoom = false; controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7; controls.autoRotate = !RM; controls.autoRotateSpeed = 0.7; controls.target.set(0.3, 0, 0);
  controls.addEventListener("start", () => { controls.autoRotate = false; els.hint.classList.add("gone"); });

  const loader = new THREE.TextureLoader();
  const tex = (url) => { const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const album = new THREE.Group(); scene.add(album);
  const edge = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.85 });
  const front = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
  const back = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 });
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.016), [edge, edge, edge, edge, front, back]);
  album.add(sleeve);
  const groove = grooveTexture();
  const vinyl = new THREE.MeshPhysicalMaterial({ color: 0x060606, roughness: 0.42, roughnessMap: groove, bumpMap: groove, bumpScale: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.18, metalness: 0 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.3 });
  const record = new THREE.Group(); album.add(record);
  const spinner = new THREE.Group(); record.add(spinner);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.004, 160), [rim, vinyl, vinyl]);
  disc.rotation.x = Math.PI / 2; spinner.add(disc);
  const labelMat = new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.75 });
  for (const s of [1, -1]) {
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.162, 96), labelMat);
    l.position.z = s * 0.0026; if (s < 0) l.rotation.y = Math.PI; spinner.add(l);
  }
  record.position.z = 0;
  three = { renderer, scene, camera, controls, album, record, spinner, front, back, labelMat, tex };
  resize();
  addEventListener("resize", resize);
  return three;
}

function resize() {
  if (!three) return;
  const w = els.stage.clientWidth, h = els.stage.clientHeight;
  three.renderer.setSize(w, h, false);
  three.camera.aspect = w / Math.max(1, h);
  // Fit the whole thing, sleeve plus the slid-out record (about 1.7 wide, 1.1 tall with margin), to any stage shape.
  const half = Math.tan(THREE.MathUtils.degToRad(three.camera.fov / 2));
  const dist = Math.max(0.62 / half, 0.92 / (half * three.camera.aspect));
  three.camera.position.set(0.3 + 0.05 * dist, 0.04 * dist, dist);
  three.camera.updateProjectionMatrix();
}

function dress() {
  const r = data[idx];
  if (!three) { // no WebGL: the rendered sleeve still makes the point
    let img = els.stage.querySelector(".av-fallback");
    if (!img) { img = document.createElement("img"); img.className = "av-fallback"; img.alt = ""; els.stage.prepend(img); }
    img.src = `/img/records/sleeve-${r.slug}-960.webp`;
    return;
  }
  three.front.map = three.tex(`/img/records/cover-${r.slug}-1024.jpg`); three.front.needsUpdate = true;
  three.back.map = three.tex(`/img/records/back-${r.slug}.jpg`); three.back.needsUpdate = true;
  three.labelMat.map = three.tex(`/img/records/label3d-${r.slug}.webp`); three.labelMat.needsUpdate = true;
}

const ease = (x) => 1 - Math.pow(1 - x, 3);
function frame(t) {
  const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
  if (three) {
    slide += (slideTo - slide) * (1 - Math.exp(-dt * (RM ? 60 : 4.5)));
    three.record.position.x = slide;
    const target = !audio.paused ? RPM : 0;
    spin += (target - spin) * (1 - Math.exp(-dt * (target ? 2.2 : 0.9)));
    three.spinner.rotation.z -= spin * dt;
    if (introT < 1) { introT = Math.min(1, introT + dt / 1.3); const e = ease(introT); three.album.rotation.y = -0.85 * (1 - e); three.album.position.y = -0.08 * (1 - e); }
    three.controls.update();
    three.renderer.render(three.scene, three.camera);
  }
  raf = requestAnimationFrame(frame);
}

function show(i) {
  idx = (i + data.length) % data.length;
  audio.pause(); els.bar.hidden = true;
  render();
  if (three && !RM) { slide = 0; slideTo = 0.6; introT = 0; three.album.rotation.set(0, 0, 0); } else { slideTo = 0.6; }
  dress();
  window.cdTrack?.("record_open", { album: data[idx].title });
}

export async function open(slug, from) {
  opener = from || document.activeElement;
  await loadData();
  if (!root) { build(); if (!initThree()) els.hint.remove(); }
  root.hidden = false;
  document.documentElement.classList.add("av-lock");
  requestAnimationFrame(() => root.classList.add("open"));
  show(Math.max(0, data.findIndex((r) => r.slug === slug)));
  resize();
  if (!raf) raf = requestAnimationFrame(frame);
  setTimeout(() => root.querySelector(".av-close").focus({ preventScroll: true }), 50);
}

export function close() {
  if (!root || root.hidden) return;
  audio.pause();
  root.classList.remove("open");
  document.documentElement.classList.remove("av-lock");
  setTimeout(() => { root.hidden = true; cancelAnimationFrame(raf); raf = 0; last = 0; }, RM ? 0 : 900);
  opener?.focus?.({ preventScroll: true });
}
