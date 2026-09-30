/* cooperdelo.com / site v4 (2026-09-29, v2 review) */
(() => {
  const root = document.documentElement;
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- film grain: one static noise tile, no animation ---------- */
  function grain() {
    const g = document.createElement("div"); g.className = "grain"; g.setAttribute("aria-hidden", "true");
    const v = document.createElement("div"); v.className = "vignette"; v.setAttribute("aria-hidden", "true");
    document.body.append(g, v);
  }

  /* ---------- fit a line of display type to its container width ---------- */
  function fit() {
    const groups = {};
    document.querySelectorAll("[data-fit]").forEach((el) => {
      if (!el.offsetParent) return;
      // measure the real ink box at 100px, then scale to the container with a small safety margin
      // so the last glyph (the final O of the wordmark) never touches or crosses the edge
      const box = el.parentElement.clientWidth;
      el.style.fontSize = "100px";
      const w = Math.max(el.getBoundingClientRect().width, el.scrollWidth) || 1;
      const safe = el.closest(".wordmark") ? 0.98 : 0.995;
      const size = Math.floor((box * safe / w) * 100 * 100) / 100;
      const g = el.dataset.fit;
      if (g) (groups[g] = groups[g] || []).push([el, size]); else el.style.fontSize = size + "px";
    });
    Object.values(groups).forEach((l) => { const m = Math.min(...l.map((x) => x[1])); l.forEach(([el]) => (el.style.fontSize = m + "px")); });
  }

  /* ---------- odometer (intro counter) ---------- */
  function odometer(el, text) {
    el.textContent = "";
    for (const ch of text) {
      const w = document.createElement("span"); w.className = "odo";
      const c = document.createElement("span"); c.className = "col";
      for (let i = 0; i <= 9; i++) { const s = document.createElement("span"); s.textContent = i; c.appendChild(s); }
      w.appendChild(c); el.appendChild(w);
    }
    return el.querySelectorAll(".col");
  }

  /* ---------- reveal on view ---------- */
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  const vio = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) { if (!v.dataset.loaded && v.dataset.src) { v.src = v.dataset.src; v.dataset.loaded = "1"; } if (!RM) v.play().catch(() => {}); }
    else v.pause();
  }), { threshold: 0.05 });

  function clock() {
    const els = document.querySelectorAll("[data-clock]"); if (!els.length) return;
    const f = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" });
    const tick = () => els.forEach((el) => (el.textContent = f.format(new Date()))); tick(); setInterval(tick, 15000);
  }

  let lenis = null;
  function smooth() {
    if (RM || !window.Lenis) return;
    lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
    document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
      const t = document.querySelector(a.getAttribute("href"));
      if (t) { e.preventDefault(); lenis.scrollTo(t, { duration: 1.6, easing: (x) => 1 - Math.pow(1 - x, 4) }); }
    }));
  }

  /* ---------- parallax drift for collage frames ---------- */
  function drift() {
    const els = [...document.querySelectorAll("[data-speed]")]; if (!els.length || RM) return;
    const tick = () => {
      const vh = innerHeight;
      els.forEach((el) => { const r = el.getBoundingClientRect(); const c = (r.top + r.height / 2 - vh / 2) / vh; el.style.transform = `translate3d(0, ${(-c * parseFloat(el.dataset.speed) * 100).toFixed(1)}px, 0)`; });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- custom cursor: only appears over work and media ---------- */
  let cur = null, cx = -200, cy = -200, tx = -200, ty = -200, cs = 0, ts = 0;
  function cursor() {
    if (!FINE || RM) return;
    cur = document.createElement("div"); cur.className = "cur"; cur.setAttribute("aria-hidden", "true"); cur.innerHTML = "<span></span>";
    document.body.appendChild(cur);
    const label = cur.querySelector("span");
    addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    document.querySelectorAll("[data-cursor]").forEach((el) => {
      el.addEventListener("mouseenter", () => { label.textContent = el.dataset.cursor; ts = el.dataset.cursorSize ? +el.dataset.cursorSize : 1; cur.classList.add("on"); });
      el.addEventListener("mouseleave", () => { ts = 0; cur.classList.remove("on"); });
    });
    const loop = () => { cx = lerp(cx, tx, 0.22); cy = lerp(cy, ty, 0.22); cs = lerp(cs, ts, 0.14); cur.style.transform = `translate3d(${cx}px, ${cy}px, 0) scale(${cs.toFixed(3)})`; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  /* ---------- Velour-style index: preview follows, parked clear of the row ---------- */
  function preview() {
    const list = document.querySelector("[data-index]");
    if (!list || !FINE || RM) return;
    const rows = [...list.querySelectorAll(".row[data-src]")];
    const pv = document.createElement("div"); pv.className = "preview"; pv.setAttribute("aria-hidden", "true"); pv.innerHTML = '<div class="box"></div>';
    document.body.appendChild(pv);
    const box = pv.querySelector(".box"), layers = new Map();
    let x = 0, y = 0, px = 0, py = 0, w = 0, tw = 0, ratio = 16 / 9, active = null, mx = 0, my = 0, running = false;
    const GAP = 36;
    function layer(row) {
      if (layers.has(row)) return layers.get(row);
      const m = document.createElement("div"); m.className = "m";
      const v = document.createElement("video"); v.muted = true; v.loop = true; v.playsInline = true; v.preload = "none";
      v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.poster = row.dataset.poster || ""; v.src = row.dataset.src;
      m.appendChild(v); box.appendChild(m); layers.set(row, m); return m;
    }
    function place() {
      if (!active) return;
      const r = active.getBoundingClientRect(), h = tw / ratio;
      let left = mx + GAP; if (left + tw > innerWidth - 16) left = mx - GAP - tw;
      let top = r.bottom + 12; if (top + h > innerHeight - 16) top = r.top - 12 - h;
      px = left; py = Math.max(16, top);
    }
    function frame() {
      x = lerp(x, px, 0.12); y = lerp(y, py, 0.12); w = lerp(w, tw, 0.1);
      pv.style.transform = `translate3d(${x}px, ${y}px, 0)`; pv.style.width = w + "px";
      const m = active && layers.get(active);
      if (m) { const nx = ((mx - (x + w / 2)) / w) * 10, ny = ((my - (y + w / ratio / 2)) / (w / ratio)) * 8; m.style.setProperty("--nx", nx.toFixed(1) + "px"); m.style.setProperty("--ny", ny.toFixed(1) + "px"); }
      if (active || Math.abs(x - px) > 0.3 || Math.abs(y - py) > 0.3) requestAnimationFrame(frame); else running = false;
    }
    const go = () => { if (!running) { running = true; requestAnimationFrame(frame); } };
    addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; if (active) { place(); go(); } }, { passive: true });
    addEventListener("scroll", () => { if (active) { place(); go(); } }, { passive: true });
    rows.forEach((row) => {
      row.addEventListener("mouseenter", () => {
        const m = layer(row);
        layers.forEach((l) => { if (l !== m) { l.classList.remove("on"); const v = l.querySelector("video"); setTimeout(() => { if (!l.classList.contains("on")) v.pause(); }, 900); } });
        m.classList.add("on"); m.querySelector("video").play().catch(() => {});
        const [a, b] = (row.dataset.ar || "16/9").split("/").map(Number); ratio = a / b;
        tw = Math.min(innerWidth * (ratio < 1 ? 0.15 : ratio === 1 ? 0.2 : 0.26), innerHeight * 0.46 * ratio);
        pv.style.aspectRatio = `${a} / ${b}`;
        const first = !active; active = row; place();
        if (first) { x = px; y = py; w = w || tw; }
        pv.classList.add("on"); go();
      });
      row.addEventListener("mouseleave", () => { active = null; pv.classList.remove("on"); });
      row.querySelector("a").addEventListener("click", () => { box.style.viewTransitionName = "case-media"; });
    });
    addEventListener("pagehide", () => { box.style.viewTransitionName = ""; });
  }
  function posterHandoff() {
    document.querySelectorAll("[data-handoff]").forEach((a) => a.addEventListener("click", () => { const p = a.querySelector(".poster"); if (p && getComputedStyle(p).display !== "none") p.style.viewTransitionName = "case-media"; }));
    addEventListener("pageshow", () => document.querySelectorAll(".poster").forEach((p) => (p.style.viewTransitionName = "")));
  }

  /* ---------- full-cut player: poster + play, sound on ---------- */
  function players() {
    document.querySelectorAll(".player").forEach((p) => {
      const v = p.querySelector("video"), btn = p.querySelector(".cover");
      if (!v || !btn) return;
      const start = () => { p.classList.add("playing"); v.controls = true; v.muted = false; v.play().catch(() => {}); if (cur) { ts = 0; cur.classList.remove("on"); } };
      btn.addEventListener("click", start);
      v.addEventListener("ended", () => { p.classList.remove("playing"); v.controls = false; });
    });
  }

  /* ---------- intro: counter once per session ---------- */
  function intro(done) {
    const el = document.querySelector(".intro");
    if (!el || root.classList.contains("seen") || RM) { if (el) el.remove(); done(); return; }
    const slots = odometer(el.querySelector(".count"), "000");
    const steps = ["000", "017", "048", "083", "100"];
    const setTo = (s) => [...s].forEach((d, i) => { slots[i].style.transform = "translateY(-" + +d * 10 + "%)"; });
    let k = 0;
    const next = () => {
      k++;
      if (k < steps.length) { setTo(steps[k]); setTimeout(next, k === steps.length - 1 ? 700 : 320); }
      else { try { sessionStorage.setItem("cd-intro", "1"); } catch (e) {} el.classList.add("lift"); done(); setTimeout(() => el.remove(), 1400); }
    };
    setTimeout(next, 250);
  }

  /* nav colour follows the section under it: bone over footage, ink over paper */
  function navTone() {
    const nav = document.querySelector(".nav"); if (!nav) return;
    const lights = [...document.querySelectorAll(".light")];
    const check = () => { const y = 36; const on = lights.some((s) => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom >= y; }); nav.classList.toggle("on-light", on); };
    check(); addEventListener("scroll", check, { passive: true }); addEventListener("resize", check);
  }

  /* ---------- hero loop: same first frame as the poster, so first paint is identical ---------- */
  function heroVideo() {
    const v = document.querySelector(".hero-vid"); if (!v || RM) { if (v) v.remove(); return; }
    const base = matchMedia("(max-width: 700px)").matches ? v.dataset.m : v.dataset.d;
    const webm = document.createElement("source"); webm.src = base + ".webm"; webm.type = 'video/webm; codecs="av01.0.08M.08"';
    const mp4 = document.createElement("source"); mp4.src = base + ".mp4"; mp4.type = "video/mp4";
    v.append(webm, mp4); v.load(); v.play().catch(() => {});
  }

  function boot() {
    grain(); fit(); navTone();
    if (document.fonts) { document.fonts.ready.then(fit); document.fonts.load('700 100px "Druk Wide"').then(fit).catch(() => {}); }
    addEventListener("load", fit);
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(fit, 120); });
    heroVideo(); clock(); smooth(); cursor(); preview(); posterHandoff(); players(); drift();
    intro(() => {
      document.querySelectorAll("[data-hero]").forEach((el, i) => setTimeout(() => el.classList.add("in"), 120 + i * 90));
      document.querySelectorAll("[data-rv]").forEach((el) => io.observe(el));
      document.querySelectorAll("video[data-src], video[data-lazy]").forEach((v) => vio.observe(v));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
