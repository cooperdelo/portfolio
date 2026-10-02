/* The try-before-you-buy demos: the design rules, the LinkedIn first-line score, the setlist sorter. */
(() => {
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------------------------------------------------------- design: flip the rules, the mock stops looking like AI
  document.querySelectorAll('[data-demo="design"]').forEach((d) => {
    const mock = d.querySelector("[data-mock]"), boxes = [...d.querySelectorAll("[data-rule]")], score = d.querySelector("[data-score]");
    let played = false;
    const sync = () => {
      boxes.forEach((b) => mock.classList.toggle("r-" + b.dataset.rule, b.checked));
      score.textContent = boxes.filter((b) => b.checked).length;
      d.classList.toggle("done", boxes.every((b) => b.checked));
    };
    const playAll = () => boxes.forEach((b, i) => setTimeout(() => { b.checked = true; sync(); }, RM ? 0 : 420 * i));
    boxes.forEach((b) => b.addEventListener("change", () => { played = true; sync(); }));
    d.querySelector("[data-all]")?.addEventListener("click", () => { played = true; playAll(); });
    // The first time it's on screen, flip them on one by one so people see what it does.
    new IntersectionObserver(([e], io) => { if (e.isIntersecting && !played) { played = true; setTimeout(playAll, 700); io.disconnect(); } }, { threshold: 0.5 }).observe(d);
    sync();
  });

  // ---------------------------------------------------------- LinkedIn: Cooper's four checks, scored by you
  document.querySelectorAll('[data-demo="linkedin"]').forEach((d) => {
    const boxes = [...d.querySelectorAll("[data-check]")], out = d.querySelector("[data-li-score]"), say = d.querySelector("[data-li-say]"), v = d.querySelector("[data-verdict]");
    const sync = () => {
      const n = boxes.filter((b) => b.checked).length;
      out.textContent = n;
      say.textContent = n >= 3 ? "Post it." : n === 2 ? "Rewrite the hook before writing the body." : "Keep the idea, change the wrapper.";
      v.dataset.level = n >= 3 ? "go" : n === 2 ? "fix" : "no";
    };
    boxes.forEach((b) => b.addEventListener("change", sync));
    sync();
  });

  // ---------------------------------------------------------- setlist: group by tuning, keep every note as written
  const ORDER = ["standard", "step down", "drop d", "double drop d"];
  document.querySelectorAll('[data-demo="setlist"]').forEach((d) => {
    const input = d.querySelector("[data-set]"), out = d.querySelector("[data-set-out]");
    const tuning = (line) => { const m = line.match(/\((step down|double drop d|drop d|standard)\)/i); return m ? m[1].toLowerCase() : "standard"; };
    const changes = (list) => list.reduce((n, x, i) => n + (i && x !== list[i - 1] ? 1 : 0), 0);
    const run = () => {
      const lines = input.value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 60);
      const tunes = lines.map(tuning);
      const groups = ORDER.map((t) => [t, lines.filter((_, i) => tunes[i] === t)]).filter(([, l]) => l.length);
      const after = groups.flatMap(([t, l]) => l.map(() => t));
      out.innerHTML = `<p class="set-sum label">Retunes <s>${changes(tunes)}</s> &rarr; ${changes(after)}</p>` + groups.map(([t, l], gi) =>
        `<div class="set-g" style="--g:${gi}"><p class="label">${esc(t)}</p><ol>${l.map((s, i) => `<li style="--i:${i}">${esc(s)}</li>`).join("")}</ol></div>`).join("");
    };
    let t = 0;
    input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(run, 250); });
    run();
  });
})();
