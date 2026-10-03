/* On repeat: a belt of records that keeps moving and slows to a stop when you reach for one.
   Hover pulls a record out of its sleeve and spins the label; click opens the record viewer.
   Drag (or swipe) to move it yourself. */
(() => {
  const belt = document.querySelector("[data-records]");
  if (!belt) return;
  document.documentElement.classList.add("rx-js");
  const track = belt.querySelector(".rx-track");
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const items = [...track.querySelectorAll(".rx")];
  const RPM = (33 + 1 / 3) / 60 * 360;
  const BASE = RM ? 0 : 38; // px per second when nobody is touching it
  let x = 0, v = BASE, want = BASE, half = 0, last = 0, visible = false, active = null, drag = null;
  const spin = new Map(items.map((li) => [li, { a: Math.random() * 360, s: 0 }]));

  const measure = () => { half = track.scrollWidth / 2; };
  measure(); addEventListener("resize", measure);

  function frame(t) {
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    if (visible) {
      if (!drag) { v += (want - v) * (1 - Math.exp(-dt * 3)); x -= v * dt; }
      if (half) { if (x <= -half) x += half; if (x > 0) x -= half; }
      track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
      spin.forEach((s, li) => {
        const target = li === active ? RPM : 0;
        s.s += (target - s.s) * (1 - Math.exp(-dt * (target > s.s ? 4 : 1.5)));
        if (s.s > 0.5) { s.a = (s.a + s.s * dt) % 360; li.querySelector(".rx-label").style.transform = `rotate(${s.a.toFixed(1)}deg)`; }
      });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !belt.classList.contains("in")) belt.classList.add("in"); }).observe(belt);

  // Slow to a stop while the pointer is over the belt, so a record is easy to pick.
  belt.addEventListener("pointerenter", () => { want = 0; });
  belt.addEventListener("pointerleave", () => { want = BASE; pick(null); });

  function pick(li) {
    if (active === li) return;
    active?.classList.remove("on"); active = li; li?.classList.add("on");
    if (li) window.cdTrack?.("record_pull", { album: li.dataset.title }, { once: true });
  }
  items.forEach((li) => {
    if (FINE) li.addEventListener("pointerenter", () => pick(li));
    const hit = li.querySelector(".rx-hit");
    hit.addEventListener("focus", () => { pick(li); want = 0; });
    hit.addEventListener("click", (e) => { if (moved > 6) { e.preventDefault(); return; } pick(li); openRecord(li.dataset.slug, hit); });
  });

  // Drag or swipe to move it by hand.
  let moved = 0;
  belt.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, start: x }; moved = 0; });
  addEventListener("pointermove", (e) => { if (!drag) return; const d = e.clientX - drag.x; moved = Math.max(moved, Math.abs(d)); x = drag.start + d; });
  addEventListener("pointerup", () => { if (drag) { drag = null; if (!FINE) want = BASE; } });

  let viewer = null;
  const warm = () => (viewer = viewer || import("/assets/album-viewer.js"));
  function openRecord(slug, from) { warm().then((m) => m.open(slug, from)).catch(() => {}); }
  belt.addEventListener("pointerenter", warm, { once: true });
})();
