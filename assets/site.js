/* cooperdelo.com / site v3 (2026-09-29) */
(() => {
  const root = document.documentElement;
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- fit a line of display type to its container width ---------- */
  function fit() {
    const groups = {};
    document.querySelectorAll("[data-fit]").forEach((el) => {
      if (!el.offsetParent) return;
      const box = el.parentElement.clientWidth;
      el.style.fontSize = "100px";
      const w = el.scrollWidth || 1;
      const size = Math.floor((box / w) * 100 * 100) / 100;
      const g = el.dataset.fit;
      if (g) (groups[g] = groups[g] || []).push([el, size]);
      else el.style.fontSize = size + "px";
    });
    Object.values(groups).forEach((list) => {
      const min = Math.min(...list.map((x) => x[1]));
      list.forEach(([el]) => (el.style.fontSize = min + "px"));
    });
  }

  /* ---------- odometer ---------- */
  function odometer(el, text) {
    el.textContent = "";
    el.classList.add("odo-wrap");
    const cols = [];
    for (const ch of text) {
      if (/\d/.test(ch)) {
        const w = document.createElement("span"); w.className = "odo";
        const c = document.createElement("span"); c.className = "col";
        for (let i = 0; i <= 9; i++) { const s = document.createElement("span"); s.textContent = i; c.appendChild(s); }
        w.appendChild(c); el.appendChild(w); cols.push({ c, d: +ch });
      } else {
        const s = document.createElement("span"); s.textContent = ch; el.appendChild(s);
      }
    }
    return {
      roll(delay = 0) {
        cols.forEach((o, i) => {
          o.c.style.transitionDuration = RM ? "0s" : 1.4 + i * 0.12 + "s";
          o.c.style.transitionDelay = delay + i * 0.04 + "s";
          o.c.style.transform = "translateY(-" + o.d * 10 + "%)";
        });
      },
    };
  }

  /* ---------- reveal on view ---------- */
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    if (e.target._odo) e.target._odo.roll(0.1);
    io.unobserve(e.target);
  }), { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });

  /* ---------- lazy video: load + play only while on screen ---------- */
  const vio = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) {
      if (!v.dataset.loaded && v.dataset.src) { v.src = v.dataset.src; v.dataset.loaded = "1"; }
      if (!RM) v.play().catch(() => {});
    } else v.pause();
  }), { threshold: 0.05 });

  /* ---------- local clock ---------- */
  function clock() {
    const els = document.querySelectorAll("[data-clock]");
    if (!els.length) return;
    const f = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" });
    const tick = () => els.forEach((el) => (el.textContent = f.format(new Date())));
    tick(); setInterval(tick, 15000);
  }

  /* ---------- Lenis smooth scroll ---------- */
  let lenis = null;
  function smooth() {
    if (RM || !window.Lenis) return;
    lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
      const t = document.querySelector(a.getAttribute("href"));
      if (t) { e.preventDefault(); lenis.scrollTo(t, { duration: 1.6, easing: (x) => 1 - Math.pow(1 - x, 4) }); }
    }));
  }

  /* ---------- Velour-style index: preview follows the cursor ---------- */
  function preview() {
    const list = document.querySelector("[data-index]");
    if (!list || !FINE || RM) return;
    const rows = [...list.querySelectorAll(".row[data-src], .row[data-img]")];
    const pv = document.createElement("div");
    pv.className = "preview"; pv.setAttribute("aria-hidden", "true");
    pv.innerHTML = '<div class="box"></div>';
    document.body.appendChild(pv);
    const box = pv.querySelector(".box");
    const layers = new Map();
    let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, w = 0, tw = 0, ratio = 16 / 9, active = null, running = false, mx = x, my = y;
    const GAP = 28;
    function place() {
      if (!active) return;
      const r = active.getBoundingClientRect();
      const h = tw / ratio;
      let left = mx + GAP;
      if (left + tw > innerWidth - 16) left = mx - GAP - tw;
      let top = r.bottom + 10;
      if (top + h > innerHeight - 16) top = r.top - 10 - h;
      tx = left; ty = Math.max(16, top);
    }

    function layer(row) {
      if (layers.has(row)) return layers.get(row);
      const m = document.createElement("div"); m.className = "m";
      if (row.dataset.src) {
        const v = document.createElement("video");
        v.muted = true; v.loop = true; v.playsInline = true; v.preload = "none";
        v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
        v.poster = row.dataset.poster || ""; v.src = row.dataset.src;
        m.appendChild(v);
      } else {
        const i = document.createElement("img"); i.src = row.dataset.img; i.alt = ""; m.appendChild(i);
      }
      box.appendChild(m); layers.set(row, m); return m;
    }
    function frame() {
      x = lerp(x, tx, 0.12); y = lerp(y, ty, 0.12); w = lerp(w, tw, 0.1);
      pv.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (Math.abs(w - tw) > 0.2) pv.style.width = w + "px";
      if (active || Math.abs(x - tx) > 0.3 || Math.abs(y - ty) > 0.3) requestAnimationFrame(frame); else running = false;
    }
    const go = () => { if (!running) { running = true; requestAnimationFrame(frame); } };
    addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; if (active) { place(); go(); } }, { passive: true });
    addEventListener("scroll", () => { if (active) { place(); go(); } }, { passive: true });

    rows.forEach((row) => {
      row.addEventListener("mouseenter", () => {
        const m = layer(row);
        layers.forEach((l) => { if (l !== m) { l.classList.remove("on"); const v = l.querySelector("video"); if (v) setTimeout(() => { if (!l.classList.contains("on")) v.pause(); }, 900); } });
        m.classList.add("on");
        const v = m.querySelector("video"); if (v) v.play().catch(() => {});
        const ar = row.dataset.ar || "16/9";
        const [a, b] = ar.split("/").map(Number);
        const want = Math.min(innerWidth * (a / b < 1 ? 0.15 : a / b === 1 ? 0.2 : 0.26), innerHeight * 0.5 * (a / b));
        tw = want; ratio = a / b; if (!w) { w = want; pv.style.width = w + "px"; }
        pv.style.aspectRatio = ar.replace("/", " / ");
        const first = !active;
        active = row; place();
        if (first) { x = tx; y = ty; }
        pv.classList.add("on"); go();
      });
      row.addEventListener("mouseleave", () => { active = null; pv.classList.remove("on"); });
      row.querySelector("a").addEventListener("click", () => { box.style.viewTransitionName = "case-media"; });
    });
    addEventListener("pagehide", () => { box.style.viewTransitionName = ""; });
  }

  /* touch: the tapped poster becomes the case-study hero */
  function posterHandoff() {
    document.querySelectorAll("[data-handoff]").forEach((a) => a.addEventListener("click", () => {
      const p = a.querySelector(".poster, .frame"); if (p) p.style.viewTransitionName = "case-media";
    }));
    addEventListener("pageshow", () => document.querySelectorAll(".poster, .frame").forEach((p) => (p.style.viewTransitionName = "")));
  }

  /* ---------- intro: counter once per session ---------- */
  function intro(done) {
    const el = document.querySelector(".intro");
    if (!el || root.classList.contains("seen") || RM) { if (el) el.remove(); done(); return; }
    const out = el.querySelector(".count");
    odometer(out, "000");
    const steps = ["000", "017", "048", "083", "100"];
    const slots = out.querySelectorAll(".odo .col");
    const setTo = (s) => [...s].forEach((d, i) => { slots[i].style.transitionDuration = "0.9s"; slots[i].style.transform = "translateY(-" + +d * 10 + "%)"; });
    if (slots.length === 3) {
      let k = 0;
      const next = () => {
        k++;
        if (k < steps.length) { setTo(steps[k]); setTimeout(next, k === steps.length - 1 ? 700 : 320); }
        else {
          try { sessionStorage.setItem("cd-intro", "1"); } catch (e) {}
          el.classList.add("lift"); done();
          setTimeout(() => el.remove(), 1400);
        }
      };
      setTimeout(next, 250);
    } else { el.remove(); done(); }
  }

  function start() {
    document.querySelectorAll("[data-rv]").forEach((el) => io.observe(el));
    document.querySelectorAll("[data-odo]").forEach((el) => { el._odo = odometer(el, el.dataset.odo); io.observe(el); });
    document.querySelectorAll("video[data-src], video[data-lazy]").forEach((v) => vio.observe(v));
  }

  function boot() {
    fit();
    if (document.fonts) {
      document.fonts.ready.then(fit);
      document.fonts.load('700 100px "Druk Wide"').then(fit).catch(() => {});
      document.fonts.addEventListener && document.fonts.addEventListener("loadingdone", fit);
    }
    addEventListener("load", fit);
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(fit, 120); });
    clock(); smooth(); preview(); posterHandoff();
    intro(() => {
      document.querySelectorAll("[data-hero]").forEach((el, i) => setTimeout(() => el.classList.add("in"), 120 + i * 90));
      start();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
