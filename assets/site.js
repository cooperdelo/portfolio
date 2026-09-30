/* cooperdelo.com / site v4 (2026-09-29, v2 review) + motion v1 (2026-09-30) */
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
      const safe = el.closest(".wordmark") ? 0.95 : 0.995; // Druk's round O overshoots its advance box, so leave real room
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

  /* ---------- frames: the camera flies through the collage ----------
     Each frame keeps its parallax and gains depth: it is small while it waits below, grows as it passes
     the lens, and its photo counter-zooms inside the frame. The headline recedes as the frames arrive.
     Lenis smoothing gives every scroll a long decelerating tail. Runs only while the section is on screen. */
  function drift() {
    const els = [...document.querySelectorAll("[data-speed]")]; if (!els.length || RM) return;
    const sec = els[0].closest("section") || document.body, big = sec.querySelector(".big");
    const imgs = els.map((el) => el.querySelector("img"));
    let on = false, id = 0;
    const tick = () => {
      const vh = innerHeight;
      els.forEach((el, i) => {
        const r = el.getBoundingClientRect(), sp = parseFloat(el.dataset.speed);
        const c = Math.max(-1.3, Math.min(1.3, (r.top + r.height / 2 - vh / 2) / vh)), k = 0.03 + Math.abs(sp) * 0.42;
        el.style.transform = `translate3d(0, ${(-c * sp * 100).toFixed(1)}px, 0) scale(${(1 - c * k).toFixed(4)})`;
        if (imgs[i]) imgs[i].style.scale = (1.07 + c * 0.05).toFixed(4);
      });
      if (big) { const r = big.getBoundingClientRect(), c = Math.max(-1.2, Math.min(1.2, (r.top + r.height / 2 - vh / 2) / vh)); big.style.transform = `translate3d(0, ${(-c * 36).toFixed(1)}px, 0) scale(${(1 + c * 0.05).toFixed(4)})`; }
      id = on ? requestAnimationFrame(tick) : 0;
    };
    new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on && !id) id = requestAnimationFrame(tick); }, { rootMargin: "25% 0px" }).observe(sec);
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
    let x = 0, y = 0, px = 0, py = 0, w = 0, tw = 0, ratio = 16 / 9, active = null, mx = 0, my = 0, running = false, left = -1e4;
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
        // born from the row: the first preview starts as a line on the row under the cursor and peels off it
        const first = !active && performance.now() - left > 650; active = row; place();
        if (first) { const r = row.getBoundingClientRect(); w = tw; x = mx - tw / 2; y = r.top + r.height / 2 - tw / ratio / 2; }
        pv.classList.add("on"); go();
        // the neighbours make room: rows above lift, rows below drop, less the further they are
        const i = rows.indexOf(row);
        rows.forEach((r2, j) => { const k = j - i, a = Math.abs(k); r2.style.translate = k ? `0 ${Math.sign(k) * Math.max(0, 12 - 4 * (a - 1))}px` : "0 0"; });
      });
      row.addEventListener("mouseleave", () => {
        // it folds back into the row it came from
        const r = row.getBoundingClientRect(); active = null; left = performance.now();
        px = mx - tw / 2; py = r.top + r.height / 2 - tw / ratio / 2; pv.classList.remove("on"); go();
      });
      row.querySelector("a").addEventListener("click", () => { box.style.viewTransitionName = "case-media"; });
    });
    list.addEventListener("mouseleave", () => rows.forEach((r2) => (r2.style.translate = "0 0")));
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


  /* ---------- contact sheet (motion v1): the link you click becomes the panel ----------
     Open = the trigger's own shape (pill or text box) is the panel's clip, and it grows into the panel;
     the trigger's words fly to the matching label inside; every part slides out from the trigger's side
     while the shell is still growing. Close = the same animations played backwards, into the trigger. */
  const EMAIL = "cooper@plugverse.app";
  const ARW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  const LINKS = [
    ["Book a call", "cal.com/cooper-delo1", "https://cal.com/cooper-delo1"],
    ["Instagram", "@cooperdelo", "https://instagram.com/cooperdelo"],
    ["TikTok", "@cooperdelo", "https://tiktok.com/@cooperdelo"],
    ["LinkedIn", "in/cooperdelo", "https://www.linkedin.com/in/cooperdelo/"],
    ["YouTube", "@cooperdelo", "https://www.youtube.com/@cooperdelo"],
  ];
  const FRAMES = [["lawn", "Lawn", "62% 45%"], ["bar-gig", "Might As Well", ""], ["home-collage-2-band-porch-1cde07-c46a56e", "Porch show", "50% 40%"],
    ["cand-027-3b4f1e", "At the laptop", "48% 40%"], ["chiphi-solo", "Chi Phi", ""], ["cand-003-175b1a", "Franklin St.", "45% 50%"],
    ["belltower", "Bell tower", ""], ["desk-guitar", "Desk", ""]];
  function contactSheet() {
    const trigs = [...document.querySelectorAll('a[href$="#contact"], a[href^="mailto:' + EMAIL + '"]')];
    if (!trigs.length) return;
    const ease = "cubic-bezier(.22,1,.44,1)";
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const frames = (n0) => FRAMES.map(([k, cap, pos], i) => `<figure class="cs-fr"><span class="film"><img data-src="/img/${k}-640.webp" alt="" width="640" height="427" decoding="async"${pos ? ` style="object-position:${pos}"` : ""} /></span><span class="label"><span>${String(n0 + i).padStart(2, "0")}&nbsp;&nbsp;${String(n0 + i).padStart(2, "0")}A</span><span>${esc(cap)}</span></span></figure>`).join("");
    const cs = document.createElement("div");
    cs.className = "cs"; cs.hidden = true;
    cs.innerHTML = `<div class="cs-scrim" data-close></div>
<div class="cs-panel" role="dialog" aria-modal="true" aria-labelledby="cs-t" tabindex="-1" data-lenis-prevent>
 <div class="cs-in">
  <div class="cs-top label"><span id="cs-t" class="cs-t" data-p data-carry="contact">Contact</span><span class="cs-geo" data-p>35.913N 79.056W</span><button class="cs-x" type="button" data-close data-p>Close <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button></div>
  <div class="cs-mail"><p class="label cs-k" data-p data-carry="email-label">Email</p>
   <p class="cs-addr" data-p data-carry="email"><span class="sr">${EMAIL}</span><span class="cs-lw" aria-hidden="true">${[...EMAIL].map((c) => `<span>${c}</span>`).join("")}</span></p></div>
  <div class="cs-act" data-p><button class="pill solid cs-copy" type="button"><span class="sw"><span>Copy email</span><span aria-hidden="true">Copied</span></span><svg viewBox="0 0 16 16" aria-hidden="true"><path pathLength="1" d="M2 8.5l4 4L14 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button><a class="pill" href="mailto:${EMAIL}">Open in mail ${ARW}</a><span class="sr" aria-live="polite" data-said></span></div>
  <ol class="cs-links">${LINKS.map(([n, h, u], i) => `<li class="cs-row" data-p><a href="${u}" target="_blank" rel="noreferrer"><span class="label cs-no">${String(i + 1).padStart(2, "0")}</span><span class="cs-name">${n}</span><span class="label cs-h">${h}</span><span class="cs-go">${ARW}</span></a></li>`).join("")}</ol>
  <div class="cs-side">
   <div class="cs-time" data-p><p class="label"><span>Chapel Hill, NC</span><span>Local time, ET</span></p><p class="cs-clock" aria-hidden="true"></p><span class="sr" data-time></span></div>
   <form class="cs-note" data-p><label class="label" for="cs-msg">Write a note</label><textarea id="cs-msg" rows="4" placeholder="Hey Cooper,"></textarea>
    <div class="cs-send"><button class="pill" type="submit">Open in your mail app ${ARW}</button><span class="label">Opens your email app with this filled in</span></div></form>
  </div>
  <div class="cs-sheet" data-p aria-hidden="true"><div class="cs-track">${frames(12)}${frames(12 + FRAMES.length)}</div></div>
 </div>
</div>`;
    document.body.appendChild(cs);
    const panel = cs.querySelector(".cs-panel"), scrim = cs.querySelector(".cs-scrim");
    const parts = [...cs.querySelectorAll("[data-p]")];
    const letters = [...cs.querySelectorAll(".cs-lw > span")];
    const addr = cs.querySelector(".cs-addr"), rows = [...cs.querySelectorAll(".cs-row a")];
    // every part floats on its own: its own period, phase and direction
    parts.forEach((p, i) => { const h = (i * 0.618) % 1; p.style.animationDuration = (7 + h * 3.4).toFixed(2) + "s"; p.style.animationDelay = (-h * 9).toFixed(2) + "s"; if (i % 2) p.classList.add("b2"); });

    /* live Chapel Hill clock, digits on rolling columns */
    const clockEl = cs.querySelector(".cs-clock"), timeSr = cs.querySelector("[data-time]");
    const MODS = [3, 10, 6, 10, 6, 10], cols = [];
    MODS.forEach((m, i) => {
      if (i === 2 || i === 4) { const s = document.createElement("span"); s.className = "sep"; s.textContent = ":"; clockEl.appendChild(s); }
      const w = document.createElement("span"); w.className = "odo"; const c = document.createElement("span"); c.className = "col";
      for (let d = 0; d <= m; d++) { const s = document.createElement("span"); s.textContent = d % m; c.appendChild(s); }
      w.appendChild(c); clockEl.appendChild(w); cols.push({ c, m, v: -1 });
    });
    const tf = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "America/New_York" });
    let clockT = 0;
    function tick(first) {
      const t = tf.format(new Date()).replace(/\D/g, "");
      [...t].forEach((ch, i) => {
        const o = cols[i], d = +ch; if (o.v === d) return;
        const wrap = !first && o.v >= 0 && d === 0 && o.v === o.m - 1;
        if (wrap) { // roll forward onto the trailing 0, then re-seat on the first 0 without motion
          o.c.style.transform = `translateY(-${o.m}em)`;
          setTimeout(() => { o.c.classList.add("snap"); o.c.style.transform = "translateY(0)"; void o.c.offsetHeight; o.c.classList.remove("snap"); }, 950);
        } else { if (first) o.c.classList.add("snap"); o.c.style.transform = `translateY(-${d}em)`; if (first) { void o.c.offsetHeight; o.c.classList.remove("snap"); } }
        o.v = d;
      });
      timeSr.textContent = t.slice(0, 2) + ":" + t.slice(2, 4);
    }

    /* copy, with its confirmation: the label rolls to Copied, the tick draws, the address ripples */
    const copyBtn = cs.querySelector(".cs-copy"), said = cs.querySelector("[data-said]");
    let copyT = 0;
    copyBtn.addEventListener("click", async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(EMAIL); ok = true; } catch (e) {
        const r = document.createRange(); r.selectNodeContents(addr.querySelector(".sr")); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        try { ok = document.execCommand("copy"); } catch (e2) {} s.removeAllRanges();
      }
      if (!ok) { said.textContent = "Copy failed. Select the address instead."; return; }
      copyBtn.classList.add("done"); said.textContent = "Email copied";
      if (!RM) letters.forEach((l, i) => l.animate([{ transform: "translateY(0)" }, { transform: "translateY(-.16em)", offset: .4 }, { transform: "translateY(0)" }], { duration: 900, delay: i * 26, easing: ease }));
      clearTimeout(copyT); copyT = setTimeout(() => { copyBtn.classList.remove("done"); said.textContent = ""; }, 2600);
    });
    cs.querySelector(".cs-note").addEventListener("submit", (e) => {
      e.preventDefault();
      const body = cs.querySelector("#cs-msg").value.trim();
      location.href = `mailto:${EMAIL}?subject=${encodeURIComponent("Hi Cooper")}${body ? "&body=" + encodeURIComponent(body) : ""}`;
    });

    /* images load on intent, never with the page */
    let imgs = false;
    const loadImgs = () => { if (imgs) return; imgs = true; cs.querySelectorAll("img[data-src]").forEach((im) => { im.src = im.dataset.src; }); };

    let state = "closed", trig = null, anims = [], carry = null, dirty = false;
    const mobile = () => innerWidth <= 760;
    function place(t) {
      const s = panel.style; s.left = s.right = s.top = s.bottom = s.height = "";
      if (mobile()) { s.left = s.right = "8px"; s.top = "8px"; s.height = "calc(100svh - 16px)"; return; }
      const r = t.getBoundingClientRect(), g = 16;
      if (r.left + r.width / 2 > innerWidth / 2) s.right = g + "px"; else s.left = g + "px";
      if (r.top + r.height / 2 < innerHeight / 2) s.top = g + "px"; else s.bottom = g + "px";
    }
    function fitAddr() {
      const box = addr.parentElement.clientWidth;
      addr.style.fontSize = "100px";
      const w = addr.querySelector(".cs-lw").scrollWidth || 1;
      addr.style.fontSize = Math.floor(box * 0.985 / w * 10000) / 100 + "px";
    }
    const textNode = (el) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() ? 1 : 3) }); return w.nextNode(); };
    const textRect = (n) => { const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect(); };
    function srcText(t) { return t.querySelector(".roll > span") || t.querySelector("[data-fit]") || t; }
    function carryKey(t) { const s = srcText(t).textContent.trim().toLowerCase(); return s === EMAIL ? "email" : s === "email" ? "email-label" : "contact"; }
    function shape(t) { // the trigger's own outline: pills keep their pill, text links get a snug pill around the words
      const r = t.getBoundingClientRect(), cs2 = getComputedStyle(t);
      const pill = parseFloat(cs2.borderTopLeftRadius) > 20 || t.classList.contains("pill");
      if (pill) return { x: r.left, y: r.top, w: r.width, h: r.height, rad: r.height / 2, bg: cs2.backgroundColor };
      const tr = textRect(textNode(srcText(t)) || t), px = Math.min(14, tr.height * 0.6), py = Math.min(10, tr.height * 0.35);
      return { x: tr.left - px, y: tr.top - py, w: tr.width + px * 2, h: tr.height + py * 2, rad: Math.min(24, (tr.height + py * 2) / 2), bg: "" };
    }
    function build() {
      anims.forEach((a) => a.cancel()); anims = [];
      if (carry) { carry.remove(); carry = null; }
      parts.forEach((p) => (p.style.visibility = ""));
      const P = panel.getBoundingClientRect(), T = shape(trig), R = mobile() ? 18 : 16;
      const ox = T.x + T.w / 2, oy = T.y + T.h / 2;
      const inset = `inset(${(T.y - P.top).toFixed(1)}px ${(P.right - T.x - T.w).toFixed(1)}px ${(P.bottom - T.y - T.h).toFixed(1)}px ${(T.x - P.left).toFixed(1)}px round ${T.rad.toFixed(1)}px)`;
      const add = (el, kf, o) => { const a = el.animate(kf, Object.assign({ fill: "both", easing: ease }, o)); a.pause(); anims.push(a); return a; };
      add(panel, [{ clipPath: inset }, { clipPath: `inset(0px 0px 0px 0px round ${R}px)` }], { duration: 980 });
      const bgOpaque = T.bg && !/rgba\(.*,\s*0\)|transparent/.test(T.bg);
      if (bgOpaque) add(panel, [{ backgroundColor: T.bg }, { backgroundColor: getComputedStyle(panel).backgroundColor }], { duration: 520, composite: "replace" });
      const far = Math.hypot(Math.max(ox, innerWidth - ox), Math.max(oy, innerHeight - oy));
      add(scrim, [{ clipPath: `circle(0px at ${ox}px ${oy}px)` }, { clipPath: `circle(${far.toFixed(0)}px at ${ox}px ${oy}px)` }], { duration: 1100 });
      // the trigger's words fly to the matching label inside the panel
      const key = carryKey(trig), target = cs.querySelector(`[data-carry="${key}"]`);
      const sNode = textNode(srcText(trig));
      if (target && sNode) {
        const S = textRect(sNode), tgt = target.querySelector(".cs-lw") || target, E = textRect(tgt), st = getComputedStyle(sNode.parentElement);
        carry = document.createElement("p"); carry.className = "cs-carry"; carry.setAttribute("aria-hidden", "true");
        carry.textContent = sNode.textContent.trim();
        ["fontFamily", "fontWeight", "fontSize", "letterSpacing", "textTransform", "lineHeight", "fontKerning"].forEach((k) => (carry.style[k] = st[k]));
        carry.style.left = S.left + "px"; carry.style.top = S.top + "px";
        cs.appendChild(carry);
        // align the carrier's own glyph box to the source words, then land it on the target's words:
        // left edges and vertical centres match, and the width ratio sets the scale
        const C = carry.getBoundingClientRect(), Ct = textRect(carry.firstChild), k = E.width / (Ct.width || 1);
        const ts = getComputedStyle(target);
        const x0 = S.left - Ct.left, y0 = (S.top + S.height / 2) - (Ct.top + Ct.height / 2);
        const x1 = E.left - C.left - (Ct.left - C.left) * k, y1 = (E.top + E.height / 2) - C.top - (Ct.top - C.top + Ct.height / 2) * k;
        add(carry, [{ transform: `translate(${x0.toFixed(2)}px, ${y0.toFixed(2)}px)`, color: st.color, opacity: 1 },
                    { transform: `translate(${x1.toFixed(2)}px, ${y1.toFixed(2)}px) scale(${k.toFixed(4)})`, color: ts.color, opacity: ts.opacity }], { duration: 900 });
        target.style.visibility = "hidden"; carry.dataset.for = key;
      }
      // parts slide out from the trigger's side, staggered by distance, while the shell is still growing
      const diag = Math.hypot(innerWidth, innerHeight);
      parts.forEach((p) => {
        if (carry && p.dataset.carry === key) return;
        const r = p.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = Math.max(-90, Math.min(90, (ox - cx) * 0.16)), dy = Math.max(-70, Math.min(70, (oy - cy) * 0.16));
        const d = Math.hypot(ox - cx, oy - cy) / diag;
        // each part wipes open from the side facing the trigger (never a fade), while it slides out of it
        const from = oy < cy ? "inset(0px 0px 100% 0px)" : "inset(100% 0px 0px 0px)";
        add(p, [{ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(.965)`, clipPath: from },
                { transform: "none", clipPath: "inset(-48px -48px -48px -48px)" }], { duration: 1150, delay: 70 + d * 320 });
      });
      if (!(carry && key === "email")) letters.forEach((l, i) => add(l, [{ transform: "translateY(112%)" }, { transform: "none" }], { duration: 950, delay: 240 + i * 17 }));
      cs.querySelectorAll(".cs-fr img").forEach((im, i) => add(im, [{ transform: "scale(1.16)" }, { transform: "none" }], { duration: 1800, delay: 300 + (i % FRAMES.length) * 40 }));
      dirty = false;
    }
    const others = () => [...document.body.children].filter((el) => el !== cs && !el.matches(".grain, .vignette, .cur, .preview, script"));
    function lock(on) {
      others().forEach((el) => { if (on) el.setAttribute("inert", ""); else el.removeAttribute("inert"); });
      if (lenis) on ? lenis.stop() : lenis.start(); else root.style.overflow = on ? "hidden" : "";
    }
    function open(t) {
      if (state !== "closed") return;
      state = "opening"; trig = t; loadImgs();
      cs.hidden = false; cs.classList.add("open"); place(t); fitAddr(); panel.scrollTop = 0;
      tick(true); clearInterval(clockT); clockT = setInterval(() => tick(false), 1000);
      lock(true);
      if (RM) { state = "open"; panel.focus({ preventScroll: true }); return; }
      build();
      t.style.visibility = "hidden";
      anims.forEach((a) => a.play());
      panel.focus({ preventScroll: true });
      Promise.all(anims.map((a) => a.finished)).then(() => {
        if (state !== "opening") return;
        state = "open";
        if (carry) { cs.querySelector(`[data-carry="${carry.dataset.for}"]`).style.visibility = ""; carry.style.visibility = "hidden"; }
        measure();
      }).catch(() => {});
      measure();
    }
    function close() {
      if (state === "closed" || state === "closing") return;
      const t = trig;
      const finish = () => {
        state = "closed"; cs.hidden = true; cs.classList.remove("open"); clearInterval(clockT);
        anims.forEach((a) => a.cancel()); anims = []; if (carry) { carry.remove(); carry = null; }
        parts.forEach((p) => (p.style.visibility = "")); t.style.visibility = ""; lock(false);
        t.focus({ preventScroll: true }); hover = null;
      };
      if (RM) { finish(); return; }
      if (dirty && state === "open") { place(t); build(); anims.forEach((a) => { a.currentTime = a.effect.getComputedTiming().endTime; }); }
      state = "closing";
      if (carry) { const tg = cs.querySelector(`[data-carry="${carry.dataset.for}"]`); tg.style.visibility = "hidden"; carry.style.visibility = ""; }
      anims.forEach((a) => { a.playbackRate = -1.45; a.play(); });
      Promise.all(anims.map((a) => a.finished)).then(finish, finish);
    }
    trigs.forEach((t) => {
      t.setAttribute("aria-haspopup", "dialog");
      t.addEventListener("click", (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return; e.preventDefault(); open(t); });
      ["pointerenter", "focus", "touchstart"].forEach((ev) => t.addEventListener(ev, loadImgs, { once: true, passive: true }));
    });
    cs.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
    addEventListener("keydown", (e) => {
      if (state === "closed") return;
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      const f = [...panel.querySelectorAll("a[href], button, textarea")].filter((el) => el.offsetParent);
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === a || document.activeElement === panel)) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
    addEventListener("resize", () => { if (state === "closed") return; dirty = true; if (trig) place(trig); fitAddr(); measure(); });

    /* magnetic rows and a physical address: both pulled toward the cursor, never past it */
    let mx = -1e4, my = -1e4, hover = null, raf = 0, lc = [], lx = [], ly = 0, lh = 0;
    const cur = new Map(); rows.forEach((a) => cur.set(a, { n: [0, 0], g: [0, 0] }));
    function measure() { if (RM || !FINE) return; lx = letters.map((l) => { const r = l.getBoundingClientRect(); return r.left + r.width / 2; }); const r = addr.getBoundingClientRect(); ly = r.top + r.height / 2; lh = r.height; if (lc.length !== letters.length) lc = letters.map(() => 0); }
    function loop() {
      raf = 0; if (state === "closed") return;
      let moving = false;
      rows.forEach((a) => {
        const o = cur.get(a); let tn = [0, 0], tg = [0, 0];
        if (a === hover) { const r = a.getBoundingClientRect(), dx = mx - (r.left + r.width / 2), dy = my - (r.top + r.height / 2); tn = [Math.max(-14, Math.min(14, dx * 0.035)), Math.max(-4, Math.min(4, dy * 0.12))]; const g = a.querySelector(".cs-go").getBoundingClientRect(); tg = [Math.max(-10, Math.min(10, (mx - (g.left + g.width / 2)) * 0.2)), Math.max(-8, Math.min(8, (my - (g.top + g.height / 2)) * 0.28))]; }
        o.n = o.n.map((v, i) => v + (tn[i] - v) * 0.12); o.g = o.g.map((v, i) => v + (tg[i] - v) * 0.12);
        if (Math.abs(o.n[0] - tn[0]) + Math.abs(o.g[0] - tg[0]) + Math.abs(o.g[1] - tg[1]) > 0.05) moving = true;
        a.querySelector(".cs-name").style.transform = `translate3d(${o.n[0].toFixed(2)}px, ${o.n[1].toFixed(2)}px, 0)`;
        a.querySelector(".cs-go").style.transform = `translate3d(${o.g[0].toFixed(2)}px, ${o.g[1].toFixed(2)}px, 0)`;
      });
      const near = Math.max(0, 1 - Math.abs(my - ly) / (lh * 1.4 || 1));
      letters.forEach((l, i) => {
        const dx = (mx - lx[i]) / (lh * 1.3 || 1), t = -lh * 0.16 * near * Math.exp(-dx * dx);
        lc[i] += (t - lc[i]) * 0.14; if (Math.abs(t - lc[i]) > 0.05) moving = true;
        l.style.translate = `0 ${lc[i].toFixed(2)}px`;
      });
      if (moving) raf = requestAnimationFrame(loop);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    if (FINE && !RM) {
      panel.addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; kick(); }, { passive: true });
      panel.addEventListener("pointerleave", () => { mx = my = -1e4; hover = null; kick(); });
      panel.addEventListener("scroll", () => { measure(); }, { passive: true });
      rows.forEach((a) => { a.addEventListener("pointerenter", () => { hover = a; kick(); }); a.addEventListener("pointerleave", () => { if (hover === a) hover = null; kick(); }); });
    }
  }

  function boot() {
    grain(); fit(); navTone();
    if (document.fonts) { document.fonts.ready.then(fit); document.fonts.load('700 100px "Druk Wide"').then(fit).catch(() => {}); }
    addEventListener("load", fit);
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(fit, 120); });
    heroVideo(); clock(); smooth(); cursor(); preview(); posterHandoff(); players(); drift(); contactSheet();
    intro(() => {
      document.querySelectorAll("[data-hero]").forEach((el, i) => setTimeout(() => el.classList.add("in"), 120 + i * 90));
      document.querySelectorAll("[data-rv]").forEach((el) => io.observe(el));
      document.querySelectorAll("video[data-src], video[data-lazy]").forEach((v) => vio.observe(v));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
