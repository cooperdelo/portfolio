/* Chapter videos: nothing downloads until a tile is near the screen, and each one plays only while it's visible.
   With reduced motion they stay on their poster frame. */
(() => {
  const vids = [...document.querySelectorAll("video.cv")];
  if (!vids.length) return;
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const webmOK = document.createElement("video").canPlayType('video/webm; codecs="vp9"');
  const load = (v) => { if (!v.src) v.src = (v.dataset.webm && webmOK) ? v.dataset.webm : v.dataset.src; };
  const near = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { load(e.target); near.unobserve(e.target); } }), { rootMargin: "600px 0px" });
  const seen = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting && !RM) { load(v); v.play().catch(() => {}); } else v.pause();
  }), { threshold: 0.35 });
  vids.forEach((v) => { near.observe(v); seen.observe(v); });
})();
