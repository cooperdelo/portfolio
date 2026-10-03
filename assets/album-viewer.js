// Record viewer. Loaded the first time someone opens a record, never before.
// Full screen. Left: the album sleeve as a real object (cover on the front, the tracklist on the back) that you can
// turn by dragging or flip with a button. Right: Cooper's pick, the tracklist with 30-second previews, and links out.
// His own EP streams through Spotify instead of previews.
import * as THREE from "/assets/vendor/three/three.module.min.js";
import { OrbitControls } from "/assets/vendor/three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "/assets/vendor/three/addons/environments/RoomEnvironment.js";

const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PLAY = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5l9 5.5-9 5.5z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor"/></svg>';
const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let data = null, idx = 0, root, els = {}, opener = null;
let three = null; // renderer, scene, camera, controls, album parts
const audio = new Audio();
audio.preload = "none";
let raf = 0, last = 0, introT = 1;

async function loadData() {
  if (!data) data = (await (await fetch("/content/records.json")).json()).filter((r) => !r.own);
  return data;
}

function build() {
  root = document.createElement("div");
  root.className = "av";
  root.hidden = true;
  root.setAttribute("data-lenis-prevent", "");
  root.innerHTML = `<div class="av-scrim" data-close></div>
  <div class="av-panel" role="dialog" aria-modal="true" aria-labelledby="av-t">
    <div class="av-stage"><p class="av-hint label">Drag to turn it</p><button class="pill av-flip" type="button" data-flip>See the back</button></div>
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
    if (e.target.closest("[data-flip]")) turn();
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
  const pick = root.querySelector(".av-pick button");
  if (pick && !pick.disabled) pick.querySelector("svg").outerHTML = !audio.paused && Number(pick.dataset.track) === playing ? PAUSE : PLAY;
}

let playing = -1;
function markPlaying(i) {
  playing = i;
  root.querySelectorAll(".av-tracks li").forEach((li, k) => li.classList.toggle("on", k === i));
}

function play(i) {
  const r = data[idx], t = r.tracks[i];
  if (!t || !t.p) return;
  if (audio.src === t.p && i === playing) { audio.paused ? audio.play().catch(() => {}) : audio.pause(); return; }
  audio.src = t.p;
  audio.play().catch(() => {});
  els.bar.hidden = false;
  els.bar.querySelector("span").textContent = `${t.t} · ${r.artist}`;
  markPlaying(i);
  window.cdTrack?.("preview_play", { album: r.title, track: t.t });
}

function render() {
  const r = data[idx];
  els.no.textContent = r.own ? `Mine · ${r.year} EP` : `On repeat · ${r.year}`;
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
  const rimL = new THREE.DirectionalLight(0xdfe6ff, 0.6); rimL.position.set(2.5, 0.5, -2); scene.add(rimL);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  const controls = new OrbitControls(camera, canvas);
  controls.enableZoom = false; controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7; controls.target.set(0, 0, 0);
  controls.minPolarAngle = Math.PI * 0.28; controls.maxPolarAngle = Math.PI * 0.72;
  controls.addEventListener("start", () => { held = true; els.hint.classList.add("gone"); });

  const loader = new THREE.TextureLoader();
  // Sleeves are aged on the way in: faded ink, ring wear where the record pressed through, scuffed edges and
  // corners, a few hairline scratches, film grain. Seeded by URL so each sleeve wears the same way every time.
  const tex = (url, wear = 1) => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 1024;
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => { age(cv, img, url, wear); t.needsUpdate = true; };
    img.src = url;
    return t;
  };
  const album = new THREE.Group(); scene.add(album);
  const edge = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.85 });
  const front = new THREE.MeshStandardMaterial({ roughness: 0.68, metalness: 0 });
  const back = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 });
  album.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.018), [edge, edge, edge, edge, front, back]));
  three = { renderer, scene, camera, controls, album, front, back, tex };
  resize();
  addEventListener("resize", resize);
  return three;
}

function resize() {
  if (!three) return;
  const w = els.stage.clientWidth, h = els.stage.clientHeight;
  three.renderer.setSize(w, h, false);
  three.camera.aspect = w / Math.max(1, h);
  // Fit the sleeve (1 x 1, plus room to turn) to any stage shape.
  const half = Math.tan(THREE.MathUtils.degToRad(three.camera.fov / 2));
  const dist = Math.max(0.74 / half, 0.74 / (half * three.camera.aspect));
  three.camera.position.set(0, 0.03 * dist, dist);
  three.controls.update();
  three.camera.updateProjectionMatrix();
}

function dress() {
  const r = data[idx];
  if (!three) { // no WebGL: the rendered sleeve still makes the point
    let img = els.stage.querySelector(".av-fallback");
    if (!img) { img = document.createElement("img"); img.className = "av-fallback"; img.alt = ""; els.stage.prepend(img); }
    img.src = `/img/records/cover-${r.slug}-1024.jpg`;
    return;
  }
  three.front.map = three.tex(`/img/records/cover-${r.slug}-1024.jpg`); three.front.needsUpdate = true;
  three.back.map = three.tex(`/img/records/back-${r.slug}.jpg`, 0.7); three.back.needsUpdate = true;
}

function age(cv, img, seedText, wear) {
  let s = 0; for (const c of seedText) s = (s * 31 + c.charCodeAt(0)) | 0;
  const rnd = () => { s = (s + 0x6d2b79f5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  // Smooth 1D noise from a few random sines, for wear that comes and goes instead of dots and dashes.
  const wave = (n = 5) => { const k = Array.from({ length: n }, (_, i) => [1 + i * 1.7 + rnd() * 2, rnd() * 7, 1 / (i + 1)]); const tot = k.reduce((a, q) => a + q[2], 0);
    return (t) => 0.5 + 0.5 * k.reduce((a, [f, p, w]) => a + Math.sin(t * f + p) * w, 0) / tot; };
  const W = cv.width, g = cv.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, W, W);
  // Faded print: lift the blacks and warm the whites a touch, like paper that's been in the sun.
  g.globalCompositeOperation = "screen"; g.fillStyle = `rgba(48, 41, 32, ${0.2 * wear})`; g.fillRect(0, 0, W, W);
  g.globalCompositeOperation = "multiply"; g.fillStyle = `rgba(246, 232, 204, ${0.45 * wear})`; g.fillRect(0, 0, W, W);

  // Everything worn is drawn on its own layer, softened, then laid over the print.
  const L = document.createElement("canvas"); L.width = L.height = W; const w = L.getContext("2d");
  const ink = (a) => `rgba(236, 228, 212, ${Math.max(0, a)})`;
  // Ring wear: the record's edge rubbing through. Continuous, stronger in some places, nearly gone in others.
  const cx = W * (0.5 + (rnd() - 0.5) * 0.025), cy = W * (0.5 + (rnd() - 0.5) * 0.025), R = W * 0.462, ring = wave(6);
  for (let a = 0; a < Math.PI * 2; a += 0.004) {
    const v = Math.pow(ring(a), 3);  // dots overlap ~8 deep, so each one is barely there
    w.fillStyle = ink(v * 0.019 * wear);
    w.beginPath(); w.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, W * (0.004 + v * 0.009), 0, Math.PI * 2); w.fill();
  }
  // Edges rubbed white where the sleeve slid in and out of a crate; corners softened.
  for (let side = 0; side < 4; side++) {
    const depth = wave(7);
    for (let p = 0; p < W; p += 2) {
      const d = Math.pow(depth(p / W * 9), 3) * W * 0.012 * wear + rnd() * 1.5;
      const [x, y, ww, hh] = side === 0 ? [p, 0, 2, d] : side === 1 ? [W - d, p, d, 2] : side === 2 ? [p, W - d, 2, d] : [0, p, d, 2];
      w.fillStyle = ink(0.35 + rnd() * 0.25); w.fillRect(x, y, ww, hh);
    }
  }
  for (const [x, y] of [[0, 0], [W, 0], [0, W], [W, W]]) {
    const cg = w.createRadialGradient(x, y, 0, x, y, W * (0.02 + rnd() * 0.025));
    cg.addColorStop(0, ink(0.55 * wear)); cg.addColorStop(1, ink(0));
    w.fillStyle = cg; w.fillRect(x - W * 0.05, y - W * 0.05, W * 0.1, W * 0.1);
  }
  g.globalCompositeOperation = "screen"; g.filter = "blur(2px)"; g.drawImage(L, 0, 0); g.filter = "none";

  // Hairline scratches and a faint storage crease, kept sharp but thin.
  w.clearRect(0, 0, W, W); w.lineCap = "round";
  for (let i = 0; i < 7 * wear; i++) {
    const x = rnd() * W, y = rnd() * W, a = rnd() * Math.PI, l = W * (0.03 + rnd() * 0.14);
    w.strokeStyle = ink(0.05 + rnd() * 0.1); w.lineWidth = 0.5 + rnd() * 0.7;
    w.beginPath(); w.moveTo(x, y); w.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (rnd() - 0.5) * 16, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); w.stroke();
  }
  if (rnd() < 0.6 * wear) { const y = W * (0.25 + rnd() * 0.5); w.strokeStyle = ink(0.06); w.lineWidth = 2; w.beginPath(); w.moveTo(0, y); w.bezierCurveTo(W * 0.3, y + (rnd() - 0.5) * 30, W * 0.7, y + (rnd() - 0.5) * 30, W, y + (rnd() - 0.5) * 40); w.stroke(); }
  g.filter = "blur(0.6px)"; g.drawImage(L, 0, 0); g.filter = "none";

  // Grain: monochrome, per pixel.
  g.globalCompositeOperation = "source-over";
  const d = g.getImageData(0, 0, W, W), px = d.data, amt = 28 * wear;
  for (let i = 0; i < px.length; i += 4) { const n = (rnd() - 0.5) * amt; px[i] += n; px[i + 1] += n; px[i + 2] += n; }
  g.putImageData(d, 0, 0);
}

const ease = (x) => 1 - Math.pow(1 - x, 3);
let held = false, flip = 0, flipTo = 0, clock = 0;
function frame(t) {
  const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t; clock += dt;
  if (three) {
    flip += (flipTo - flip) * (1 - Math.exp(-dt * (RM ? 60 : 5)));
    // A slow sway until someone grabs it, so it reads as an object, not a picture.
    const sway = held || RM ? 0 : Math.sin(clock * 0.6) * 0.22;
    // While a preview plays the sleeve breathes a little with it.
    const lift = !audio.paused && !RM ? Math.sin(clock * 2.1) * 0.012 : 0;
    let iy = 0, ip = 0;
    if (introT < 1) { introT = Math.min(1, introT + dt / 1.2); const e = ease(introT); iy = -0.9 * (1 - e); ip = -0.06 * (1 - e); }
    three.album.rotation.y = flip + sway + iy;
    three.album.position.y = lift + ip;
    three.controls.update();
    three.renderer.render(three.scene, three.camera);
  }
  raf = requestAnimationFrame(frame);
}

function turn() {
  flipTo = Math.round(flipTo / Math.PI) % 2 === 0 ? flipTo + Math.PI : flipTo - Math.PI;
  const b = root.querySelector("[data-flip]");
  if (b) b.textContent = Math.round(flipTo / Math.PI) % 2 === 0 ? "See the back" : "See the front";
  els.hint.classList.add("gone");
}

function show(i) {
  idx = (i + data.length) % data.length;
  audio.pause(); els.bar.hidden = true;
  render();
  flip = flipTo = 0; held = false;
  const b = root.querySelector("[data-flip]"); if (b) b.textContent = "See the back";
  if (three && !RM) { introT = 0; three.album.rotation.set(0, 0, 0); }
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
