/* Selected work: four tabs, one plate. Advances on its own while it's on screen until someone picks a tab.
   Videos load only when their tab first shows. */
(() => {
  const sec = document.querySelector("[data-showcase]");
  if (!sec) return;
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DUR = 7000;
  const tabs = [...sec.querySelectorAll('[role="tab"]')];
  const panels = [...sec.querySelectorAll('[role="tabpanel"]')];
  const media = [...sec.querySelectorAll(".sc-media")];
  let cur = 0, timer = 0, auto = !RM, visible = false;
  sec.style.setProperty("--sc-dur", DUR + "ms");

  function video(i) { return media[i].querySelector("video"); }
  function load(v) {
    if (!v || v.src) return;
    const webm = v.dataset.webm && v.canPlayType('video/webm; codecs="vp9"') ? v.dataset.webm : null;
    v.src = webm || v.dataset.src;
  }

  function go(i, user) {
    if (user) stopAuto();
    if (i === cur && !user) return;
    const prev = cur;
    cur = (i + tabs.length) % tabs.length;
    tabs.forEach((t, k) => { t.setAttribute("aria-selected", String(k === cur)); t.tabIndex = k === cur ? 0 : -1; });
    panels.forEach((p, k) => { p.hidden = k !== cur; });
    media.forEach((m, k) => { m.classList.toggle("on", k === cur); m.classList.toggle("was", k === prev && k !== cur); });
    setTimeout(() => media[prev]?.classList.remove("was"), 1100);
    media.forEach((m, k) => { const v = video(k); if (v && k !== cur) v.pause(); });
    const v = video(cur);
    if (v && visible) { load(v); if (!RM) v.play().catch(() => {}); }
    // restart the progress line
    if (auto) { sec.classList.remove("auto"); void sec.offsetWidth; sec.classList.add("auto"); }
    window.cdTrack?.("showcase_view", { tab: tabs[cur].querySelector(".nm").textContent }, { once: true });
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    if (auto && visible) timer = setTimeout(() => go(cur + 1), DUR);
  }
  function stopAuto() { auto = false; clearTimeout(timer); sec.classList.remove("auto"); }

  tabs.forEach((t, i) => {
    t.addEventListener("click", () => go(i, true));
    t.addEventListener("keydown", (e) => {
      const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
      if (n !== null) { e.preventDefault(); go(n, true); tabs[cur].focus(); }
    });
  });
  // Pause the auto-advance while someone is reading or hovering.
  sec.addEventListener("pointerenter", () => clearTimeout(timer));
  sec.addEventListener("pointerleave", () => { if (auto && visible) { sec.classList.remove("auto"); void sec.offsetWidth; sec.classList.add("auto"); schedule(); } });
  sec.addEventListener("focusin", () => clearTimeout(timer));

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    const v = video(cur);
    if (visible) {
      load(v); if (v && !RM) v.play().catch(() => {});
      // preload the next one's poster quietly
      if (auto) { sec.classList.add("auto"); }
      schedule();
    } else { clearTimeout(timer); v?.pause(); }
  }, { threshold: 0.35 }).observe(sec);
})();
