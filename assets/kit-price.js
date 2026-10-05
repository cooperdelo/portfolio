/* Price labels follow the API, not the hostname. Pages carry both a free and a paid label (.if-free / .if-paid);
   the free one shows by default. Only when /api/kit says a kit is paid (QA / preview deployments) does
   <html> get .kit-paid and the paid labels appear. Production reports the Design kit as free, so nothing changes. */
(() => {
  if (!document.querySelector(".if-paid")) return;
  const html = document.documentElement;
  const apply = (kits) => html.classList.toggle("kit-paid", kits.some((k) => k.gate === "paid"));
  try { const c = JSON.parse(sessionStorage.getItem("cd-kit-gates") || "null"); if (Array.isArray(c)) apply(c); } catch (e) { /* storage blocked */ }
  fetch("/api/kit?list=1").then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!d || !Array.isArray(d.kits)) return;
    const kits = d.kits.map((k) => ({ slug: k.slug, gate: k.gate }));
    try { sessionStorage.setItem("cd-kit-gates", JSON.stringify(kits)); } catch (e) { /* storage blocked */ }
    apply(kits);
  }).catch(() => {});
})();
