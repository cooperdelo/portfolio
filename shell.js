/* ===========================================================
   Cooper Delo / Portfolio shell
   - Custom cursor (1:1)
   - Scroll-locked Three.js morphing scene
   - Drag-able 3D project gallery (initialized on demand)
   - Page transition veil
   - Reveal-on-scroll
   - Contact modal
   =========================================================== */

(function () {
  // shell.js runs after <body> is parsed — no need to wait for window.load,
  // which gets blocked by large video files (.MOV) on music pages.
  const loader = document.getElementById("loader");
  if (loader) setTimeout(() => loader.classList.add("done"), 1800);
})();

// Cursor (tight tracking)
(function () {
  const cursor = document.getElementById("cursor");
  if (!cursor) return;
  document.addEventListener("mousemove", (e) => {
    cursor.style.transform = "translate(" + e.clientX + "px, " + e.clientY + "px) translate(-50%, -50%)";
  });
  function bind() {
    document.querySelectorAll("[data-cursor], a, button").forEach((el) => {
      if (el.dataset._bound) return;
      el.dataset._bound = "1";
      el.addEventListener("mouseenter", () => {
        cursor.classList.add("hover");
        const label = el.getAttribute("data-cursor");
        cursor.textContent = label || "";
      });
      el.addEventListener("mouseleave", () => {
        cursor.classList.remove("hover");
        cursor.textContent = "";
      });
    });
  }
  bind();
  setTimeout(bind, 300);
})();

// Reveal on scroll
(function () {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in"); }),
    { threshold: 0.18 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
})();

// Nav scroll state + sliding indicator + progress bar
(function () {
  const nav = document.getElementById("topnav");
  if (!nav) return;

  function onScroll() { nav.classList.toggle("scrolled", window.scrollY > 24); }
  onScroll();
  window.addEventListener("scroll", onScroll);

  // Sliding indicator
  const indicator = document.getElementById("navIndicator");
  const navLinks = document.getElementById("navLinks");
  const links = navLinks ? navLinks.querySelectorAll(".nav-link") : [];
  let activeEl = navLinks ? (navLinks.querySelector(".nav-link.active") || links[0]) : null;

  function moveTo(el) {
    if (!el || !indicator || !navLinks) return;
    const r = el.getBoundingClientRect();
    const parentR = navLinks.getBoundingClientRect();
    const x = r.left - parentR.left;
    indicator.style.transform = "translateX(" + x + "px)";
    indicator.style.width = r.width + "px";
  }
  if (indicator && activeEl) {
    requestAnimationFrame(() => {
      moveTo(activeEl);
      indicator.classList.add("ready");
    });
  }
  links.forEach((l) => {
    l.addEventListener("mouseenter", () => moveTo(l));
    l.addEventListener("mouseleave", () => moveTo(activeEl));
  });
  window.addEventListener("resize", () => moveTo(activeEl));

  // Scroll progress
  const bar = document.getElementById("navProgress");
  if (bar) {
    function updateProgress() {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const p = docH > 0 ? Math.min(1, window.scrollY / docH) : 0;
      bar.style.width = (p * 100) + "%";
    }
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
  }
})();

// Hero name reveal
(function () {
  const t = document.getElementById("hero-title");
  if (t) setTimeout(() => t.classList.add("in"), 1900);
})();

// 3D tilt on every .photo-frame so the entire casing moves as one
(function () {
  const frames = document.querySelectorAll(".photo-frame");
  frames.forEach((frame) => {
    const photo = frame.querySelector(".photo");
    if (photo && !photo.querySelector(".photo-grain")) {
      const g = document.createElement("div");
      g.className = "photo-grain";
      photo.appendChild(g);
    }
    frame.addEventListener("mousemove", (e) => {
      const r = frame.getBoundingClientRect();
      const cx = (e.clientX - r.left) / r.width;
      const cy = (e.clientY - r.top) / r.height;
      const rx = (cy - 0.5) * -8;
      const ry = (cx - 0.5) * 12;
      frame.style.transform =
        "perspective(1800px) rotateX(" + rx + "deg) rotateY(" + ry + "deg) translateY(-4px) scale(1.012)";
      frame.style.transition = "transform 0.08s linear";
    });
    frame.addEventListener("mouseleave", () => {
      // Clear inline transform so CSS rest tilt re-applies smoothly
      frame.style.transform = "";
      frame.style.transition = "transform 0.85s cubic-bezier(0.22, 1, 0.36, 1)";
    });
  });
})();

// Hero photo subtle drift + heading floating tilt
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
    sx += (mx - sx) * 0.05;
    sy += (my - sy) * 0.05;
    if (bg) bg.style.transform = "scale(1.08) translate3d(" + (-sx * 16) + "px, " + (-sy * 16) + "px, 0)";
    if (heading) {
      const rx = sy * -3;
      const ry = sx * 5;
      const tz = -Math.abs(sx) * 8 - Math.abs(sy) * 8;
      heading.style.transform = "perspective(1600px) rotateX(" + rx + "deg) rotateY(" + ry + "deg) translateZ(" + tz + "px) translateX(" + (sx * 18) + "px) translateY(" + (sy * 12) + "px)";
    }
    if (lead) {
      lead.style.transform = "translate3d(" + (sx * -8) + "px, " + (sy * -6) + "px, 0)";
    }
    requestAnimationFrame(loop);
  }
  loop();
})();

// Role cycler
(function () {
  const roleInner = document.getElementById("roleInner");
  if (!roleInner) return;
  const count = roleInner.children.length;
  let i = 0;
  setInterval(() => {
    i = (i + 1) % count;
    roleInner.style.transform = "translateY(-" + (i * 2.4) + "rem)";
  }, 2200);
})();

/* ----------------------------
   Mobile hamburger nav
---------------------------- */
(function () {
  const nav = document.getElementById("topnav");
  if (!nav) return;

  // Inject hamburger button
  const btn = document.createElement("button");
  btn.className = "mob-menu-btn";
  btn.setAttribute("aria-label", "Menu");
  btn.innerHTML = "<span></span><span></span><span></span>";
  nav.appendChild(btn);

  // Inject full-screen overlay with links matching every page's nav
  const links = [
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
  overlay.innerHTML = links.map(l =>
    `<a href="${l.href}" data-transition="${l.tr}" class="${l.href === page ? "active" : ""}">${l.label}</a>`
  ).join("") + `<button class="mob-cta" data-contact>Get in touch</button>`;
  document.body.appendChild(overlay);

  function close() {
    btn.classList.remove("open");
    overlay.classList.remove("open");
    document.body.style.overflow = "";
  }
  btn.addEventListener("click", () => {
    const open = btn.classList.toggle("open");
    overlay.classList.toggle("open", open);
    document.body.style.overflow = open ? "hidden" : "";
  });
  overlay.querySelectorAll("a, .mob-cta").forEach(el => el.addEventListener("click", close));
})();

/* ----------------------------
   Three.js morphing scene — section-aware
---------------------------- */
(function () {
  if (!window.THREE) return;
  const canvas = document.getElementById("scene-canvas");
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 5;

  // Per-world configs: [color0, color1, color2, opacity, glowColor, glowOpacity, scale]
  const WORLDS = {
    default:         { c: [0xFF4D2E, 0xFF4D2E, 0xC8102E], op: 0.10, gc: 0xFF4D2E, go: 0.04, sc: 1.0 },
    "world-plugverse":{ c: [0xFF4D2E, 0xC8102E, 0xFF4D2E], op: 0.13, gc: 0xC8102E, go: 0.06, sc: 1.1 },
    "world-rubber":  { c: [0xC8102E, 0x6B3FA0, 0xC8102E], op: 0.11, gc: 0x6B3FA0, go: 0.05, sc: 0.95 },
    "world-cooper":  { c: [0xF2C1D1, 0xC9BEE6, 0xB2E3E1], op: 0.10, gc: 0xC9BEE6, go: 0.04, sc: 1.05 },
    "world-builder": { c: [0xF2EDE4, 0xC2B7A4, 0xF2EDE4], op: 0.06, gc: 0xF2EDE4, go: 0.02, sc: 0.85 },
    "world-athletic":{ c: [0x2C4F3A, 0x5A9DC4, 0x2C4F3A], op: 0.09, gc: 0x5A9DC4, go: 0.04, sc: 1.0 },
  };

  let target = { ...WORLDS.default };
  let current = {
    c: WORLDS.default.c.map(h => new THREE.Color(h)),
    op: WORLDS.default.op,
    gc: new THREE.Color(WORLDS.default.gc),
    go: WORLDS.default.go,
    sc: WORLDS.default.sc,
  };

  // Watch which section world is most in view
  const worldSections = document.querySelectorAll("[class*='world-']");
  if (worldSections.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const cls = [...e.target.classList].find(c => c.startsWith("world-"));
        target = WORLDS[cls] || WORLDS.default;
      });
    }, { threshold: 0.35 });
    worldSections.forEach(s => io.observe(s));
  }

  const meshes = [];
  const BASE_POS = [[-2.8, 0.4, -2], [0, -0.4, -3], [2.8, 0.4, -4]];
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.IcosahedronGeometry(1.4, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(WORLDS.default.c[i]),
      transparent: true,
      opacity: WORLDS.default.op,
      wireframe: true
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...BASE_POS[i]);
    m.userData.base = { x: BASE_POS[i][0], y: BASE_POS[i][1] };
    scene.add(m);
    meshes.push(m);
  }

  const glowGeo = new THREE.SphereGeometry(2.4, 32, 32);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xFF4D2E, transparent: true, opacity: 0.04 });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(0, 0, -3);
  scene.add(glow);

  let mx = 0, my = 0, sx = 0, sy = 0;
  document.addEventListener("mousemove", (e) => {
    mx = (e.clientX / window.innerWidth) * 2 - 1;
    my = -((e.clientY / window.innerHeight) * 2 - 1);
  });

  const lerp = (a, b, t) => a + (b - a) * t;

  function animate(time) {
    const t = time * 0.0003;
    sx += (mx - sx) * 0.04;
    sy += (my - sy) * 0.04;

    // Smoothly interpolate toward target world
    const speed = 0.018;
    current.op  = lerp(current.op,  target.op,  speed);
    current.go  = lerp(current.go,  target.go,  speed);
    current.sc  = lerp(current.sc,  target.sc,  speed);
    current.gc.lerp(new THREE.Color(target.gc), speed);
    current.c.forEach((col, i) => col.lerp(new THREE.Color(target.c[i]), speed));

    meshes.forEach((m, i) => {
      m.rotation.x = t * (0.35 + i * 0.09);
      m.rotation.y = t * (0.55 + i * 0.07);
      m.position.x = m.userData.base.x + sx * 0.35;
      m.position.y = m.userData.base.y + sy * 0.35 + Math.sin(t * 1.8 + i) * 0.18;
      m.scale.setScalar(current.sc);
      m.material.color.copy(current.c[i]);
      m.material.opacity = current.op;
    });

    glow.material.color.copy(current.gc);
    glow.material.opacity = current.go;

    camera.position.x += (sx * 0.25 - camera.position.x) * 0.04;
    camera.position.y += (sy * 0.25 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate(0);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

/* ----------------------------
   Drag gallery: infinite right-to-left auto-scroll with hover slowdown
---------------------------- */
(function () {
  const root = document.getElementById("drag-gallery");
  const track = document.getElementById("dragTrack");
  if (!root || !track) return;

  // Halve point: where we wrap. The track is duplicated so we wrap at -halfWidth.
  function halfTrackWidth() {
    return track.scrollWidth / 2;
  }

  let offset = 0;
  let velocity = 0;       // additional from drag/momentum
  let autoSpeed = -1.4;   // baseline, px/frame, negative = right-to-left
  let targetSpeed = -1.4;
  const baseSpeed = -1.4;
  let down = false, startX = 0, startOffset = 0, lastX = 0;
  let isHovering = false;

  function apply() {
    track.style.transform = "translateY(-50%) translate3d(" + offset + "px, 0, 0)";
  }
  apply();

  root.addEventListener("mouseenter", () => { isHovering = true; });
  root.addEventListener("mouseleave", () => { isHovering = false; });

  root.addEventListener("pointerdown", (e) => {
    down = true;
    startX = lastX = e.clientX;
    startOffset = offset;
    velocity = 0;
    root.classList.add("grabbing");
    e.preventDefault();
  });
  window.addEventListener("pointerup", () => {
    if (!down) return;
    down = false;
    root.classList.remove("grabbing");
  });
  window.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    offset = startOffset + dx;
    velocity = (e.clientX - lastX) * 0.9;
    lastX = e.clientX;
    apply();
  });

  root.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      offset -= e.deltaX;
      velocity = -e.deltaX * 0.5;
      apply();
      e.preventDefault();
    }
  }, { passive: false });

  function loop() {
    // Set target auto-speed based on interaction
    if (down) targetSpeed = 0;
    else if (isHovering) targetSpeed = baseSpeed * 0.18;
    else targetSpeed = baseSpeed;

    // Ease auto-speed toward target
    autoSpeed += (targetSpeed - autoSpeed) * 0.06;

    if (!down) {
      // Apply auto-scroll + decaying drag momentum
      offset += autoSpeed + velocity;
      velocity *= 0.94;
      if (Math.abs(velocity) < 0.02) velocity = 0;
    }

    // Wrap for infinite loop
    const half = halfTrackWidth();
    if (half > 0) {
      while (offset <= -half) offset += half;
      while (offset > 0) offset -= half;
    }

    apply();
    requestAnimationFrame(loop);
  }
  loop();

  // 3D tilt on cards (cursor-tracked) — ignored while drag-scrolling
  document.querySelectorAll(".drag-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      if (down) return;
      const r = card.getBoundingClientRect();
      const cx = (e.clientX - r.left) / r.width;
      const cy = (e.clientY - r.top) / r.height;
      const rx = (cy - 0.5) * -8;
      const ry = (cx - 0.5) * 12;
      card.style.transform = "perspective(1400px) rotateX(" + rx + "deg) rotateY(" + ry + "deg) translateZ(0)";
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "perspective(1400px) rotateX(0) rotateY(0)";
    });
  });
})();

/* ----------------------------
   Page transition veil
---------------------------- */
(function () {
  const veil = document.getElementById("veil");
  if (!veil) return;
  const label = veil.querySelector(".label");
  const internal = (href) => /^[a-z0-9\-]+\.html(\#.*)?$/i.test(href) || href === "/" || href.startsWith("./");

  document.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href) return;
    if (!internal(href)) return;
    if (a.dataset.noTransition) return;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const text = (a.dataset.transition || a.textContent || "").trim();
      label.textContent = text.toUpperCase();
      veil.classList.add("in");
      setTimeout(() => { window.location.href = href; }, 700);
    });
  });

  // On load, slide it out
  window.addEventListener("pageshow", () => {
    veil.classList.remove("in");
    veil.classList.add("out");
    setTimeout(() => veil.classList.remove("out"), 800);
  });
})();

/* ----------------------------
   Contact modal
---------------------------- */
(function () {
  const modal = document.getElementById("modal");
  if (!modal) return;
  document.querySelectorAll("[data-contact]").forEach((el) => {
    el.addEventListener("click", (e) => { e.preventDefault(); modal.classList.add("open"); });
  });
  const closeBtn = document.getElementById("closeModal");
  if (closeBtn) closeBtn.addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") modal.classList.remove("open"); });

  const toast = document.getElementById("toast");
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1800);
  }
  function copyEmail() {
    const email = "cooperdelo6@gmail.com";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(email).then(() => showToast("Copied to clipboard")).catch(legacyCopy);
    } else { legacyCopy(); }
    function legacyCopy() {
      const ta = document.createElement("textarea");
      ta.value = email; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); showToast("Copied to clipboard"); }
      catch { showToast("Copy failed"); }
      document.body.removeChild(ta);
    }
  }
  const copyBtn = document.getElementById("copyBtn");
  if (copyBtn) copyBtn.addEventListener("click", copyEmail);
})();
