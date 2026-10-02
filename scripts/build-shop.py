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
    <nav aria-label="Elsewhere"><a href="/">Portfolio</a><a href="/resources">Free resources</a><a href="/work-with-me">Work with me</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav>
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

# ---------------------------------------------------------------- storefront
def storefront():
    collage = [("home-collage-5", "c1", "Might As Well"), ("work-chapter-one-still-1", "c2", "Chapter One"), ("home-collage-1", "c3", "At the laptop"),
               ("home-collage-2", "c4", "Porch show"), ("work-plugverse-product-render-1", "c5", "PlugVerse")]
    prints = "".join(f'<figure class="pr {c}"><span class="tape" aria-hidden="true"></span>{spic(s, "", "(max-width: 900px) 46vw, 22vw")}<figcaption class="label">{cap}</figcaption></figure>' for s, c, cap in collage)
    body = f"""  <section class="sh-hero" aria-labelledby="sh-h">
    <div class="sh-collage" aria-hidden="true">{prints}
      <img class="rec" src="/img/records/record-640.webp" width="640" height="640" alt="" />
      <img class="slv" src="/img/records/sleeve-cooper-delo-flicker-of-time-640.webp" width="640" height="640" alt="" />
      <span class="stk s1">design-kit.md</span><span class="stk s2">one folder</span><span class="stk s3">no AI images</span>
    </div>
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
GUIDE_DEMO = {"linkedin": demo_linkedin, "music": demo_music}

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
    <div class="gd-gate" data-gate hidden>
      <p class="label" data-gate-count></p>
      <h2>Get the rest.</h2>
      <p>Free. Put in your email and the whole guide opens right here.</p>
      <form class="gd-form" data-email-gate><label><span class="label">Email</span><input type="email" name="email" required maxlength="254" autocomplete="email" placeholder="you@email.com" /></label><button class="pill solid" type="submit">Open the guide {ARROW}</button></form>
      <p class="kp-msg" data-msg role="status"></p>
      <p class="gd-fine">I'll only use it to send you new guides. <span class="draft">Draft</span></p>
    </div>
    <div class="gd-master" data-master hidden></div>
  </section>"""
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
    resources_shelf()
