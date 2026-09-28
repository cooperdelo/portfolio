/* motion.js: motion layer for cooperdelo.com. No framework; Lenis (optional,
   loaded before this file) handles smooth scroll on desktop.
   Page mode comes from <script data-page="home|inner">.
   Everything bails out under prefers-reduced-motion. */
(function () {
  "use strict";
  var doc = document.documentElement;
  var me = document.currentScript;
  var PAGE = (me && me.getAttribute("data-page")) || "inner";
  var HOME = PAGE === "home";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (reduce) {
    doc.classList.remove("m-on");
    doc.classList.add("m-arrived");
    return;
  }
  doc.classList.add("m-on");
  window.__motion = true;
  if (HOME) doc.classList.add("m-home");

  var vh = innerHeight;
  addEventListener("resize", function () { vh = innerHeight; }, { passive: true });
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- 1. split headings into masked lines / characters ---------- */
  function lineHTML(nodes) {
    var d = document.createElement("div");
    nodes.forEach(function (n) { d.appendChild(n.cloneNode(true)); });
    return d.innerHTML.trim();
  }
  // Splits an element's children on <br>, wraps each line in a mask.
  // chars=true splits plain text lines into per-character spans.
  function split(el, chars) {
    if (!el || el.classList.contains("m-split")) return;
    var lines = [[]];
    Array.prototype.forEach.call(el.childNodes, function (n) {
      if (n.nodeName === "BR") lines.push([]); else lines[lines.length - 1].push(n);
    });
    var out = "", ci = 0;
    lines.forEach(function (nodes, li) {
      var html = lineHTML(nodes);
      if (!html) return;
      var plain = nodes.every(function (n) { return n.nodeType === 3; });
      if (chars && plain) {
        var txt = nodes.map(function (n) { return n.textContent; }).join("").trim();
        var inner = txt.split("").map(function (c) {
          var s = '<span class="m-ch" style="--cd:' + (ci++ * 38) + 'ms">' + (c === " " ? "&nbsp;" : c) + "</span>";
          return s;
        }).join("");
        out += '<span class="m-line"><span class="m-lin" aria-hidden="true">' + inner + "</span></span>";
      } else {
        out += '<span class="m-line"><span class="m-lin m-words" style="--cd:' + (li * 110) + 'ms">' + html + "</span></span>";
      }
    });
    if (chars) el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    el.innerHTML = out;
    el.classList.add("m-split");
    el.classList.remove("reveal");
    el.style.opacity = 1;
  }

  /* ---------- 2. page veil + hero entrance (home) ---------- */
  var veil = document.querySelector(".m-veil");
  function arrive() { doc.classList.add("m-arrived"); }

  if (HOME) {
    var h1 = document.querySelector(".hero h1");
    split(h1, true);
    document.querySelectorAll("section h2").forEach(function (h) { split(h, false); });
    var heroBits = document.querySelectorAll(".hero .reveal");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        arrive();
        setTimeout(function () { if (h1) h1.classList.add("m-go"); }, 180);
        heroBits.forEach(function (el, i) {
          setTimeout(function () { el.classList.add("in"); }, (i === 0 ? 120 : 620 + i * 120));
        });
      });
    });
    // internal navigation: fade to black, then go
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.hash) return;
      e.preventDefault();
      doc.classList.add("m-leaving");
      setTimeout(function () { location.href = url.href; }, 430);
    });
    addEventListener("pageshow", function (e) { if (e.persisted) { doc.classList.remove("m-leaving"); arrive(); } });
  } else {
    arrive();
  }
  if (veil) setTimeout(arrive, 1800);

  /* ---------- 3. scroll reveals with stagger ---------- */
  if (HOME) {
    // follow-along rows reveal one by one instead of as a block
    document.querySelectorAll(".rows.reveal").forEach(function (r) {
      r.classList.remove("reveal"); r.style.opacity = 1;
      r.querySelectorAll(".row").forEach(function (row) { row.classList.add("reveal"); });
    });
    document.querySelectorAll(".portrait").forEach(function (p) { p.classList.add("m-clip"); });
    document.querySelectorAll(".feature .img").forEach(function (p) { p.classList.add("m-clip"); });
    document.querySelectorAll(".path, .card, .feature").forEach(function (c) { c.classList.add("m-tilt"); });

    var queue = [], flushing = false;
    function flush() {
      var el = queue.shift();
      if (!el) { flushing = false; return; }
      el.classList.add("in");
      if (el.classList.contains("m-tilt")) setTimeout(function () { el.classList.add("m-ready"); }, 1300);
      setTimeout(flush, 95);
    }
    var io = new IntersectionObserver(function (entries) {
      entries.filter(function (e) { return e.isIntersecting; })
        .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left; })
        .forEach(function (e) { io.unobserve(e.target); queue.push(e.target); });
      if (!flushing) { flushing = true; flush(); }
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal:not(.hero .reveal)").forEach(function (el) { io.observe(el); });

    var hio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { hio.unobserve(e.target); e.target.classList.add("m-go"); } });
    }, { threshold: 0.3 });
    document.querySelectorAll("section h2.m-split").forEach(function (h) { hio.observe(h); });
  }

  /* ---------- 4. count-ups on real figures already on the page ---------- */
  var NUM = /(\$?)(\d{1,3}(?:,\d{3})+)(\+?)/;
  var countSel = HOME ? ".stat b, .about p, .row .sub" : ".stat-card .value";
  document.querySelectorAll(countSel).forEach(function (host) {
    var walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    var nodes = [], n;
    while ((n = walker.nextNode())) if (NUM.test(n.nodeValue)) nodes.push(n);
    nodes.forEach(function (t) {
      var m = t.nodeValue.match(NUM);
      var span = document.createElement("span");
      span.className = "m-count";
      span.textContent = m[0];
      span.dataset.to = m[2].replace(/,/g, "");
      span.dataset.pre = m[1]; span.dataset.post = m[3];
      var after = t.splitText(m.index);
      after.nodeValue = after.nodeValue.slice(m[0].length);
      t.parentNode.insertBefore(span, after);
    });
  });
  var fmt = function (v) { return Math.round(v).toLocaleString("en-US"); };
  var cio = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      cio.unobserve(e.target);
      var el = e.target, to = +el.dataset.to, pre = el.dataset.pre, post = el.dataset.post, t0 = 0, dur = 1700;
      // inside an infinite marquee the number would restart visibly; skip those
      if (el.closest(".marquee-track")) return;
      function tick(t) {
        if (!t0) t0 = t;
        var p = clamp((t - t0) / dur, 0, 1), k = 1 - Math.pow(1 - p, 4);
        el.textContent = pre + fmt(to * k) + (p === 1 ? post : "");
        if (p < 1) requestAnimationFrame(tick);
      }
      el.textContent = pre + "0";
      setTimeout(function () { requestAnimationFrame(tick); }, 250);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll(".m-count").forEach(function (c) { cio.observe(c); });

  /* ---------- 5. parallax targets ---------- */
  var px = [];
  function addPx(el, amt, host, prop) { if (el) px.push({ el: el, host: host || el, amt: amt, prop: prop }); }
  if (HOME) {
    document.querySelectorAll(".scene").forEach(function (s) { addPx(s, 0.07, s, true); });
    document.querySelectorAll(".feature .img img, .portrait img").forEach(function (img) {
      img.classList.add("m-px"); addPx(img, 0.06, img.parentNode);
    });
  } else {
    document.querySelectorAll(".section-bg img, .gs-bg img, .lineup-video").forEach(function (img) {
      img.classList.add("m-px"); addPx(img, 0.08, img.parentNode);
    });
  }

  /* ---------- 6. band video (home): plays only while on screen ---------- */
  var vid = document.querySelector(".scene-video[data-src]");
  if (vid) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          if (!vid.src) { vid.src = vid.dataset.src; vid.load(); }
          var p = vid.play(); if (p && p.catch) p.catch(function () {});
        } else if (vid.src) vid.pause();
      });
    }, { rootMargin: "200px 0px" });
    vio.observe(vid.parentNode);
    vid.addEventListener("playing", function () { vid.classList.add("m-playing"); });
  }

  /* ---------- 7. smooth scroll + single rAF loop ---------- */
  var lenis = null;
  if (HOME && fine && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href"); if (id.length < 2) return;
        var t = document.querySelector(id); if (!t) return;
        e.preventDefault(); lenis.scrollTo(t, { offset: -72 });
      });
    });
  }
  var nav = HOME ? document.querySelector("body > nav.glass") : null;
  var heroWrap = HOME ? document.querySelector(".hero > .wrap") : null;
  var lastY = -1, prevY = scrollY;

  function frame(t) {
    if (lenis) lenis.raf(t);
    var y = scrollY;
    if (y !== lastY) {
      lastY = y;
      var reads = px.map(function (p) { return p.host.getBoundingClientRect(); });
      px.forEach(function (p, i) {
        var r = reads[i];
        if (r.bottom < -200 || r.top > vh + 200) return;
        var prog = clamp((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1);
        var off = (-prog * r.height * p.amt).toFixed(1) + "px";
        if (p.prop) {
          p.el.style.setProperty("--py", off);
          var sv = p.el.querySelector(":scope > .scene-video"); if (sv) sv.style.setProperty("--py", off);
        } else p.el.style.setProperty("--py", off);
      });
      if (heroWrap && y < vh * 1.2) {
        var k = clamp(y / vh, 0, 1);
        heroWrap.style.transform = "translate3d(0," + (y * 0.28).toFixed(1) + "px,0)";
        heroWrap.style.opacity = (1 - k * 0.85).toFixed(3);
      }
      if (nav) {
        if (y > vh * 0.6 && y > prevY + 4) nav.classList.add("m-hide");
        else if (y < prevY - 4 || y < vh * 0.6) nav.classList.remove("m-hide");
      }
      prevY = y;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- 8. magnetic links + card tilt (mouse only) ---------- */
  if (!fine) return;
  var magSel = HOME ? ".btn, nav a, footer .email" : ".nav-cta, a.stat-card";
  document.querySelectorAll(magSel).forEach(function (el) {
    el.classList.add("m-mag");
    var pull = el.matches("footer .email") ? 0.12 : 0.28, max = el.matches("footer .email") ? 14 : 8;
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", clamp((e.clientX - r.left - r.width / 2) * pull, -max, max).toFixed(1) + "px");
      el.style.setProperty("--my", clamp((e.clientY - r.top - r.height / 2) * pull, -max, max).toFixed(1) + "px");
    });
    el.addEventListener("pointerleave", function () { el.style.setProperty("--mx", "0px"); el.style.setProperty("--my", "0px"); });
  });
  document.querySelectorAll(".m-tilt").forEach(function (c) {
    c.addEventListener("pointermove", function (e) {
      var r = c.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      c.style.setProperty("--ry", (x * 3).toFixed(2) + "deg");
      c.style.setProperty("--rx", (-y * 3).toFixed(2) + "deg");
    });
    c.addEventListener("pointerleave", function () { c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); });
  });
})();
