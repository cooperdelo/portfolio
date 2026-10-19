/* /brands: the brand and UGC inquiry page.
   COLLABS_EMAIL is the ONE place the brand address lives. Every [data-collabs] link on the page gets its
   href and text from it, so changing the address is a one-line edit here. Loaded before site.js so the
   big fitted address is measured with the real text. */
(() => {
  // Cooper's call (2026-10-19): this public Gmail for now. Switch to "collabs@cooperdelo.com" once the domain alias
  // and MX record are live and a test email to it arrives.
  const COLLABS_EMAIL = "cooperdelo6@gmail.com";
  const SUBJECT = "Brand inquiry";
  const mailto = `mailto:${COLLABS_EMAIL}?subject=${encodeURIComponent(SUBJECT)}`;

  document.querySelectorAll("[data-collabs]").forEach((a) => {
    a.href = mailto;
    const t = a.querySelector("[data-collabs-text]");
    if (t) t.textContent = COLLABS_EMAIL;
  });
  document.querySelectorAll("[data-collabs-copy]").forEach((b) => b.addEventListener("click", async () => {
    const said = b.querySelector("[data-said]");
    try { await navigator.clipboard.writeText(COLLABS_EMAIL); if (said) said.textContent = "Copied"; }
    catch { if (said) said.textContent = COLLABS_EMAIL; }
    window.cdTrack?.("cta_click", { target: "brands_copy_email", from: location.pathname });
  }));
  document.querySelectorAll("[data-collabs]").forEach((a) => a.addEventListener("click", () =>
    window.cdTrack?.("cta_click", { target: "brands_email", from: location.pathname })));

  /* The short brief. Posts to /api/contact (kind "Brand or UGC"), which saves it for the admin Messages card.
     If saving is ever unavailable, it hands back a ready Gmail draft to the same address instead. */
  const form = document.querySelector("[data-brand-form]");
  if (!form) return;
  const msg = form.querySelector("[data-msg]"), done = document.querySelector("[data-brand-done]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true; msg.textContent = "Sending";
    try {
      const r = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, kind: "Brand or UGC", page: location.pathname }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        form.hidden = true; done.hidden = false; done.focus({ preventScroll: true });
        window.cdTrack?.("brief_drafted", { kind: "Brand or UGC" });
      } else if (d.error && d.error !== "not_ready") msg.textContent = d.error;
      else fallback(f);
    } catch { fallback(f); }
    btn.disabled = false;
  });
  function fallback(f) {
    const body = `${f.need || ""}\n\nBudget: ${f.budget || "Not sure yet"}\n\n${f.brand || ""}\n${f.email || ""}`;
    const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${COLLABS_EMAIL}&su=${encodeURIComponent(SUBJECT + (f.brand ? ": " + f.brand : ""))}&body=${encodeURIComponent(body)}`;
    msg.innerHTML = `That didn't send. <a href="${gmail}" target="_blank" rel="noreferrer">Send it with Gmail</a> or email ${COLLABS_EMAIL}.`;
  }
})();
