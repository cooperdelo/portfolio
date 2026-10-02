/* First-party visit events for cooperdelo.com. No cookies, nothing stored about the person.
   A random id lives in sessionStorage for this tab only. Do Not Track and Global Privacy Control
   switch it off. Other scripts call window.cdTrack(name, props). */
(() => {
  const off = navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true
    || /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]track=1/.test(location.search);
  let session = "";
  try {
    session = sessionStorage.getItem("cd-s") || "";
    if (!session) { session = Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-6); sessionStorage.setItem("cd-s", session); }
  } catch (e) { session = Math.random().toString(36).slice(2, 14); }
  const q = new URLSearchParams(location.search);
  const source = q.get("utm_source") || q.get("s") || "";
  const sent = new Set();

  function cdTrack(name, props = {}, { once = false } = {}) {
    if (off) return;
    const key = name + JSON.stringify(props);
    if (once && sent.has(key)) return;
    sent.add(key);
    const body = JSON.stringify({ name, props, session, path: location.pathname, referrer: document.referrer, source });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }))) return;
    } catch (e) { /* fall through */ }
    fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }
  window.cdTrack = cdTrack;
  cdTrack("page_view");

  // The doors out: book a call, email, PlugVerse, Work with me, the motion starter.
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    const h = a.getAttribute("href") || "";
    const target = /cal\.com/.test(h) ? "book_call"
      : /^mailto:/.test(h) ? (/Motion%20starter/i.test(h) ? "starter_interest" : "email")
      : /plugverse\.app/.test(h) ? "plugverse"
      : /^\/work-with-me/.test(h) ? "work_with_me"
      : /linkedin\.com/.test(h) ? "linkedin"
      : /^\/resources\/film-plan/.test(h) ? "planner" : "";
    if (target) cdTrack("cta_click", { target, from: location.pathname });
  }, { capture: true });
})();
