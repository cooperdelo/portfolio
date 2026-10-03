"""Build the QA shop (shop.cooperdelo.com, served from /shop) and the gated guide pages (/resources/guides/*).

    python scripts/build-shop.py

Pages carry no kit content: titles, steps and prompts come from /api/kit at runtime (the repo is public).
Reuses the site's head, nav, footer and photo helpers from build-work-pages.py without re-encoding photos.
"""
import json, runpy, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import images  # noqa: E402

# Photos are already encoded and listed in the manifest; don't require the originals on this machine.
class _Always(type(Path())):
    def exists(self, *a, **k): return True
images.src_path = lambda c: _Always(c) if Path(c).is_absolute() else _Always(ROOT / c)
images.build = lambda verbose=True: (images.resolve_names(images.load_slots()), json.loads(images.MANIFEST.read_text()))
W = runpy.run_path(str(ROOT / "scripts" / "build-work-pages.py"), run_name="shop")
head, NAV, footer, spic, E, ARROW, SCRIPTS = W["head"], W["NAV"], W["footer"], W["spic"], W["E"], W["ARROW"], W["SCRIPTS"]

QA = '<div class="qa-bar label" role="note">QA preview · test mode · prices are drafts · nothing here is live</div>'

SHOP_NAV = f"""<header class="sh-nav label">
  <a class="sh-mark" href="/shop"><span>Cooper Delo</span><i>Shop</i></a>
  <nav aria-label="Shop"><a href="/shop#folder">Kits</a><a href="/resources">Free</a><a href="/">Portfolio {ARROW}</a></nav>
</header>"""

SHOP_FOOT = f"""<footer class="sh-foot">
  <p class="sh-big" aria-hidden="true">Shop</p>
  <div class="sh-cols label">
    <span>&copy; 2026 Cooper Delo</span>
    <nav aria-label="Elsewhere"><a href="/">Portfolio</a><a href="/resources">Free resources</a><a href="/#contact">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav>
    <span>Payments by Stripe. Tax calculated at checkout.</span>
  </div>
</footer>"""

def page(path, title, desc, body, css=("/assets/shop.css",), js=("/assets/kit.js", "/assets/shop-demos.js"), shop=True, extra_head=""):
    h = head(f"{title} / Cooper Delo", desc, f"https://cooperdelo.com/{path}")
    links = "".join(f'<link rel="stylesheet" href="{c}" />\n' for c in css)
    h = h.replace("</head>", f'{links}<meta name="robots" content="noindex" />\n{extra_head}</head>', 1)
    scripts = SCRIPTS + "".join(f'\n<script src="{s}" defer></script>' for s in js)
    html = f"""{h}
<body class="{"shop" if shop else "page"}">
{QA}
{SHOP_NAV if shop else NAV}
<main>
{body}
</main>
{SHOP_FOOT if shop else footer()}
{scripts}
</body>
</html>
"""
    out = ROOT / f"{path}.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8", newline="\n")
    print("wrote", out.relative_to(ROOT))

# ---------------------------------------------------------------- demos (shared by the storefront and kit pages)
def demo_design():
    rules = [("photo", "A real photo, not a gradient blob"), ("type", "One display font, one text font"),
             ("icons", "No icon circles on the headers"), ("copy", "Say the real thing, no hype words"), ("less", "Less on screen")]
    sw = "".join(f'<li><label><input type="checkbox" data-rule="{k}" /><span class="sw" aria-hidden="true"></span><span>{t}</span></label></li>' for k, t in rules)
    return f"""<div class="dm dm-design" data-demo="design">
      <div class="dm-stage" aria-live="polite">
        <div class="mock" data-mock>
          <span class="mk-blob" aria-hidden="true"></span>
          <span class="mk-photo">{spic("home-collage-5", "", "(max-width: 900px) 90vw, 40vw")}</span>
          <div class="mk-ico" aria-hidden="true"><i></i><i></i><i></i></div>
          <p class="mk-kick">Creative studio</p>
          <h3 class="mk-h"><span class="bad">Unlock your creative potential.</span><span class="good">Sites that don't look like AI.</span></h3>
          <p class="mk-p"><span class="bad">We craft innovative digital experiences that elevate your brand to the next level and drive real results.</span><span class="good">Made from real references, real photos and real rules.</span></p>
          <div class="mk-btns"><span>Get started</span><span>Learn more</span><span>Book a demo</span></div>
        </div>
      </div>
      <div class="dm-ctl">
        <p class="label">Flip the rules on</p>
        <ul>{sw}</ul>
        <p class="dm-score label"><b data-score>0</b>/5 rules on <button type="button" class="dm-all" data-all>Turn them all on</button></p>
        <p class="dm-note">An illustration of five of the rules in the kit.</p>
      </div>
    </div>"""

def demo_linkedin():
    checks = [("them", "Them", "Is line one a claim about other people, not about me?"), ("fight", "Fight", "Could a smart person say \"no, that's wrong\"? Is there a losing side?"),
              ("proof", "Proof", "Does the image hold evidence or a joke? A face alone fails."), ("odd", "Odd", "Would a stranger stop because this never shows up on LinkedIn?")]
    boxes = "".join(f'<li><label><input type="checkbox" data-check="{k}" /><b>{t}</b><span>{q}</span></label></li>' for k, t, q in checks)
    return f"""<div class="dm dm-li" data-demo="linkedin">
      <div class="li-card">
        <div class="li-top"><span class="li-av" aria-hidden="true"></span><div><b>You</b><span>Your headline · 1h</span></div></div>
        <label class="li-line"><span class="label">Your first line</span><textarea rows="3" maxlength="300" data-line placeholder="Paste the first line of your next post."></textarea></label>
        <div class="li-img" aria-hidden="true"><span>The image</span></div>
      </div>
      <div class="dm-ctl">
        <p class="label">Score the first line and the image. One point each.</p>
        <ul class="li-checks">{boxes}</ul>
        <p class="li-verdict" data-verdict aria-live="polite"><b data-li-score>0</b><span data-li-say>Keep the idea, change the wrapper.</span></p>
      </div>
    </div>"""

def demo_music():
    sample = "Song one (drop d)\nSong two\nSong three (step down)\nSong four\nSong five (double drop d)\nSong six (drop d)"
    return f"""<div class="dm dm-set" data-demo="setlist">
      <label class="set-in"><span class="label">Paste a setlist, tuning in brackets</span><textarea rows="8" data-set>{sample}</textarea></label>
      <div class="set-out" data-set-out aria-live="polite"></div>
      <p class="dm-note">Grouped by tuning so you retune as few times as possible. Your notes stay exactly as written.</p>
    </div>"""


def demo_vault():
    items = [("CLAUDE.md", "The rules Claude reads before anything else. Each one was written after something broke.", "CLAUDE.md"),
             ("Context/", "Who you are, how you write, what you've committed to, and the memory log.", "Context/voice.md"),
             ("Decisions/", "One dated file per call you make. Claude checks here before it guesses.", "Decisions/YYYY-MM-DD-topic.md"),
             ("Projects/", "One folder per project, each with one front-door file.", "Projects/[name]/README.md"),
             ("Skills/", "Step-by-step procedures Claude can run the same way every time.", "Skills/[job]/SKILL.md"),
             ("Scheduled-Tasks/", "Jobs that run without you, listed on one roster.", "Scheduled-Tasks/TASK-ROSTER.md"),
             ("Daily/", "What happened today. Chats get saved to Inbox when they end.", "Daily/YYYY-MM-DD.md")]
    tree = "".join(f'<li><button type="button" data-v="{i}"{" aria-pressed=\"true\"" if i == 0 else " aria-pressed=\"false\""}><span class="vf">{"&#9500;" if i < len(items) - 1 else "&#9492;"} {E(n)}</span></button></li>' for i, (n, _, _) in enumerate(items))
    panes = "".join(f'<div class="vp" data-vp="{i}"{"" if i == 0 else " hidden"}><p class="label">{E(n)}</p><p class="vd">{E(d)}</p><p class="vx"><span class="label">For example</span><code>{E(x)}</code></p></div>' for i, (n, d, x) in enumerate(items))
    return f"""<div class="dm dm-vault" data-demo="vault">
      <div class="vwin"><div class="win-bar"><i></i><i></i><i></i><span>~/vault</span></div><ul class="vtree">{tree}</ul></div>
      <div class="dm-ctl" aria-live="polite">{panes}<p class="dm-note">Click a folder. This is the shape of mine.</p></div>
    </div>"""

def demo_week():
    days = "".join(f'<li><button type="button" class="wk-day" data-day="{i}"><span class="label">{d}</span><b data-topic>Pick</b><span class="wk-fmt" data-fmt></span></button></li>' for i, d in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]))
    return f"""<div class="dm dm-week" data-demo="week">
      <div class="wk">
        <ol class="wk-days"><li><div class="wk-day sun"><span class="label">Sun</span><b>Film + edit</b><span class="wk-fmt">No posting</span></div></li>{days}</ol>
        <div class="wk-car" role="group" aria-label="Which day is the carousel"><span class="label">Carousel</span>{"".join(f'<button type="button" data-car="{i}" aria-pressed="false">{d}</button>' for i, d in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]))}</div>
        <p class="dm-note">Tap a day to change its topic.</p>
      </div>
      <div class="dm-ctl"><p class="label">The week checks</p><ul class="wk-checks" data-checks></ul></div>
    </div>"""

def demo_shots():
    sizes, heights, acts = ["Wide", "Medium", "Close"], ["Low", "Eye", "High"], ["Still", "Moving"]
    cells = "".join(f'<li><button type="button" class="sb" aria-pressed="false"><b>{sz}</b><span>{h} · {a}</span></button></li>' for sz in sizes for h in heights for a in acts)
    return f"""<div class="dm dm-shots" data-demo="shots">
      <ol class="sb-grid">{cells}</ol>
      <div class="dm-ctl"><p class="label">One spot</p><p class="sb-count"><b data-n>0</b>/10 banked</p><div class="sb-bar"><i data-bar></i></div><p class="sb-say" data-say>Change the size, the height or the action. Not just the angle.</p></div>
    </div>"""

# ---------------------------------------------------------------- storefront
def storefront():
    # The hero is a ring of real frames turning in 3D behind the headline (reference: "3D Orbit Gallery",
    # wundercorp/awesome-components). Drag to spin. Every frame is Cooper's own footage or photos.
    ring = ["/videos/work/chapter-one.jpg", "/img/chapters/stage-color-720.webp", "/img/ai/code-720.webp", "/videos/work/bioswap-final.jpg",
            "/img/chapters/bass-720.webp", "/videos/work/the-start.jpg", "/img/gear/rig-marshall-480.webp", "/videos/work/launch-film.jpg",
            "/img/chapters/desk-720.webp", "/videos/work/pv-turntable.jpg", "/img/chapters/bar-720.webp", "/img/ai/pc-720.webp",
            "/img/chapters/ep-720.webp", "/videos/work/rubber-band.jpg", "/img/gear/rig-pedals-480.webp", "/img/chapters/deck-720.webp"]
    cards = "".join(f'<li style="--i:{i}"><img src="{u}" alt="" loading="{"eager" if i < 6 else "lazy"}" decoding="async" draggable="false" /></li>' for i, u in enumerate(ring))
    body = f"""  <section class="sh-hero" aria-labelledby="sh-h">
    <div class="orbit" data-orbit aria-hidden="true" style="--n:{len(ring)}"><ul class="orbit-ring">{cards}</ul></div>
    <div class="sh-copy">
      <p class="label">Shop</p>
      <h1 id="sh-h" data-hero><span class="line"><span>Tools I made</span></span><span class="line"><span>for my own work.</span></span></h1>
      <p>Kits, prompts and templates from the way I actually design, film, play and build. Try every one before you get it.</p>
      <a class="pill solid" href="#folder">Open the folder {ARROW}</a>
    </div>
  </section>

  <section class="sh-folder" id="folder" aria-labelledby="fd-h">
    <div class="sh-head"><h2 id="fd-h">The whole shop is one folder.</h2><p>Click a file. Paid kits, and guides that are free with an email.</p></div>
    <div class="win" data-folder>
      <div class="win-bar"><i></i><i></i><i></i><span>~/cooperdelo/shop</span></div>
      <div class="win-body">
        <aside class="win-side label"><p>Show</p>
          <button type="button" class="on" data-filter="all">All</button><button type="button" data-filter="paid">Paid</button><button type="button" data-filter="email">Free with email</button><button type="button" data-filter="free">Free</button>
        </aside>
        <ol class="files" data-files><li class="files-wait label">Loading the folder</li></ol>
      </div>
      <div class="win-status label"><span data-count>&nbsp;</span><span>Instant access · tax at checkout · promo codes welcome</span></div>
    </div>
  </section>

  <section class="sh-demo" aria-labelledby="d1-h">
    <div class="sh-head"><p class="label">Design kit · try it</p><h2 id="d1-h">Make it not look like AI.</h2></div>
    {demo_design()}
    <div class="sh-cta"><a class="pill solid" href="/shop/design-kit">See the Design kit {ARROW}</a></div>
  </section>

  <section class="sh-demo" aria-labelledby="d2-h">
    <div class="sh-head"><p class="label">LinkedIn guide · free with email</p><h2 id="d2-h">Score your first line.</h2></div>
    {demo_linkedin()}
    <div class="sh-cta"><a class="pill" href="/resources/guides/linkedin">Get the full guide {ARROW}</a></div>
  </section>

  <section class="sh-demo" aria-labelledby="d3-h">
    <div class="sh-head"><p class="label">Music guide · free with email</p><h2 id="d3-h">Sort a setlist.</h2></div>
    {demo_music()}
    <div class="sh-cta"><a class="pill" href="/resources/guides/music">Get the full guide {ARROW}</a></div>
  </section>

  <section class="sh-faq" aria-labelledby="fq-h">
    <h2 id="fq-h">What people ask me.</h2>
    <div class="faq">
      <details><summary>What do I actually get?</summary><p>A page that stays unlocked in your browser with every step, every rule and every prompt, each with a copy button. You paste them into Claude and build.</p></details>
      <details><summary>Do I need to code?</summary><p>No. The prompts do the asking. If you can paste text into Claude, you can use them.</p></details>
      <details><summary>Is the free stuff actually free?</summary><p>Yes. Some guides ask for an email so I can send you new ones. The film planner doesn't even ask for that.</p></details>
      <details><summary>Can I use it for client work? <span class="draft">Draft</span></summary><p>Answer pending. Cooper sets the license before this goes live.</p></details>
      <details><summary>Refunds? <span class="draft">Draft</span></summary><p>Policy pending. Cooper sets it before this goes live.</p></details>
    </div>
  </section>"""
    page("shop/index", "Shop", "Kits, prompts and templates Cooper Delo made for his own work first.", body)

# ---------------------------------------------------------------- the paid kit
def design_kit():
    body = f"""  <section class="kp-hero" data-kit="design" aria-labelledby="kp-h">
    <a class="kp-back label" href="/shop">{ARROW} Shop</a>
    <div class="kp-art" aria-hidden="true"><div class="fold"><b>design-kit/</b><ul><li>references</li><li>anti-slop rules</li><li>type + color</li><li>the one prompt</li></ul></div><span class="tag">Kit</span></div>
    <p class="label" data-k-pillar>Design kit</p>
    <h1 id="kp-h" data-k-title>&nbsp;</h1>
    <p class="kp-result" data-k-result></p>
    <div class="kp-buy" data-buy>
      <p class="kp-price"><b data-k-price>&nbsp;</b><span class="draft" data-k-draft hidden>Draft price</span></p>
      <form class="kp-form" data-checkout><button class="pill solid" type="submit">Get the kit {ARROW}</button><label class="kp-code"><span class="label">Promo code</span><input name="code" maxlength="40" autocomplete="off" placeholder="Optional" /></label></form>
      <p class="kp-fine label">Tax calculated at checkout · secure payment by Stripe · instant access</p>
      <p class="kp-msg" data-msg role="status"></p>
    </div>
    <div class="kp-owned" data-owned hidden><p class="label">Yours</p><p>It stays unlocked in this browser. Stripe emailed your receipt.</p></div>
  </section>

  <section class="kp-inside" aria-labelledby="in-h">
    <div class="sh-head"><p class="label">What's inside</p><h2 id="in-h">Every step, every rule, the one prompt.</h2></div>
    <ol class="kp-outline" data-outline></ol>
  </section>

  <section class="sh-demo" aria-labelledby="d1-h">
    <div class="sh-head"><p class="label">Try it</p><h2 id="d1-h">Make it not look like AI.</h2></div>
    {demo_design()}
  </section>

  <section class="kp-full" data-full hidden aria-label="The kit"></section>"""
    page("shop/design-kit", "Design kit", "The references, rules and prompt Cooper Delo uses to build sites that don't look like AI.", body)

# ---------------------------------------------------------------- gated guides on the main site
GUIDE_DEMO = {"linkedin": demo_linkedin, "music": demo_music, "ai-system": demo_vault, "instagram-tiktok": demo_week, "film-motion": demo_shots}

def guide(slug):
    demo = GUIDE_DEMO.get(slug)
    demo_html = f'<section class="gd-demo" aria-label="Try it">{demo()}</section>' if demo else ""
    body = f"""  <section class="gd-hero light" data-kit="{slug}" aria-labelledby="gd-h">
    <a class="kp-back label" href="/resources">{ARROW} Resources</a>
    <p class="label" data-k-pillar>&nbsp;</p>
    <h1 id="gd-h" data-k-title>&nbsp;</h1>
    <p class="kp-result" data-k-result></p>
    <div class="gd-proof" data-k-proof></div>
  </section>
  {demo_html}
  <section class="gd-body light" aria-label="The guide">
    <ol class="gd-steps" data-steps></ol>
    <div class="gd-more" data-gate hidden><button type="button" class="pill solid" data-gm-open>Unlock the rest, free {ARROW}</button><p class="label" data-gate-count></p></div>
    <div class="gd-master" data-master hidden></div>
  </section>
  <div class="gm" data-gate-modal hidden data-lenis-prevent>
    <div class="gm-scrim" data-gm-close></div>
    <div class="gm-card" role="dialog" aria-modal="true" aria-labelledby="gm-h">
      <button type="button" class="gm-x label" data-gm-close>Not now</button>
      <p class="label" data-gm-count></p>
      <h2 id="gm-h">Get the rest.</h2>
      <p class="gm-sub">Free. Put in your email and the whole guide opens right here.</p>
      <ol class="gm-list" data-gm-outline></ol>
      <form class="gd-form" data-email-gate><label><span class="label">Email</span><input type="email" name="email" required maxlength="254" autocomplete="email" placeholder="you@email.com" /></label><button class="pill solid" type="submit">Open the guide {ARROW}</button></form>
      <p class="kp-msg" data-msg role="status"></p>
      <p class="gd-fine">I'll only use it to send you new guides. <span class="draft">Draft</span></p>
    </div>
  </div>
  <div class="gd-bar" data-gate-bar hidden><span data-bar-count></span><button type="button" class="pill solid" data-gm-open>Unlock free {ARROW}</button></div>"""
    page(f"resources/guides/{slug}", "Guide", "A free guide from Cooper Delo.", body, css=("/assets/together.css", "/assets/shop.css"), shop=False)

def resources_shelf():
    """Add a Guides shelf to /resources (QA only), drawn from /api/kit at runtime."""
    p = ROOT / "resources" / "index.html"
    html = p.read_text(encoding="utf-8")
    if "data-guides" in html:
        return
    shelf = f"""  <section class="gd-shelf light" aria-labelledby="gs-h">
    <div class="sh-head"><p class="label">Guides</p><h2 id="gs-h">The way I actually do it.</h2></div>
    <ol class="gd-list" data-guides><li class="files-wait label">Loading</li></ol>
    <p class="gd-shop"><a class="pill" href="/shop">See the shop {ARROW}</a></p>
  </section>
"""
    html = html.replace('  <section class="shelf light"', shelf + '  <section class="shelf light"', 1)
    html = html.replace('<link rel="stylesheet" href="/assets/together.css" />', '<link rel="stylesheet" href="/assets/together.css" />\n<link rel="stylesheet" href="/assets/shop.css" />', 1)
    html = html.replace('<script src="/assets/together.js" defer></script>', '<script src="/assets/together.js" defer></script>\n<script src="/assets/kit.js" defer></script>', 1)
    html = html.replace("<body class=\"page\">", f"<body class=\"page\">\n{QA}", 1)
    p.write_text(html, encoding="utf-8", newline="\n")
    print("wrote resources/index.html (guides shelf)")

if __name__ == "__main__":
    storefront()
    design_kit()
    for s in ["ai-system", "linkedin", "instagram-tiktok", "film-motion", "music", "startup"]:
        guide(s)
