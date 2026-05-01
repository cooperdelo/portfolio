/* ===========================================================
   Cooper Delo / Portfolio shell  v2
   - Smart asset-aware loader
   - Custom cursor
   - Particle cloud Three.js scene (replaces icosahedra)
   - World-specific 3D accent meshes (vinyl, bass guitar, dumbbell, etc.)
   - Drag-able gallery with JS-driven infinite clone
   - Page transition veil
   - Reveal on scroll
   - Contact modal
   - Countdown timer
   - Parallax divider scroll driver
   - Hero video loader
   =========================================================== */

/* ── 1. Smart loader (with debug logs) ───────────────────── */
const DEBUG = true;
const dlog = (...args) => { if (DEBUG) console.log("[shell]", ...args); };
(function () {
  const t0 = performance.now();
  dlog("loader: script executed at", t0.toFixed(0) + "ms", "readyState=" + document.readyState);
  const loader = document.getElementById("loader");
  if (!loader) { dlog("loader: no #loader element on this page"); return; }
  let dismissed = false;
  function dismiss(reason) {
    if (dismissed) { dlog("loader: dismiss() ignored —", reason, "(already dismissed)"); return; }
    dismissed = true;
    const elapsed = (performance.now() - t0).toFixed(0);
    dlog("loader: DISMISSING after", elapsed + "ms —", reason);
    loader.classList.add("done");
    setTimeout(() => {
      loader.style.display = "none";
      dlog("loader: display:none applied (animation complete)");
    }, 1300);
  }
  // Max wait: 2.2s regardless of assets
  const maxTimer = setTimeout(() => dismiss("max-wait timer (2.2s)"), 2200);
  // Fast path: window.load + 200ms
  window.addEventListener("load", () => {
    const elapsed = (performance.now() - t0).toFixed(0);
    dlog("loader: window.load fired at", elapsed + "ms");
    clearTimeout(maxTimer);
    setTimeout(() => dismiss("window.load + 200ms"), 200);
  });
  // Bonus: also watch for hero image
  const heroImg = document.querySelector(".hero-bg img");
  if (heroImg) {
    if (heroImg.complete) {
      dlog("loader: hero image was already complete at script start");
      clearTimeout(maxTimer);
      setTimeout(() => dismiss("hero image already complete"), 300);
    } else {
      heroImg.addEventListener("load", () => {
        const elapsed = (performance.now() - t0).toFixed(0);
        dlog("loader: hero image loaded at", elapsed + "ms");
        clearTimeout(maxTimer);
        setTimeout(() => dismiss("hero image load"), 300);
      }, { once: true });
      heroImg.addEventListener("error", () => dlog("loader: hero image FAILED to load"));
    }
  } else {
    dlog("loader: no .hero-bg img on this page");
  }
  // Catch errors that might block things
  window.addEventListener("error", (e) => {
    dlog("WINDOW ERROR:", e.message, "@", e.filename + ":" + e.lineno);
  });
})();

/* ── 2. Custom cursor ────────────────────────────────────── */
(function () {
  const cursor = document.getElementById("cursor");
  if (!cursor) return;
  document.addEventListener("mousemove", (e) => {
    cursor.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px) translate(-50%,-50%)";
  });
  function bind() {
    document.querySelectorAll("[data-cursor],a,button").forEach((el) => {
      if (el.dataset._bound) return;
      el.dataset._bound = "1";
      el.addEventListener("mouseenter", () => {
        cursor.classList.add("hover");
        cursor.textContent = el.getAttribute("data-cursor") || "";
      });
      el.addEventListener("mouseleave", () => {
        cursor.classList.remove("hover");
        cursor.textContent = "";
      });
    });
  }
  bind(); setTimeout(bind, 300);
})();

/* ── 3. Reveal on scroll ─────────────────────────────────── */
(function () {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in"); }),
    { threshold: 0.14 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
})();

/* ── 4. Nav: scroll state + sliding indicator + progress ─── */
(function () {
  const nav = document.getElementById("topnav");
  if (!nav) return;
  function onScroll() { nav.classList.toggle("scrolled", window.scrollY > 24); }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const indicator = document.getElementById("navIndicator");
  const navLinks = document.getElementById("navLinks");
  const links = navLinks ? navLinks.querySelectorAll(".nav-link") : [];
  let activeEl = navLinks ? (navLinks.querySelector(".nav-link.active") || links[0]) : null;
  function moveTo(el) {
    if (!el || !indicator || !navLinks) return;
    const r = el.getBoundingClientRect(), p = navLinks.getBoundingClientRect();
    indicator.style.transform = "translateX(" + (r.left - p.left) + "px)";
    indicator.style.width = r.width + "px";
  }
  if (indicator && activeEl) requestAnimationFrame(() => { moveTo(activeEl); indicator.classList.add("ready"); });
  links.forEach((l) => {
    l.addEventListener("mouseenter", () => moveTo(l));
    l.addEventListener("mouseleave", () => moveTo(activeEl));
  });
  window.addEventListener("resize", () => moveTo(activeEl));

  const bar = document.getElementById("navProgress");
  if (bar) {
    function updateProgress() {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (docH > 0 ? Math.min(1, window.scrollY / docH) * 100 : 0) + "%";
    }
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
  }
})();

/* ── 5. Hero name reveal ─────────────────────────────────── */
(function () {
  const t = document.getElementById("hero-title");
  if (t) setTimeout(() => t.classList.add("in"), 1900);
})();

/* ── 6. Photo frame 3D tilt ──────────────────────────────── */
(function () {
  document.querySelectorAll(".photo-frame").forEach((frame) => {
    const photo = frame.querySelector(".photo");
    if (photo && !photo.querySelector(".photo-grain")) {
      const g = document.createElement("div"); g.className = "photo-grain"; photo.appendChild(g);
    }
    frame.addEventListener("mousemove", (e) => {
      const r = frame.getBoundingClientRect();
      const cx = (e.clientX - r.left) / r.width, cy = (e.clientY - r.top) / r.height;
      frame.style.transform =
        "perspective(1800px) rotateX(" + ((cy - 0.5) * -8) + "deg) rotateY(" + ((cx - 0.5) * 12) + "deg) translateY(-4px) scale(1.012)";
      frame.style.transition = "transform 0.08s linear";
    });
    frame.addEventListener("mouseleave", () => {
      frame.style.transform = "";
      frame.style.transition = "transform 0.85s cubic-bezier(0.22,1,0.36,1)";
    });
  });
})();

/* ── 7. Hero parallax + floating lead ───────────────────── */
(function () {
  const bg = document.querySelector(".hero-bg img");
  const heading = document.getElementById("hero-title");
  const lead = document.querySelector(".hero-bottom .lead-glass");
  let mx = 0, my = 0, sx = 0, sy = 0;
  document.addEventListener("mousemove", (e) => {
    mx = (e.clientX / window.innerWidth) - 0.5;
    my = (e.clientY / window.innerHeight) - 0.5;
  });
  function loop() {
    sx += (mx - sx) * 0.05; sy += (my - sy) * 0.05;
    if (bg) bg.style.transform = "scale(1.08) translate3d(" + (-sx * 16) + "px," + (-sy * 16) + "px,0)";
    if (heading) {
      heading.style.transform =
        "perspective(1600px) rotateX(" + (sy * -3) + "deg) rotateY(" + (sx * 5) + "deg)" +
        " translateZ(" + (-Math.abs(sx) * 8 - Math.abs(sy) * 8) + "px)" +
        " translateX(" + (sx * 18) + "px) translateY(" + (sy * 12) + "px)";
    }
    if (lead) lead.style.transform = "translate3d(" + (sx * -8) + "px," + (sy * -6) + "px,0)";
    requestAnimationFrame(loop);
  }
  loop();
})();

/* ── 8. Role cycler ──────────────────────────────────────── */
(function () {
  const roleInner = document.getElementById("roleInner");
  if (!roleInner) return;
  const count = roleInner.children.length; let i = 0;
  setInterval(() => {
    i = (i + 1) % count;
    roleInner.style.transform = "translateY(-" + (i * 2.4) + "rem)";
  }, 2200);
})();

/* ── 9. Mobile hamburger ─────────────────────────────────── */
(function () {
  const nav = document.getElementById("topnav"); if (!nav) return;
  const btn = document.createElement("button");
  btn.className = "mob-menu-btn"; btn.setAttribute("aria-label", "Menu");
  btn.innerHTML = "<span></span><span></span><span></span>"; nav.appendChild(btn);
  const navDefs = [
    { href: "index.html",       label: "Home",        tr: "HOME"      },
    { href: "plugverse.html",   label: "Plugverse",   tr: "PLUGVERSE" },
    { href: "rubber-band.html", label: "Rubber Band", tr: "MUSIC"     },
    { href: "builder.html",     label: "Builder",     tr: "BUILDER"   },
    { href: "athletic.html",    label: "Athletic",    tr: "ATHLETIC"  },
    { href: "now.html",         label: "Now",         tr: "NOW"       },
  ];
  const page = location.pathname.split("/").pop() || "index.html";
  const overlay = document.createElement("div");
  overlay.className = "mob-nav-overlay";
  overlay.innerHTML = navDefs.map(l =>
    `<a href="${l.href}" data-transition="${l.tr}" class="${l.href === page ? "active" : ""}">${l.label}</a>`
  ).join("") + `<button class="mob-cta" data-contact>Get in touch</button>`;
  document.body.appendChild(overlay);
  function close() { btn.classList.remove("open"); overlay.classList.remove("open"); document.body.style.overflow = ""; }
  btn.addEventListener("click", () => {
    const open = btn.classList.toggle("open");
    overlay.classList.toggle("open", open);
    document.body.style.overflow = open ? "hidden" : "";
  });
  overlay.querySelectorAll("a,.mob-cta").forEach(el => el.addEventListener("click", close));
})();

/* ── 10. Three.js scene — DISABLED (was distracting from content) ── */
(function () {
  // Hide the canvas so it doesn't render anything
  const canvas = document.getElementById("scene-canvas");
  if (canvas) canvas.style.display = "none";
  return;
  /* legacy scene below — kept disabled by the early return above */
  if (!window.THREE) return;
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 5;

  /* World configs */
  const WORLDS = {
    default:           { c: [0xFF4D2E, 0xFF4D2E, 0xC8102E], op: 0.28, gc: 0xFF4D2E, go: 0.04, sc: 1.0  },
    "world-plugverse": { c: [0xFF4D2E, 0xC8102E, 0xFF6B4A], op: 0.38, gc: 0xC8102E, go: 0.06, sc: 1.1  },
    "world-rubber":    { c: [0xC8102E, 0x6B3FA0, 0xC8102E], op: 0.30, gc: 0x6B3FA0, go: 0.05, sc: 0.95 },
    "world-cooper":    { c: [0xF2C1D1, 0xC9BEE6, 0xB2E3E1], op: 0.26, gc: 0xC9BEE6, go: 0.04, sc: 1.05 },
    "world-builder":   { c: [0xF2EDE4, 0xC2B7A4, 0xF2EDE4], op: 0.16, gc: 0xF2EDE4, go: 0.02, sc: 0.85 },
    "world-athletic":  { c: [0x2C4F3A, 0x5A9DC4, 0x2C4F3A], op: 0.22, gc: 0x5A9DC4, go: 0.04, sc: 1.0  },
  };

  let target = { ...WORLDS.default }, targetKey = "default";
  let current = {
    c: WORLDS.default.c.map(h => new THREE.Color(h)),
    op: WORLDS.default.op,
    gc: new THREE.Color(WORLDS.default.gc),
    go: WORLDS.default.go,
    sc: WORLDS.default.sc,
  };

  /* Section world watcher */
  const worldSections = document.querySelectorAll("[class*='world-']");
  if (worldSections.length) {
    const wio = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const cls = [...e.target.classList].find(c => c.startsWith("world-"));
        targetKey = cls || "default";
        target = WORLDS[cls] || WORLDS.default;
      });
    }, { threshold: 0.3 });
    worldSections.forEach(s => wio.observe(s));
  }

  /* ─── Particle clusters (replace old icosahedra) ─── */
  const CLUSTER_DEFS = [
    { center: [-2.8, 0.5, -2.5], count: 200, radius: 3.2 },
    { center: [0,   -0.5, -3.5], count: 180, radius: 2.6 },
    { center: [3.0,  0.4, -4.5], count: 220, radius: 3.8 },
  ];
  const particleSystems = [];
  CLUSTER_DEFS.forEach((def, ci) => {
    const count = def.count;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const phi = Math.random() * Math.PI * 2;
      const cosT = Math.random() * 2 - 1;
      const sinT = Math.sqrt(1 - cosT * cosT);
      const r = Math.cbrt(Math.random()) * def.radius;
      pos[i * 3]     = def.center[0] + r * sinT * Math.cos(phi);
      pos[i * 3 + 1] = def.center[1] + r * sinT * Math.sin(phi);
      pos[i * 3 + 2] = def.center[2] + r * cosT;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.userData.base = { x: def.center[0], y: def.center[1] };
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(WORLDS.default.c[ci]),
      size: 0.022, transparent: true,
      opacity: WORLDS.default.op,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const ps = new THREE.Points(geo, mat);
    scene.add(ps);
    particleSystems.push(ps);
  });

  /* ─── Glow sphere ─── */
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xFF4D2E, transparent: true, opacity: 0.04 });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(2.8, 24, 24), glowMat);
  glow.position.set(0, 0, -3.5);
  scene.add(glow);

  /* ─── World accent mesh builders ─── */
  function makeWireMat(hex, op) {
    return new THREE.MeshBasicMaterial({ color: hex, wireframe: true, transparent: true, opacity: op });
  }
  function makeLineMat(hex, op) {
    return new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: op });
  }

  /* Bass guitar (world-rubber) */
  function buildBassGuitar() {
    const g = new THREE.Group();
    const mat = () => makeWireMat(0xC8102E, 0);
    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.9, 0.16), mat());
    g.add(body);
    // Cutaway (second box overlapping)
    const cut = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.95, 0.18), mat());
    cut.position.set(0.5, 0.55, 0); g.add(cut);
    // Neck
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.9, 0.12), mat());
    neck.position.set(-0.08, 2.4, 0); g.add(neck);
    // Headstock
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.12), mat());
    head.position.set(-0.08, 4.05, 0); g.add(head);
    // Tuning pegs
    [-0.28, 0.12].forEach((x, i) => {
      const peg = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), mat());
      peg.position.set(x + (i * 0.05), 4.32, 0); g.add(peg);
    });
    g.position.set(3.8, 0, -1.5);
    g.rotation.z = -0.18;
    g.scale.setScalar(0.52);
    return g;
  }

  /* Vinyl record (world-cooper) */
  function buildVinylRecord() {
    const g = new THREE.Group();
    // Outer disc
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.07, 48),
      new THREE.MeshBasicMaterial({ color: 0x0e0c0a, transparent: true, opacity: 0 }));
    g.add(disc);
    // Groove rings
    [1.85, 1.65, 1.48, 1.32, 1.18, 1.04, 0.9, 0.76].forEach(r => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.007, 6, 72),
        new THREE.MeshBasicMaterial({ color: 0xC9BEE6, transparent: true, opacity: 0 }));
      ring.rotation.x = Math.PI / 2; g.add(ring);
    });
    // Label
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.09, 28),
      new THREE.MeshBasicMaterial({ color: 0xF2C1D1, transparent: true, opacity: 0 }));
    g.add(label);
    // Center hole
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.12, 12),
      new THREE.MeshBasicMaterial({ color: 0xF4EFE6, transparent: true, opacity: 0 }));
    g.add(hole);
    // Highlight arc
    const arcCurve = new THREE.EllipseCurve(-0.6, -0.6, 1.7, 1.7, 2.9, 4.5, false, 0);
    const arcPts = arcCurve.getPoints(40);
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts.map(p => new THREE.Vector3(p.x, 0, p.y)));
    const arc = new THREE.Line(arcGeo, makeLineMat(0xffffff, 0));
    g.add(arc);
    g.position.set(3.2, 0, -1.2);
    g.rotation.x = 0.2;
    g.scale.setScalar(0.7);
    return g;
  }

  /* Dumbbell (world-athletic) */
  function buildDumbbell() {
    const g = new THREE.Group();
    const mat = () => makeWireMat(0x5A9DC4, 0);
    // Bar
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.9, 8), mat());
    bar.rotation.z = Math.PI / 2; g.add(bar);
    // Weights
    [-1.3, 1.3].forEach(x => {
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.3, 12), mat());
      outer.rotation.z = Math.PI / 2; outer.position.x = x; g.add(outer);
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.36, 10), mat());
      inner.rotation.z = Math.PI / 2; inner.position.x = x * 1.05; g.add(inner);
    });
    g.position.set(3.4, 0, -1.8);
    g.rotation.z = 0.25;
    g.scale.setScalar(0.58);
    return g;
  }

  /* Audio meter bars (world-plugverse) */
  function buildAudioMeter() {
    const g = new THREE.Group();
    const mat = () => makeWireMat(0xFF4D2E, 0);
    const heights = [0.7, 1.5, 1.1, 1.8, 0.9, 1.4, 0.6];
    heights.forEach((h, i) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, h, 0.1), mat());
      bar.position.set(i * 0.22 - 0.66, h / 2 - 0.5, 0);
      bar.userData.baseH = h;
      bar.userData.idx = i;
      g.add(bar);
    });
    g.position.set(-3.4, -0.2, -1.5);
    g.scale.setScalar(0.7);
    return g;
  }

  /* Laptop outline (world-builder) */
  function buildLaptop() {
    const g = new THREE.Group();
    const mat = () => makeWireMat(0xF2EDE4, 0);
    // Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.65), mat());
    g.add(base);
    // Screen (hinged at back)
    const screen = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.07), mat());
    screen.position.set(0, 0.85, -0.79);
    screen.rotation.x = -0.28;
    g.add(screen);
    // Keyboard rows (visual detail)
    for (let row = 0; row < 3; row++) {
      const kb = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.03, 0.22), mat());
      kb.position.set(0, 0.07, -0.3 + row * 0.28); g.add(kb);
    }
    g.position.set(3.5, -0.2, -1.5);
    g.rotation.y = -0.35;
    g.scale.setScalar(0.6);
    return g;
  }

  /* Build all accent groups */
  const accentMap = {
    "world-rubber":    buildBassGuitar(),
    "world-cooper":    buildVinylRecord(),
    "world-athletic":  buildDumbbell(),
    "world-plugverse": buildAudioMeter(),
    "world-builder":   buildLaptop(),
  };
  Object.values(accentMap).forEach(g => scene.add(g));

  /* Collect all materials in an accent group for opacity targeting */
  function getGroupMats(group) {
    const mats = [];
    group.traverse(obj => { if (obj.material) mats.push(obj.material); });
    return mats;
  }
  const accentMats = {};
  Object.entries(accentMap).forEach(([k, g]) => { accentMats[k] = getGroupMats(g); });

  /* Mouse tracking */
  let mx = 0, my = 0, sx = 0, sy = 0;
  document.addEventListener("mousemove", (e) => {
    mx = (e.clientX / window.innerWidth) * 2 - 1;
    my = -((e.clientY / window.innerHeight) * 2 - 1);
  });

  const lerp = (a, b, t) => a + (b - a) * t;

  function animate(time) {
    const t = time * 0.0003;
    sx += (mx - sx) * 0.04; sy += (my - sy) * 0.04;

    /* Interpolate world */
    const sp = 0.018;
    current.op = lerp(current.op, target.op, sp);
    current.go = lerp(current.go, target.go, sp);
    current.sc = lerp(current.sc, target.sc, sp);
    current.gc.lerp(new THREE.Color(target.gc), sp);
    current.c.forEach((col, i) => col.lerp(new THREE.Color(target.c[i]), sp));

    /* Particle clusters */
    particleSystems.forEach((ps, i) => {
      ps.rotation.x = t * (0.08 + i * 0.03);
      ps.rotation.y = t * (0.12 + i * 0.02);
      ps.position.x = ps.geometry.userData.base.x + sx * 0.3;
      ps.position.y = ps.geometry.userData.base.y + sy * 0.3 + Math.sin(t * 0.6 + i * 1.2) * 0.15;
      ps.scale.setScalar(current.sc);
      ps.material.color.copy(current.c[i]);
      ps.material.opacity = current.op;
    });

    /* Glow */
    glow.material.color.copy(current.gc);
    glow.material.opacity = current.go;

    /* Accent meshes: fade in active world's mesh, fade out others */
    Object.entries(accentMap).forEach(([key, group]) => {
      const isActive = (targetKey === key);
      const targetOp = isActive ? (key === "world-rubber" ? 0.48 : key === "world-cooper" ? 0.55 : 0.42) : 0;
      const mats = accentMats[key];
      mats.forEach(mat => { mat.opacity = lerp(mat.opacity, targetOp, 0.03); });

      /* Rotate accent meshes */
      if (key === "world-cooper") {
        group.rotation.y = t * 0.5; // vinyl spins
      } else if (key === "world-rubber") {
        group.rotation.y = Math.sin(t * 0.4) * 0.35;
      } else if (key === "world-athletic") {
        group.rotation.z = Math.sin(t * 0.3) * 0.18 + 0.25;
      } else if (key === "world-builder") {
        group.rotation.y = Math.sin(t * 0.25) * 0.2 - 0.35;
      } else if (key === "world-plugverse") {
        /* Animate audio meter bar heights */
        group.children.forEach((bar, i) => {
          if (bar.userData.baseH !== undefined) {
            const newH = bar.userData.baseH * (0.5 + 0.5 * Math.abs(Math.sin(t * (2.5 + i * 0.7))));
            bar.scale.y = newH;
          }
        });
      }

      /* Mouse parallax on accent */
      if (isActive && group.userData.baseX !== undefined) {
        group.position.x = group.userData.baseX + sx * 0.25;
        group.position.y = group.userData.baseY + sy * 0.18;
      }
    });

    /* Camera drift */
    camera.position.x += (sx * 0.22 - camera.position.x) * 0.04;
    camera.position.y += (sy * 0.22 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  /* Store base positions BEFORE first animate frame */
  Object.values(accentMap).forEach(g => {
    g.userData.baseX = g.position.x;
    g.userData.baseY = g.position.y;
  });

  animate(0);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

/* ── 11. Auto-scrolling gallery (drag disabled) ────── */
(function () {
  const root = document.getElementById("drag-gallery");
  const track = document.getElementById("dragTrack");
  if (!root || !track) return;

  /* Clone the original cards once for seamless infinite loop */
  const origCards = [...track.children].filter(c => !c.dataset.clone);
  origCards.forEach(card => {
    const clone = card.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.dataset.clone = "1";
    track.appendChild(clone);
  });

  /* Remove any pre-existing HTML clones (aria-hidden cards baked into HTML) */
  [...track.children].forEach(c => {
    if (c.hasAttribute("aria-hidden") && !c.dataset.clone) track.removeChild(c);
  });

  /* Subtle 3D tilt on hover only — no drag interaction */
  track.querySelectorAll(".drag-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const cx = (e.clientX - r.left) / r.width, cy = (e.clientY - r.top) / r.height;
      card.style.transform = "perspective(1400px) rotateX(" + ((cy - 0.5) * -6) + "deg) rotateY(" + ((cx - 0.5) * 9) + "deg)";
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "perspective(1400px) rotateX(0) rotateY(0)";
    });
  });

  /* Auto-scroll only — no drag, no wheel hijack */
  let offset = 0;
  let speed = -1.2;
  let isHovering = false;

  function halfWidth() { return track.scrollWidth / 2; }
  function apply() { track.style.transform = "translateY(-50%) translate3d(" + offset + "px,0,0)"; }
  apply();

  root.addEventListener("mouseenter", () => { isHovering = true; });
  root.addEventListener("mouseleave", () => { isHovering = false; });

  function loop() {
    // Slow down on hover, full speed otherwise
    const target = isHovering ? -0.25 : -1.2;
    speed += (target - speed) * 0.05;
    offset += speed;
    const half = halfWidth();
    if (half > 0) { while (offset <= -half) offset += half; while (offset > 0) offset -= half; }
    apply();
    requestAnimationFrame(loop);
  }
  loop();
})();

/* ── 12. Page transition veil — cinematic flash ─────────── */
(function () {
  const veil = document.getElementById("veil"); if (!veil) return;
  const label = veil.querySelector(".label");
  const internal = (href) => /^[a-z0-9\-]+\.html(\#.*)?$/i.test(href) || href === "/" || href.startsWith("./");

  // Inject extra layers for the multi-stage flash if not present
  if (!veil.querySelector(".veil-flash")) {
    const flash = document.createElement("div"); flash.className = "veil-flash"; veil.appendChild(flash);
    const slabs = document.createElement("div"); slabs.className = "veil-slabs";
    slabs.innerHTML = '<span></span><span></span><span></span><span></span><span></span>';
    veil.appendChild(slabs);
  }

  document.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href"); if (!href || !internal(href) || a.dataset.noTransition) return;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const text = (a.dataset.transition || a.textContent || "").trim().toUpperCase();
      dlog("transition: navigating to", href, "label=" + text);
      label.textContent = text;
      veil.classList.remove("out");
      veil.classList.add("in");
      // Navigate after the slab animation completes
      setTimeout(() => { window.location.href = href; }, 750);
    });
  });

  // On arrival: play the exit flash
  function playExit() {
    veil.classList.remove("in");
    veil.classList.add("out");
    setTimeout(() => veil.classList.remove("out"), 1100);
  }
  window.addEventListener("pageshow", playExit);
  // Belt-and-suspenders if pageshow doesn't fire
  if (document.readyState !== "loading") setTimeout(playExit, 50);
})();

/* ── 13. Contact modal ───────────────────────────────────── */
(function () {
  const modal = document.getElementById("modal"); if (!modal) return;
  function open() { modal.classList.add("open"); }
  function close() { modal.classList.remove("open"); }
  document.querySelectorAll("[data-contact]").forEach(el => el.addEventListener("click", (e) => { e.preventDefault(); open(); }));
  const closeBtn = document.getElementById("closeModal");
  if (closeBtn) closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  const toast = document.getElementById("toast");
  function showToast(msg) {
    if (!toast) return; toast.textContent = msg; toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1800);
  }
  function copyEmail() {
    const email = "cooperdelo6@gmail.com";
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(email).then(() => showToast("Copied")).catch(legacy);
    else legacy();
    function legacy() {
      const ta = document.createElement("textarea"); ta.value = email;
      ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta);
      ta.select(); try { document.execCommand("copy"); showToast("Copied"); } catch { showToast("Failed"); }
      document.body.removeChild(ta);
    }
  }
  const copyBtn = document.getElementById("copyBtn");
  if (copyBtn) copyBtn.addEventListener("click", copyEmail);
})();

/* ── 14. Countdown timer ─────────────────────────────────── */
(function () {
  const el = document.getElementById("countdown");
  if (!el) return;
  const target = new Date(el.dataset.target || "2026-08-01T00:00:00");
  const dDays = document.getElementById("cd-days");
  const dHrs  = document.getElementById("cd-hrs");
  const dMins = document.getElementById("cd-mins");
  const dSecs = document.getElementById("cd-secs");
  if (!dDays) return;
  function pad(n) { return String(Math.max(0, n)).padStart(2, "0"); }
  function tick() {
    const diff = Math.max(0, target - Date.now());
    const s = Math.floor(diff / 1000);
    dDays.textContent = pad(Math.floor(s / 86400));
    dHrs.textContent  = pad(Math.floor((s % 86400) / 3600));
    dMins.textContent = pad(Math.floor((s % 3600) / 60));
    dSecs.textContent = pad(s % 60);
  }
  tick(); setInterval(tick, 1000);
})();

/* ── 15. Parallax dividers (scroll-driven) ───────────────── */
(function () {
  const dividers = document.querySelectorAll(".parallax-divider");
  if (!dividers.length) return;
  function update() {
    dividers.forEach(div => {
      const img = div.querySelector(".para-img"); if (!img) return;
      const rect = div.getBoundingClientRect();
      const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
      const shift = (progress - 0.5) * 80;
      img.style.transform = "translateY(" + shift + "px)";
    });
  }
  window.addEventListener("scroll", update, { passive: true }); update();
})();

/* ── 16. Hero video: fade in once loaded ─────────────────── */
(function () {
  const heroBg = document.querySelector(".hero-bg"); if (!heroBg) return;
  const vid = heroBg.querySelector("video"); if (!vid) return;
  function enable() { heroBg.classList.add("video-loaded"); }
  if (vid.readyState >= 3) enable();
  else vid.addEventListener("canplaythrough", enable, { once: true });
})();
