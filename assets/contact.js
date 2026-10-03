/* Contact, as a modal from anywhere (ref: Gaku's "Send me a message"; Modal Drop with a blurred page behind).
   Nothing to fill in: pick what it's about, and it opens your email with the subject written. */
(() => {
  const EMAIL = "cooper@plugverse.app", CAL = "https://cal.com/cooper-delo1";
  const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  const KINDS = [
    ["A film or content", "Short films, launch films, content for a brand.", "Film"],
    ["Product or a build", "An app, a site, or a system built with Claude.", "Product"],
    ["Summer 2027", "Growth, creative or product roles. SF first, NYC too.", "Summer 2027"],
    ["Booking Rubber Band", "Parties, formals, bars, weddings. Book us on PlugVerse.", "https://plugverse.app/a/2499f269-dff2-4025-85a6-cf1ff8991382"],
  ];
  let root = null, last = null;
  function build() {
    root = document.createElement("div");
    root.className = "ct"; root.hidden = true; root.setAttribute("data-lenis-prevent", "");
    root.innerHTML = `<div class="ct-scrim" data-ct-close></div>
      <div class="ct-card" role="dialog" aria-modal="true" aria-labelledby="ct-h">
        <button type="button" class="ct-x label" data-ct-close>Close</button>
        <p class="label">Contact</p>
        <h2 id="ct-h">What's it about?</h2>
        <ul class="ct-kinds">${KINDS.map(([t, d, s]) => `<li><a href="${s.startsWith("http") ? s : `mailto:${EMAIL}?subject=${encodeURIComponent(s)}`}"${s.startsWith("http") ? ' target="_blank" rel="noreferrer"' : ""}><b>${t}</b><span>${d}</span><i>${ARROW}</i></a></li>`).join("")}</ul>
        <div class="ct-foot"><button type="button" class="ct-mail" data-ct-copy>${EMAIL}<span class="label">Copy</span></button>
          <a class="pill solid" href="${CAL}" target="_blank" rel="noreferrer">Book a call ${ARROW}</a></div>
      </div>`;
    document.body.appendChild(root);
    root.addEventListener("click", async (e) => {
      if (e.target.closest("[data-ct-close]")) return close();
      const c = e.target.closest("[data-ct-copy]");
      if (c) { try { await navigator.clipboard.writeText(EMAIL); c.querySelector(".label").textContent = "Copied"; } catch { /* the address is on screen */ } }
      if (e.target.closest(".ct-kinds a")) window.cdTrack?.("cta_click", { target: "contact_" + e.target.closest("a").textContent.trim().slice(0, 20) });
    });
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const f = [...root.querySelectorAll("a, button")]; const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    });
  }
  function open() {
    if (!root) build();
    last = document.activeElement;
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add("on"));
    document.documentElement.classList.add("ct-lock"); window.cdLenis?.stop();
    setTimeout(() => root.querySelector(".ct-kinds a")?.focus({ preventScroll: true }), 200);
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
  document.addEventListener("click", (e) => {
    const t = e.target.closest('[data-contact], a[href="#contact"], a[href="/#contact"], a[href="/work-with-me"]');
    if (!t) return;
    e.preventDefault(); e.stopPropagation(); open();
  }, true); // capture, so the smooth-scroll handler never jumps to the footer first
  if (location.hash === "#contact") open();
})();
