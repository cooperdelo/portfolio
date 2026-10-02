/* On repeat: pull a record out and let the label turn.
   Hover, focus or tap picks a record. On phones the centred sleeve is the pick.
   The label spins up to 33 1/3 and coasts down when it's put back. */
(() => {
  const strip = document.querySelector("[data-records]");
  if (!strip) return;
  const root = document.documentElement;
  root.classList.add("rx-js");
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const PHONE = matchMedia("(max-width: 700px)");
  const items = [...strip.querySelectorAll(".rx")];
  const now = document.querySelector("[data-records-now]");
  const RPM = (33 + 1 / 3) / 60 * 360; // degrees per second
  const state = items.map(() => ({ a: Math.random() * 360, v: 0 }));
  let active = -1, raf = 0, last = 0, visible = false, capT = 0, picked = 0; // the automatic first pull isn't counted

  items.forEach((li, i) => li.style.setProperty("--i", i));

  function caption(i) {
    if (!now) return;
    const d = items[i].dataset;
    const fill = () => {
      now.querySelector("[data-no]").textContent = "No. " + String(i + 1).padStart(2, "0");
      now.querySelector("[data-t]").textContent = d.title;
      now.querySelector("[data-a]").textContent = d.artist + ", " + d.year;
      now.classList.remove("out");
    };
    clearTimeout(capT);
    if (RM) return fill();
    now.classList.add("out");
    capT = setTimeout(fill, 220);
  }

  function pick(i) {
    if (i === active || i < 0 || i >= items.length) return;
    if (active > -1) { items[active].classList.remove("on"); items[active].querySelector(".rx-hit").setAttribute("aria-pressed", "false"); }
    active = i;
    items[i].classList.add("on");
    items[i].querySelector(".rx-hit").setAttribute("aria-pressed", "true");
    caption(i);
    spin();
    if (picked++) window.cdTrack?.("record_pull", { album: items[i].dataset.title }, { once: true });
  }

  // Turntable physics, roughly: spin up in about half a second, coast down slower.
  function tick(t) {
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    let moving = false;
    items.forEach((li, i) => {
      const s = state[i];
      const target = i === active && visible ? RPM : 0;
      const k = target > s.v ? 4.2 : 1.6;
      s.v += (target - s.v) * (1 - Math.exp(-k * dt));
      if (Math.abs(s.v) < 0.5 && target === 0) s.v = 0;
      if (s.v) { s.a = (s.a + s.v * dt) % 360; li.querySelector(".rx-label").style.transform = `rotate(${s.a.toFixed(2)}deg)`; moving = true; }
    });
    raf = moving || (active > -1 && visible) ? requestAnimationFrame(tick) : 0;
    if (!raf) last = 0;
  }
  function spin() { if (!RM && !raf) raf = requestAnimationFrame(tick); }

  items.forEach((li, i) => {
    const hit = li.querySelector(".rx-hit");
    if (FINE) li.addEventListener("pointerenter", () => pick(i));
    hit.addEventListener("focus", () => pick(i));
    hit.addEventListener("click", () => {
      pick(i);
      if (PHONE.matches) li.scrollIntoView({ behavior: RM ? "auto" : "smooth", inline: "center", block: "nearest" });
    });
    hit.addEventListener("keydown", (e) => {
      const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : -1;
      if (n > -1 && n < items.length) { e.preventDefault(); items[n].querySelector(".rx-hit").focus(); }
    });
  });

  // A little depth: sleeves and vinyl drift apart against the pointer.
  if (FINE && !RM) {
    let px = 0, py = 0, q = 0;
    strip.addEventListener("pointermove", (e) => {
      const r = strip.getBoundingClientRect();
      px = (e.clientX - r.left) / r.width * 2 - 1;
      py = (e.clientY - r.top) / r.height * 2 - 1;
      if (!q) q = requestAnimationFrame(() => { q = 0; strip.style.setProperty("--px", px.toFixed(3)); strip.style.setProperty("--py", py.toFixed(3)); });
    });
    strip.addEventListener("pointerleave", () => { strip.style.setProperty("--px", 0); strip.style.setProperty("--py", 0); });
  }

  // Phones: whichever sleeve sits in the middle is the one playing.
  let snapIO = null;
  function phoneMode() {
    if (snapIO) { snapIO.disconnect(); snapIO = null; }
    if (!PHONE.matches) return;
    snapIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) pick(items.indexOf(e.target)); }),
      { root: strip, rootMargin: "0px -42% 0px -42%", threshold: 0 });
    items.forEach((li) => snapIO.observe(li));
  }
  PHONE.addEventListener("change", phoneMode);
  phoneMode();

  // Deal the sleeves in, then pull the first record once they've landed.
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) {
      if (!strip.classList.contains("in")) {
        strip.classList.add("in");
        setTimeout(() => { if (active < 0) pick(PHONE.matches ? 0 : 2); }, RM ? 0 : 900);
      }
      spin();
    }
  }, { rootMargin: "0px 0px -18% 0px" }).observe(strip);
})();
