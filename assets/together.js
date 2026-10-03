/* Work with me: the brief becomes an email draft in the visitor's own mail app. Nothing is sent
   or stored from the page. Film planner: notes save in this browser and download as Markdown. */
(() => {
  const brief = document.querySelector("[data-brief]");
  if (brief) {
    const want = new URLSearchParams(location.search).get("kind");
    if (want) { const r = brief.querySelector(`input[name="kind"][value="${CSS.escape(want)}"]`); if (r) r.checked = true; }
    document.querySelectorAll("[data-kind]").forEach((a) => a.addEventListener("click", () => {
      const r = brief.querySelector(`input[name="kind"][value="${CSS.escape(a.dataset.kind)}"]`);
      if (r) r.checked = true;
    }));
    brief.addEventListener("submit", (e) => {
      e.preventDefault();
      const ta = brief.elements.namedItem("brief");
      if (!ta.value.trim()) { ta.focus(); ta.placeholder = "Start here. A couple of sentences is plenty."; return; }
      const v = new FormData(brief);
      const kind = v.get("kind") || "a project";
      const src = (new URLSearchParams(location.search).get("utm_source") || document.referrer.replace(/^https?:\/\//, "").split("/")[0] || "cooperdelo.com").slice(0, 80);
      const body = [
        "Hi Cooper,", "",
        `I'm reaching out about ${kind.toLowerCase()}.`, "",
        String(v.get("brief") || "").trim(), "",
        `Timing: ${String(v.get("timing") || "").trim() || "Open"}`,
        `Budget or role: ${String(v.get("budget") || "").trim() || "To talk through"}`, "",
        `Found you through: ${src}`,
      ].join("\n");
      const href = `mailto:cooper@plugverse.app?subject=${encodeURIComponent("Working together: " + kind)}&body=${encodeURIComponent(body)}`;
      window.cdTrack?.("brief_drafted", { kind });
      const ready = brief.querySelector("[data-ready]");
      ready.querySelector("a").href = href;
      ready.hidden = false;
      ready.querySelector("a").focus({ preventScroll: true });
      ready.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  const plan = document.querySelector("[data-planner]");
  if (plan) {
    const status = document.querySelector("[data-plan-status]");
    const KEY = "cd-film-plan-v1";
    const say = (t) => { if (status) status.textContent = t; };
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      Object.entries(saved).forEach(([k, val]) => { const f = plan.elements.namedItem(k); if (f && typeof val === "string") f.value = val; });
      if (Object.values(saved).some(Boolean)) say("Picked up where you left off. Saved in this browser only.");
    } catch (e) { say("This browser won't save notes. Download your plan to keep it."); }
    plan.addEventListener("input", () => window.cdTrack?.("planner_started", {}, { once: true }));
    plan.addEventListener("input", () => {
      try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(new FormData(plan)))); say("Saved in this browser only."); }
      catch (e) { say("This browser won't save notes. Download your plan to keep it."); }
    });
    document.querySelector("[data-plan-download]").addEventListener("click", () => {
      const parts = [...plan.querySelectorAll(".q")].map((q) => {
        const f = q.querySelector("textarea");
        return `## ${q.querySelector("h2").textContent}\n${f.value.trim() || "(not filled in yet)"}\n`;
      });
      const url = URL.createObjectURL(new Blob(["# My film plan\n\n" + parts.join("\n")], { type: "text/markdown" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "my-film-plan.md" });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say("Downloaded. Nothing was uploaded.");
      window.cdTrack?.("planner_download", { filled: [...plan.querySelectorAll("textarea")].filter((t) => t.value.trim()).length });
    });
    document.querySelector("[data-plan-print]").addEventListener("click", () => window.print());
  }
})();

/* Copy buttons (film planner prompt, and anywhere else a .cb block appears outside the shop). */
(() => {
  if (window.__cdCopy) return; window.__cdCopy = true;
  document.addEventListener("click", async (e) => {
    const b = e.target.closest(".cp"); if (!b || b.closest("[data-kit]")) return;
    const pre = b.parentElement.querySelector("pre");
    try { await navigator.clipboard.writeText(pre.textContent); b.textContent = "Copied"; }
    catch { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Selected"; }
    window.cdTrack?.("cta_click", { target: "copy_prompt" });
    setTimeout(() => (b.textContent = "Copy"), 1600);
  });
})();
