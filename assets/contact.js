/* Contact, as a popup from anywhere (ref: Gaku's "Send me a message"; Modal Drop with a blurred page behind).
   Pick what it's about, write two lines, send. It never opens the visitor's mail app: messages go to /api/contact.
   If that isn't available, it offers copy-the-address and Gmail on the web instead. */
(() => {
  const EMAIL = "cooper@plugverse.app", CAL = "https://cal.com/cooper-delo1";
  const BAND = "https://plugverse.app/a/2499f269-dff2-4025-85a6-cf1ff8991382";
  const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  const KINDS = [
    ["Film or content", "Short films, launch films, content for a brand."],
    ["Product or a build", "An app, a site, or a system built with Claude."],
    ["Summer 2027", "Growth, creative or product roles. SF first, NYC too."],
  ];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let root = null, last = null, kind = "";
  function build() {
    root = document.createElement("div");
    root.className = "ct"; root.hidden = true; root.setAttribute("data-lenis-prevent", "");
    root.innerHTML = `<div class="ct-scrim" data-ct-close></div>
      <div class="ct-card" role="dialog" aria-modal="true" aria-labelledby="ct-h">
        <button type="button" class="ct-x label" data-ct-close>Close</button>
        <div class="ct-step" data-step="1">
          <p class="label">Contact</p>
          <h2 id="ct-h">What's it about?</h2>
          <ul class="ct-kinds">${KINDS.map(([t, d]) => `<li><button type="button" data-kind="${esc(t)}"><b>${t}</b><span>${d}</span><i>${ARROW}</i></button></li>`).join("")}
            <li><a href="${BAND}" target="_blank" rel="noreferrer"><b>Booking Rubber Band</b><span>Parties, formals, bars, weddings. Book us on PlugVerse.</span><i>${ARROW}</i></a></li></ul>
          <div class="ct-foot"><button type="button" class="ct-mail" data-ct-copy>${EMAIL}<span class="label">Copy</span></button>
            <a class="pill solid" href="${CAL}" target="_blank" rel="noreferrer">Book a call ${ARROW}</a></div>
        </div>
        <form class="ct-step ct-form" data-step="2" hidden novalidate>
          <button type="button" class="ct-back label" data-ct-back>← Back</button>
          <p class="label" data-ct-kind></p>
          <h2>Tell me a little.</h2>
          <label><span class="label">Your name</span><input name="name" autocomplete="name" maxlength="80" required /></label>
          <label><span class="label">Email or Instagram</span><input name="reply" autocomplete="email" maxlength="120" placeholder="you@email.com or @handle" required /></label>
          <label><span class="label">What do you have in mind?</span><textarea name="message" rows="4" maxlength="2000" required></textarea></label>
          <input class="ct-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
          <div class="ct-send"><button class="pill solid" type="submit">Send ${ARROW}</button><p class="ct-msg" role="status" data-ct-msg></p></div>
        </form>
        <div class="ct-step ct-done" data-step="3" hidden>
          <p class="label">Sent</p><h2>Got it.</h2><p>I read everything myself and usually reply within a day or two.</p>
          <button type="button" class="pill" data-ct-close>Close</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    const steps = [...root.querySelectorAll(".ct-step")];
    const go = (n) => { steps.forEach((s) => (s.hidden = s.dataset.step !== String(n))); setTimeout(() => root.querySelector(`[data-step="${n}"] input, [data-step="${n}"] button`)?.focus({ preventScroll: true }), 60); };
    root.addEventListener("click", async (e) => {
      if (e.target.closest("[data-ct-close]")) return close();
      if (e.target.closest("[data-ct-back]")) return go(1);
      const k = e.target.closest("[data-kind]");
      if (k) { kind = k.dataset.kind; root.querySelector("[data-ct-kind]").textContent = kind; go(2); window.cdTrack?.("cta_click", { target: "contact_" + kind.slice(0, 20) }); return; }
      const c = e.target.closest("[data-ct-copy]");
      if (c) { try { await navigator.clipboard.writeText(EMAIL); c.querySelector(".label").textContent = "Copied"; } catch { /* the address is on screen */ } }
    });
    const form = root.querySelector(".ct-form"), msg = root.querySelector("[data-ct-msg]");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      const btn = form.querySelector("[type=submit]"); btn.disabled = true; msg.textContent = "Sending…";
      try {
        const r = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, kind, page: location.pathname }) });
        const d = await r.json().catch(() => ({}));
        if (r.ok) { form.reset(); msg.textContent = ""; go(3); window.cdTrack?.("brief_drafted", { kind }); }
        else if (d.error && d.error !== "not_ready") msg.textContent = d.error;
        else fallback(f);
      } catch { fallback(f); }
      btn.disabled = false;
    });
    function fallback(f) {
      // Never the visitor's default mail app. Copy, or Gmail on the web with everything filled in.
      const body = `${f.message || ""}\n\n${f.name || ""}\n${f.reply || ""}`;
      const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${EMAIL}&su=${encodeURIComponent(kind || "Hi Cooper")}&body=${encodeURIComponent(body)}`;
      msg.innerHTML = `Send it with <a href="${gmail}" target="_blank" rel="noreferrer">Gmail</a> instead, or <button type="button" class="ct-linkbtn" data-ct-copy>copy my email<span class="label"></span></button>.`;
    }
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const f = [...root.querySelectorAll("a, button, input:not(.ct-hp), textarea")].filter((x) => x.offsetParent !== null); const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    });
    root._go = go;
  }
  function open() {
    if (!root) build();
    root._go(1);
    last = document.activeElement;
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add("on"));
    document.documentElement.classList.add("ct-lock"); window.cdLenis?.stop();
    window.cdTrack?.("cta_click", { target: "contact_open" });
  }
  function close() {
    if (!root || root.hidden) return;
    root.classList.remove("on");
    document.documentElement.classList.remove("ct-lock"); window.cdLenis?.start();
    setTimeout(() => { root.hidden = true; }, 300);
    if (location.hash === "#contact") history.replaceState(null, "", location.pathname + location.search);
    last?.focus?.({ preventScroll: true });
  }
  // Every contact or email link on the site opens this, in the capture phase so nothing else (smooth scroll,
  // the old contact sheet, the browser's mail handler) gets it first.
  document.addEventListener("click", (e) => {
    const t = e.target.closest(`[data-contact], a[href="#contact"], a[href="/#contact"], a[href="/work-with-me"], a[href^="mailto:${EMAIL}"]`);
    if (!t || (root && root.contains(t))) return;
    e.preventDefault(); e.stopPropagation(); open();
  }, true);
  if (location.hash === "#contact") open();
})();
