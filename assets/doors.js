/* Selected work: filter by pillar; each card plays its video on hover (desktop) or while it's on screen (touch). */
(() => {
  const grid = document.querySelector("[data-workgrid]");
  if (!grid) return;
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const HOVER = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const webmOK = document.createElement("video").canPlayType('video/webm; codecs="vp9"');
  const play = (card) => {
    const v = card.querySelector(".wk-vid"); if (!v || RM) return;
    if (!v.src) v.src = (v.dataset.webm && webmOK) ? v.dataset.webm : v.dataset.src;
    v.play().then(() => card.classList.add("playing")).catch(() => {});
  };
  const stop = (card) => { const v = card.querySelector(".wk-vid"); if (v) v.pause(); card.classList.remove("playing"); };
  const cards = [...grid.querySelectorAll(".wk")];
  if (HOVER) cards.forEach((c) => { c.addEventListener("pointerenter", () => play(c)); c.addEventListener("pointerleave", () => stop(c)); });
  else {
    const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? play(e.target) : stop(e.target))), { threshold: 0.6 });
    cards.forEach((c) => io.observe(c));
  }
  grid.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => {
    grid.querySelectorAll("[data-f]").forEach((x) => x.classList.toggle("on", x === b));
    const f = b.dataset.f;
    grid.querySelectorAll(".wk-grid > li").forEach((li) => li.classList.toggle("out", f !== "all" && li.dataset.pillar !== f));
    window.cdTrack?.("cta_click", { target: "work_filter_" + f });
  }));
})();
