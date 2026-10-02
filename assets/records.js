/* On repeat: a wall of records. Hover or focus pulls a record up out of its sleeve and the label spins up
   to 33 1/3, then coasts down when it's put back. A click opens the record viewer. */
(() => {
  const wall = document.querySelector("[data-records]");
  if (!wall) return;
  document.documentElement.classList.add("rx-js");
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const items = [...wall.querySelectorAll(".rx")];
  const RPM = (33 + 1 / 3) / 60 * 360; // degrees per second
  const state = items.map(() => ({ a: Math.random() * 360, v: 0 }));
  let active = -1, raf = 0, last = 0, visible = false;

  items.forEach((li, i) => li.style.setProperty("--i", i));

  function pick(i) {
    if (i === active) return;
    if (active > -1) items[active].classList.remove("on");
    active = i;
    if (i > -1) {
      items[i].classList.add("on");
      window.cdTrack?.("record_pull", { album: items[i].dataset.title }, { once: true });
    }
    spin();
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

  // The viewer (and three.js) only load the first time someone opens a record.
  let viewer = null;
  const warm = () => { viewer = viewer || import("/assets/album-viewer.js"); return viewer; };
  function openRecord(slug, from) { warm().then((m) => m.open(slug, from)).catch(() => {}); }

  items.forEach((li, i) => {
    const hit = li.querySelector(".rx-hit");
    if (FINE) {
      li.addEventListener("pointerenter", () => pick(i));
      li.addEventListener("pointerleave", () => { if (active === i) pick(-1); });
    }
    hit.addEventListener("focus", () => pick(i));
    hit.addEventListener("blur", () => { if (active === i && !li.matches(":hover")) pick(-1); });
    hit.addEventListener("click", () => { pick(i); openRecord(li.dataset.slug, hit); });
  });
  wall.addEventListener("pointerenter", warm, { once: true });

  // Deal the records onto the wall, then pull Cooper's own once they've landed (on touch screens nothing hovers).
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !wall.classList.contains("in")) {
      wall.classList.add("in");
      if (!FINE) setTimeout(() => { if (active < 0) pick(0); }, RM ? 0 : 1000);
    }
    spin();
  }, { rootMargin: "0px 0px -15% 0px" }).observe(wall);
})();
