/* Shop, second pass: the before/after slider and tilt on the kit boxes. */
(() => {
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("[data-ba]").forEach((b) => {
    const r = b.querySelector(".ba-in");
    r.addEventListener("input", () => b.style.setProperty("--x", r.value + "%"));
    // Swing once when it comes into view, so people see it moves.
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting || RM) return; io.disconnect();
      let t0 = 0;
      const tick = (t) => { t0 = t0 || t; const k = Math.min(1, (t - t0) / 1600); const x = 50 + Math.sin(k * Math.PI * 2) * 22 * (1 - k);
        b.style.setProperty("--x", x + "%"); r.value = x; if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, { threshold: 0.6 }).observe(b);
  });
  if (RM || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  document.querySelectorAll(".bk[data-tilt]").forEach((f) => {
    f.addEventListener("pointermove", (e) => { const r = f.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      f.style.setProperty("--ry", (px * 18).toFixed(1) + "deg"); f.style.setProperty("--rx", (-py * 10).toFixed(1) + "deg"); });
    f.addEventListener("pointerleave", () => { f.style.setProperty("--ry", "0deg"); f.style.setProperty("--rx", "0deg"); });
  });
})();
