/* Shop + guides, client side. Every word of a kit comes from /api/kit; the page only knows its slug.
   Access is a signed token kept in this browser (localStorage "kit:<slug>"). */
(() => {
  const API = "/api/kit";
  const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  const LOCK = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (c) => "$" + (c / 100).toFixed(c % 100 ? 2 : 0);
  const track = (n, p) => window.cdTrack?.(n, p);
  const store = {
    get: (s) => { try { return localStorage.getItem("kit:" + s) || ""; } catch { return ""; } },
    set: (s, t) => { try { localStorage.setItem("kit:" + s, t); } catch {} },
  };
  const FILES = { design: "design-kit/", "ai-system": "one-folder.md", linkedin: "linkedin-checks.md", "instagram-tiktok": "short-videos.md",
    "film-motion": "one-camera.md", music: "gig-kit.md", startup: "shipping-solo.md" };
  const badge = (k) => k.gate === "paid" ? `${money(k.price)}${k.draft ? ' <i class="draft">Draft</i>' : ""}` : "Free";

  async function getKit(slug) {
    const t = store.get(slug);
    const r = await fetch(`${API}?slug=${encodeURIComponent(slug)}`, { headers: t ? { Authorization: "Bearer " + t } : {} });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }
  async function post(url, body) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return [r.status, await r.json().catch(() => ({}))];
  }

  // Copy buttons, anywhere on the page.
  document.addEventListener("click", async (e) => {
    const b = e.target.closest(".cp"); if (!b) return;
    const pre = b.parentElement.querySelector("pre");
    try { await navigator.clipboard.writeText(pre.textContent); b.textContent = "Copied"; }
    catch { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Selected"; }
    setTimeout(() => (b.textContent = "Copy"), 1600);
  });
  const block = (text, label = "Copy") => `<div class="cb"><pre>${esc(text)}</pre><button type="button" class="cp" aria-label="${esc(label)}">Copy</button></div>`;

  // ------------------------------------------------------------ the folder (storefront) and the guides shelf
  const files = document.querySelector("[data-files]");
  const shelf = document.querySelector("[data-guides]");
  if (files || shelf) fetch(`${API}?list=1`).then((r) => r.json()).then(({ kits }) => {
    if (files) {
      const extra = [{ slug: "film-plan", fname: "film-planner", title: "Film planner", gate: "free", href: "/resources/film-plan" },
        { slug: "motion", fname: "motion-starter/", title: "Motion starter", gate: "soon", href: "" }];
      const all = kits.map((k) => ({ ...k, fname: FILES[k.slug] || k.slug })).concat(extra);
      files.innerHTML = all.map((k, i) => {
        const inner = `<span class="ficon ${k.fname.endsWith("/") ? "dir" : "doc"} g-${k.gate}" aria-hidden="true"></span><b>${esc(k.fname)}</b><span class="ft">${esc(k.title)}</span><span class="fb label">${k.gate === "soon" ? "Coming" : badge(k)}</span>`;
        return `<li data-gate="${k.gate}" style="--i:${i}">${k.href ? `<a class="file" href="${k.href}">${inner}</a>` : `<span class="file off">${inner}</span>`}</li>`;
      }).join("");
      const count = document.querySelector("[data-count]");
      if (count) count.textContent = `${all.length} items`;
      document.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => {
        document.querySelectorAll("[data-filter]").forEach((x) => x.classList.toggle("on", x === b));
        const f = b.dataset.filter;
        files.querySelectorAll("li").forEach((li) => { li.hidden = f !== "all" && li.dataset.gate !== f; });
      }));
    }
    if (shelf) {
      shelf.innerHTML = kits.map((k) => `<li><a class="gd-card" href="${k.href}"><span class="label">${esc(k.pillar)} · ${badge(k)}</span><b>${esc(k.title)}</b><span>${esc(k.result)}</span><span class="go">${ARROW}</span></a></li>`).join("");
    }
  }).catch(() => { if (files) files.innerHTML = '<li class="files-wait label">Almost ready. Check back soon.</li>'; if (shelf) shelf.innerHTML = ""; });

  // ------------------------------------------------------------ one kit (paid product page or gated guide)
  const root = document.querySelector("[data-kit]");
  if (!root) return;
  const slug = root.dataset.kit;
  const $ = (s) => document.querySelector(s);
  const msg = (t) => { const m = $("[data-msg]"); if (m) m.textContent = t || ""; };

  function stepHTML(s, i, locked) {
    if (locked) return `<li class="st locked"><span class="label no">${String(i + 1).padStart(2, "0")}</span><div><h3>${esc(s)}</h3><div class="cb ghost" aria-hidden="true"><i></i><i></i><i></i></div></div><span class="lk">${LOCK}</span></li>`;
    return `<li class="st"><span class="label no">${String(i + 1).padStart(2, "0")}</span><div><h3>${esc(s.do)}</h3>${s.copy ? block(s.copy) : ""}</div></li>`;
  }
  // Works in any AI tool. Kits that make files or code go to a coding agent; the rest go in any chat.
  const CODING = new Set(["design", "startup", "ai-system"]);
  const masterHTML = (k) => k.master_prompt ? `<div class="mp"><p class="label">The one prompt</p><h2>${CODING.has(k.slug) ? "Paste this into your coding agent." : "Paste this into your AI."}</h2><p class="mp-tools">${CODING.has(k.slug) ? "Claude Code, Cursor, Codex or any coding agent." : "Claude, ChatGPT, Gemini or whatever you use."}</p>${block(k.master_prompt, "Copy the prompt")}</div>` : "";

  function render(d) {
    const k = d.kit;
    document.title = `${k.title} / Cooper Delo`;
    $("[data-k-title]").textContent = k.title;
    const pl = $("[data-k-pillar]"); if (pl) pl.textContent = ($("[data-buy]") ? "Kit · " : "Guide · ") + k.pillar;
    $("[data-k-result]").textContent = k.result || "";
    const proof = $("[data-k-proof]");
    if (proof) proof.innerHTML = (k.proof_links || []).map((l) => `<a href="${esc(l.url)}"${/^https?:\/\/(www\.)?cooperdelo\.com/.test(l.url) ? "" : ' target="_blank" rel="noreferrer"'}>${esc(l.label)}</a>`).join("");

    if ($("[data-buy]")) {                                      // product page (paid on previews, free on production)
      const paid = d.gate === "paid";
      if (paid) $("[data-k-price]").textContent = money(d.price);
      $("[data-k-draft]").hidden = !paid || !d.draft;
      const outline = d.locked ? (k.outline || []) : k.steps.map((s) => s.do);
      $("[data-outline]").innerHTML = outline.map((t, i) => `<li><span class="label">${String(i + 1).padStart(2, "0")}</span><b>${esc(t)}</b>${d.locked ? `<span class="lk">${LOCK}</span>` : ""}</li>`).join("") +
        `<li class="mpl"><span class="label">+</span><b>The one prompt that puts it all together</b>${d.locked ? `<span class="lk">${LOCK}</span>` : ""}</li>`;
      $("[data-buy]").hidden = !(paid && d.locked);
      $("[data-owned]").hidden = !paid || d.locked;
      const fullEl = $("[data-full]");
      fullEl.hidden = d.locked;
      if (!d.locked) fullEl.innerHTML = `<div class="sh-head"><p class="label">${paid ? "Your kit" : "Free"}</p><h2>Here it is.</h2></div><ol class="gd-steps">${k.steps.map((s, i) => stepHTML(s, i, false)).join("")}</ol>${masterHTML(k)}`;
      return;
    }
    // guide page: step 1 open, the rest outlined and locked; the email ask comes up as a modal
    const steps = $("[data-steps]"), gate = $("[data-gate]"), master = $("[data-master]");
    // A page built without unlock UI (a free guide) never draws the locked view.
    if (d.locked && d.gate !== "free" && gate) {
      const rest = (k.outline || []).slice(1);
      steps.innerHTML = stepHTML(k.first, 0, false) + rest.map((t, i) => stepHTML(t, i + 1, true)).join("");
      const count = `${Math.max(0, k.count - 1)} more steps and the one prompt`;
      gate.hidden = false;
      $("[data-gate-count]").textContent = count;
      $("[data-gm-count]").textContent = k.title;
      $("[data-bar-count]").textContent = count;
      $("[data-gm-outline]").innerHTML = rest.map((t, i) => `<li><span class="label">${String(i + 2).padStart(2, "0")}</span>${esc(t)}</li>`).join("") + '<li><span class="label">+</span>The one prompt</li>';
      master.hidden = true;
      gm.arm();
      track("gate_view", { kit: slug });
    } else {
      steps.innerHTML = (k.steps || []).map((s, i) => stepHTML(s, i, false)).join("");
      if (gate) gate.hidden = true;
      master.hidden = !k.master_prompt;
      master.innerHTML = masterHTML(k);
      gm.done();
    }
  }

  // The email modal: opens once when someone scrolls into the locked steps, or any time they ask for it.
  const gm = (() => {
    const el = document.querySelector("[data-gate-modal]"), barEl = document.querySelector("[data-gate-bar]");
    if (!el || !barEl) return { arm() {}, done() {} };
    // The sticky bar only shows while it's wanted AND nothing it would cover is on screen:
    // the hero (top of the page, under the nav), the Next cards and the footer.
    let want = false; const covering = new Set();
    const sync = () => { barEl.hidden = !want || covering.size > 0; };
    const bar = { set hidden(v) { want = !v; sync(); } };
    const watch = new IntersectionObserver((ents) => { ents.forEach((en) => en.isIntersecting ? covering.add(en.target) : covering.delete(en.target)); sync(); });
    document.querySelectorAll(".gd-hero, .nx, footer").forEach((t) => watch.observe(t));
    const key = "gate-shown:" + slug;
    let last = null, io = null;
    const seen = () => { try { return sessionStorage.getItem(key) === "1"; } catch { return false; } };
    function open() {
      if (!el.hidden) return;
      last = document.activeElement;
      el.hidden = false; bar.hidden = true;
      requestAnimationFrame(() => el.classList.add("on"));
      document.documentElement.classList.add("gm-lock"); window.cdLenis?.stop();
      try { sessionStorage.setItem(key, "1"); } catch {}
      setTimeout(() => el.querySelector("input")?.focus({ preventScroll: true }), 250);
    }
    function close(showBar = true) {
      if (el.hidden) return;
      el.classList.remove("on");
      document.documentElement.classList.remove("gm-lock"); window.cdLenis?.start();
      setTimeout(() => { el.hidden = true; }, 350);
      if (showBar) bar.hidden = false;
      last?.focus?.({ preventScroll: true });
    }
    el.addEventListener("click", (e) => { if (e.target.closest("[data-gm-close]")) close(); });
    el.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    document.querySelectorAll("[data-gm-open]").forEach((b) => b.addEventListener("click", open));
    document.addEventListener("click", (e) => { if (e.target.closest(".st.locked")) open(); });
    return {
      arm() {
        const first = document.querySelector(".st.locked");
        if (!first) return;
        if (seen()) { bar.hidden = false; return; }
        io?.disconnect();
        io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); open(); } }, { rootMargin: "0px 0px -35% 0px" });
        io.observe(first);
      },
      done() { io?.disconnect(); close(false); bar.hidden = true; },
    };
  })();

  async function unlock(body) {
    const [code, d] = await post(API, { slug, ...body });
    if (code === 200 && d.token) { store.set(slug, d.token); render(d); track("kit_unlock", { kit: slug, how: body.email ? "email" : body.demo ? "demo" : "paid" }); return true; }
    return d.error || "error";
  }

  async function start() {
    const q = new URLSearchParams(location.search);
    const clean = () => history.replaceState(null, "", location.pathname + location.hash);
    if (q.get("session_id")) { msg("Checking your payment"); const ok = await unlock({ session_id: q.get("session_id") }); msg(ok === true ? "" : "We couldn't confirm that payment yet. Refresh in a moment, or email me."); clean(); if (ok === true) return; }
    else if (q.get("demo") === "1") { const ok = await unlock({ demo: true }); clean(); if (ok === true) { msg(""); return; } }
    else if (q.get("canceled")) { msg("Checkout canceled. Nothing was charged."); clean(); }
    try { render(await getKit(slug)); } catch { $("[data-k-title]").textContent = "This one's almost ready. Check back soon."; }
  }

  const gateForm = document.querySelector("[data-email-gate]");
  gateForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = gateForm.email.value.trim();
    msg("Opening");
    track("email_submit", { kit: slug });
    const ok = await unlock({ email });
    msg(ok === true ? "" : ok === "bad_email" ? "That email doesn't look right." : "Something went wrong. Try again.");
  });

  const buy = document.querySelector("[data-checkout]");
  buy?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = buy.querySelector("button"); btn.disabled = true; msg("Opening checkout");
    track("checkout_start", { kit: slug });
    let tp = new URLSearchParams(location.search).get("tp") || "";
    try { if (tp) sessionStorage.setItem("cd_tp", tp); else tp = sessionStorage.getItem("cd_tp") || ""; } catch {}
    const [code, d] = await post("/api/shop-checkout", { kit: slug, code: buy.code.value.trim(), tp });
    if (code === 200 && d.url) { location.href = d.url; return; }
    btn.disabled = false;
    msg(d.error === "bad_code" ? "That code didn't work." : d.error === "checkout_not_configured" || d.error === "checkout_opening_soon" ? "Checkout opens soon." : "Checkout didn't open. Try again in a moment.");
  });

  start();
})();
