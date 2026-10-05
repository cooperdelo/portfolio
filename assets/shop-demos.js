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

  // ---------------------------------------------------------- LinkedIn: your first line, the four checks. Cooper's post is only an example ("See mine").
  document.querySelectorAll('[data-demo="linkedin"]').forEach((d) => {
    const boxes = [...d.querySelectorAll("[data-check]")], out = d.querySelector("[data-li-score]"), say = d.querySelector("[data-li-say]"), v = d.querySelector("[data-verdict]");
    const mineBtn = d.querySelector("[data-mine]"), text = d.querySelector("[data-line]"), name = d.querySelector("[data-li-name]"), sub = d.querySelector("[data-li-sub]");
    const MINE = { line: "Nobody at the pitch cared about my slides. They cared about one number.", name: "Cooper Delo", sub: "Founder, PlugVerse · 1h" };
    let yours = { line: "", checks: [] };
    mineBtn?.addEventListener("click", () => {
      const on = mineBtn.getAttribute("aria-pressed") !== "true";
      if (on) yours = { line: text.value, checks: boxes.map((b) => b.checked) };
      mineBtn.setAttribute("aria-pressed", String(on));
      mineBtn.textContent = on ? "Back to yours" : "See mine";
      d.querySelectorAll("[data-li-you]").forEach((e) => { e.hidden = on; });
      d.querySelectorAll("[data-li-me]").forEach((e) => { e.hidden = !on; });
      text.value = on ? MINE.line : yours.line; text.readOnly = on;
      name.textContent = on ? MINE.name : "You"; sub.textContent = on ? MINE.sub : "Your headline · now";
      boxes.forEach((b, i) => { b.checked = on ? false : !!yours.checks[i]; });  // score mine yourself; no score is claimed for it
      sync();
    });
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
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // vault: click a folder, see what lives there
  document.querySelectorAll('[data-demo="vault"]').forEach((d) => {
    const btns = [...d.querySelectorAll("[data-v]")], panes = [...d.querySelectorAll("[data-vp]")];
    btns.forEach((b) => b.addEventListener("click", () => {
      btns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      panes.forEach((p) => { p.hidden = p.dataset.vp !== b.dataset.v; });
    }));
  });

  // week: the reader picks their own pillars (2 to 5), then six days, one pillar each, one carousel.
  // Cooper's own week is an example behind "See mine", never the default.
  const MINE_WEEK = { picked: ["Founder", "Mindset", "Music", "College"], main: "Founder", plan: ["Founder", "Mindset", "Founder", "Music", "College", "Open slot"], car: 3 };
  document.querySelectorAll('[data-demo="week"]').forEach((d) => {
    const chipsEl = d.querySelector("[data-chips]"), add = d.querySelector("[data-add]"), mainEl = d.querySelector("[data-main]"), mains = d.querySelector("[data-mains]");
    const days = [...d.querySelectorAll("[data-day]")], cars = [...d.querySelectorAll("[data-car]")], checks = d.querySelector("[data-checks]"), note = d.querySelector("[data-wk-note]"), mineBtn = d.querySelector("[data-mine]");
    let st = { picked: [], main: "", plan: ["", "", "", "", "", ""], car: 3 }, saved = null;
    const mine = () => saved !== null;
    const others = () => st.picked.filter((p) => p !== st.main);
    const fill = () => {
      if (st.picked.length < 2) { st.plan = ["", "", "", "", "", ""]; return; }
      const o = others(), at = (i) => o[i % o.length];
      st.plan = [st.main, at(0), at(1), st.main, at(2), at(3)];
    };
    const chips = () => [...chipsEl.querySelectorAll("[data-p]")];
    const draw = () => {
      const m = mine();
      chips().forEach((c) => {
        const on = st.picked.includes(c.dataset.p);
        c.setAttribute("aria-pressed", String(on));
        c.disabled = m || (!on && st.picked.length >= 5);
      });
      add.querySelectorAll("input, button").forEach((e) => { e.disabled = m || st.picked.length >= 5; });
      mainEl.hidden = st.picked.length < 2;
      mains.innerHTML = st.picked.map((p) => `<button type="button" data-m="${esc(p)}" aria-pressed="${p === st.main}"${m ? " disabled" : ""}>${esc(p)}</button>`).join("");
      days.forEach((b, i) => {
        b.querySelector("[data-topic]").textContent = st.plan[i] || "Pick";
        b.querySelector("[data-fmt]").textContent = i === st.car && st.plan[i] ? "Carousel" : "";
        b.classList.toggle("car", i === st.car && !!st.plan[i]);
        b.classList.toggle("empty", !st.plan[i]);
        b.disabled = m || st.picked.length < 2;
      });
      cars.forEach((b, i) => { b.setAttribute("aria-pressed", String(i === st.car)); b.disabled = m; });
      const n = (t) => st.plan.filter((p) => p === t).length, ready = st.picked.length >= 2;
      const rows = [
        [ready ? `${m ? "Main" : "Your main"} pillar (${st.main}) twice` : "Your main pillar twice", ready && n(st.main) === 2],
        ["Every other pillar at least once", ready && others().every((o) => n(o) >= 1)],
        ["One carousel", ready && st.car > -1],
        ["Filmed on Sunday", ready],
      ];
      checks.innerHTML = rows.map(([t, ok]) => `<li class="${ok ? "ok" : ""}"><span class="dot" aria-hidden="true"></span>${esc(t)}<span class="label">${ok ? "Done" : "Not yet"}</span></li>`).join("");
      d.classList.toggle("done", rows.every(([, ok]) => ok));
      note.textContent = m ? "This is my week. Yours starts from your own pillars." : ready ? "Tap a day to swap its pillar." : "Pick two or more and the week fills in. Tap a day to change it.";
    };
    const toggle = (p) => {
      if (st.picked.includes(p)) st.picked = st.picked.filter((x) => x !== p);
      else if (st.picked.length < 5) st.picked.push(p);
      if (!st.picked.includes(st.main)) st.main = st.picked[0] || "";
      fill(); draw();
    };
    chipsEl.addEventListener("click", (e) => { const c = e.target.closest("[data-p]"); if (c && !mine()) toggle(c.dataset.p); });
    add.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = add.querySelector("input"), v = input.value.trim().replace(/\s+/g, " ").slice(0, 24);
      if (!v || mine()) return;
      let c = chips().find((x) => x.dataset.p.toLowerCase() === v.toLowerCase());
      if (!c) { c = document.createElement("button"); c.type = "button"; c.dataset.p = v; c.textContent = v; c.setAttribute("aria-pressed", "false"); chipsEl.append(c); }
      input.value = "";
      if (!st.picked.includes(c.dataset.p)) toggle(c.dataset.p);
    });
    mains.addEventListener("click", (e) => { const b = e.target.closest("[data-m]"); if (!b || mine()) return; st.main = b.dataset.m; fill(); draw(); });
    days.forEach((b, i) => b.addEventListener("click", () => {
      if (mine() || st.picked.length < 2) return;
      st.plan[i] = st.picked[(st.picked.indexOf(st.plan[i]) + 1) % st.picked.length]; draw();
    }));
    cars.forEach((b, i) => b.addEventListener("click", () => { if (!mine()) { st.car = i; draw(); } }));
    mineBtn?.addEventListener("click", () => {
      if (mine()) { st = saved; saved = null; }
      else { saved = JSON.parse(JSON.stringify(st)); st = JSON.parse(JSON.stringify(MINE_WEEK)); }
      mineBtn.setAttribute("aria-pressed", String(mine()));
      mineBtn.textContent = mine() ? "Back to yours" : "See mine";
      d.classList.toggle("mine", mine());
      draw();
    });
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
