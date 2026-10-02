/* Motion: each beat jumps the Bioswap cut to its moment and plays to the end of that beat.
   The video only loads once the section is close. Reduced motion holds a still per beat. */
(() => {
  const sec = document.querySelector("[data-motion]");
  if (!sec) return;
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const plate = sec.querySelector(".mo-plate");
  const vid = plate.querySelector("video");
  const beats = [...sec.querySelectorAll(".mo-beats li")];
  const ticks = [...sec.querySelectorAll(".mo-rail i")];
  const meter = sec.querySelector(".mo-meter");
  const tc = sec.querySelector("[data-tc]");
  const DUR = parseFloat(sec.dataset.duration) || 18.6;
  let cur = -1, loaded = false, end = DUR;

  const fmt = (t) => "0:" + String(Math.floor(t)).padStart(2, "0");

  function load() {
    if (loaded) return;
    loaded = true;
    const base = matchMedia("(max-width: 700px)").matches ? vid.dataset.m : vid.dataset.d;
    vid.preload = "auto"; // close to the section now: buffer the whole cut so beat jumps are instant
    vid.src = base + (vid.canPlayType('video/webm; codecs="vp9"') ? ".webm" : ".mp4");
    vid.load();
    vid.addEventListener("loadeddata", () => plate.classList.add("live"), { once: true });
    vid.addEventListener("loadedmetadata", () => { if (cur > -1) go(cur, true); }, { once: true });
  }

  function meterTick() {
    const t = vid.currentTime || 0;
    meter.style.setProperty("--p", Math.min(1, t / DUR).toFixed(4));
    tc.textContent = fmt(t);
    if (t >= end - 0.04 && !vid.paused) { vid.pause(); vid.currentTime = Math.max(0, end - 0.05); }
    if (!vid.paused) requestAnimationFrame(meterTick);
  }

  function go(i, force) {
    if (i === cur && !force) return;
    cur = i;
    window.cdTrack?.("motion_beat", { beat: i + 1 }, { once: true });
    beats.forEach((b, k) => b.classList.toggle("on", k === i));
    ticks.forEach((t, k) => t.classList.toggle("on", k <= i));
    const b = beats[i];
    const start = parseFloat(b.dataset.t);
    end = parseFloat(b.dataset.end);
    if (!loaded || vid.readyState < 1) return; // loadedmetadata replays this beat
    try { vid.currentTime = start; } catch (e) { /* not seekable yet */ }
    if (RM) { vid.pause(); meter.style.setProperty("--p", (start / DUR).toFixed(4)); tc.textContent = fmt(start); return; }
    const p = vid.play();
    if (p && p.catch) p.catch(() => {});
    requestAnimationFrame(meterTick);
  }

  vid.addEventListener("play", () => requestAnimationFrame(meterTick));

  beats.forEach((b, i) => b.querySelector(".mo-beat").addEventListener("click", () => go(i, true)));

  // One camera into the case study: the plate itself becomes the Bioswap hero on the next page.
  sec.querySelectorAll('a[href="/work/bioswap"]').forEach((a) => a.addEventListener("click", () => {
    if (!RM) plate.style.viewTransitionName = "case-media";
  }));
  addEventListener("pageshow", () => { plate.style.viewTransitionName = ""; });

  new IntersectionObserver(([e]) => { if (e.isIntersecting) load(); }, { rootMargin: "60% 0px" }).observe(sec);
  // Start on the first beat the moment the plate is actually on screen.
  new IntersectionObserver(([e]) => { if (e.isIntersecting && cur < 0) go(0); }, { threshold: 0.5 }).observe(plate);

  // The beat crossing the middle of the screen is the one on the plate.
  const band = matchMedia("(max-width: 900px)").matches ? "-64% 0px -10% 0px" : "-46% 0px -46% 0px";
  const bandIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) go(beats.indexOf(e.target)); }), { rootMargin: band });
  beats.forEach((b) => bandIO.observe(b));
})();
