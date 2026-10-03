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

/* Guide demos: the vault tree, the posting week, the shot bank. */
(() => {
  // vault: click a folder, see what lives there
  document.querySelectorAll('[data-demo="vault"]').forEach((d) => {
    const btns = [...d.querySelectorAll("[data-v]")], panes = [...d.querySelectorAll("[data-vp]")];
    btns.forEach((b) => b.addEventListener("click", () => {
      btns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      panes.forEach((p) => { p.hidden = p.dataset.vp !== b.dataset.v; });
    }));
  });

  // week: six days, one topic each, one carousel
  const TOPICS = ["Founder", "Mindset", "Music", "College", "Yours"];
  document.querySelectorAll('[data-demo="week"]').forEach((d) => {
    const days = [...d.querySelectorAll("[data-day]")], cars = [...d.querySelectorAll("[data-car]")], checks = d.querySelector("[data-checks]");
    const pick = [0, 1, 0, 2, 3, 4]; let car = 3;
    const draw = () => {
      days.forEach((b, i) => { b.querySelector("[data-topic]").textContent = TOPICS[pick[i]]; b.querySelector("[data-fmt]").textContent = i === car ? "Carousel" : ""; b.classList.toggle("car", i === car); });
      cars.forEach((b, i) => b.setAttribute("aria-pressed", String(i === car)));
      const count = (t) => pick.filter((p) => TOPICS[p] === t).length;
      const rows = [["Founder twice", count("Founder") === 2], ["Mindset, Music and College once each", ["Mindset", "Music", "College"].every((t) => count(t) === 1)],
        ["One of your own", count("Yours") === 1], ["One carousel", car > -1], ["Filmed on Sunday", true]];
      checks.innerHTML = rows.map(([t, ok]) => `<li class="${ok ? "ok" : ""}"><span class="dot" aria-hidden="true"></span>${t}<span class="label">${ok ? "Done" : "Not yet"}</span></li>`).join("");
      d.classList.toggle("done", rows.every(([, ok]) => ok));
    };
    days.forEach((b, i) => b.addEventListener("click", () => { pick[i] = (pick[i] + 1) % TOPICS.length; draw(); }));
    cars.forEach((b, i) => b.addEventListener("click", () => { car = i; draw(); }));
    draw();
  });

  // shots: bank ten different ones in one spot
  document.querySelectorAll('[data-demo="shots"]').forEach((d) => {
    const cells = [...d.querySelectorAll(".sb")], n = d.querySelector("[data-n]"), bar = d.querySelector("[data-bar]"), say = d.querySelector("[data-say]");
    const draw = () => {
      const k = cells.filter((c) => c.getAttribute("aria-pressed") === "true").length;
      n.textContent = Math.min(k, 99); bar.style.transform = `scaleX(${Math.min(1, k / 10)})`;
      say.textContent = k >= 10 ? "That's one spot done. In the edit, use one or two." : k >= 5 ? "Keep going. Change something every time." : "Change the size, the height or the action. Not just the angle.";
      d.classList.toggle("done", k >= 10);
    };
    cells.forEach((c) => c.addEventListener("click", () => { c.setAttribute("aria-pressed", String(c.getAttribute("aria-pressed") !== "true")); draw(); }));
    draw();
  });
})();

/* The shop hero ring: turns slowly on its own, drag to spin it, eases back to the slow turn. */
(() => {
  const o = document.querySelector("[data-orbit]"); if (!o) return;
  const ring = o.querySelector(".orbit-ring");
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let a = 0, v = RM ? 0 : 0.05, drag = null, last = 0, on = true;
  new IntersectionObserver(([e]) => { on = e.isIntersecting; }).observe(o);
  const tick = (t) => {
    const dt = Math.min(48, t - (last || t)); last = t;
    if (on && !drag) { const base = RM ? 0 : 0.05; v += (base - v) * 0.04; a += v * dt / 16; }
    ring.style.setProperty("--spin", a.toFixed(2) + "deg");
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  o.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, a }; o.setPointerCapture(e.pointerId); });
  o.addEventListener("pointermove", (e) => { if (!drag) return; const na = drag.a + (e.clientX - drag.x) * 0.25; v = (na - a) * 0.5; a = na; });
  const end = () => { drag = null; };
  o.addEventListener("pointerup", end); o.addEventListener("pointercancel", end);
})();
