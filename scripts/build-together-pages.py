"""Build /work-with-me, /resources and /resources/film-plan with the site's own head, nav and footer.

    python scripts/build-together-pages.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
import sys
sys.path.insert(0, str(ROOT / "scripts"))
from site_data import next_block, mk_line  # noqa: E402
ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
CAL = "https://cal.com/cooper-delo1"
PV = "https://plugverse.app/?utm_source=cooperdelo&utm_medium=portfolio&utm_campaign=artist_workflow"


def page(path, title, desc, body, og="https://cooperdelo.com/img/poster-montage-1920-3a4824-1280.jpg", css=()):
    extra_css = "".join(f'\n<link rel="stylesheet" href="{c}" />' for c in css)
    url = "https://cooperdelo.com/" + path.removesuffix("/index")
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>{title} / Cooper Delo</title>
<meta name="description" content="{desc}" />
<meta name="theme-color" content="#16130F" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="manifest" href="/site.webmanifest" />
<meta property="og:title" content="{title} / Cooper Delo" />
<meta property="og:description" content="{desc}" />
<meta property="og:image" content="{og}" />
<meta property="og:url" content="{url}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="{url}" />
<link rel="preload" href="/fonts/DrukWideBold.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/fonts/NimbusSans-Bold.woff2" as="font" type="font/woff2" crossorigin />
<link rel="stylesheet" href="/assets/site.css" />
<link rel="stylesheet" href="/assets/together.css" />{extra_css}
<script>(function(d){{var r=d.documentElement;try{{if(sessionStorage.getItem('cd-intro'))r.classList.add('seen')}}catch(e){{}}if(matchMedia('(prefers-reduced-motion: reduce)').matches)r.classList.add('rm')}})(document)</script>
</head>
<body class="page">
<header class="nav label">
  <a class="mark" href="/" aria-label="Cooper Delo, home"><span class="roll"><span>Cooper Delo</span><span aria-hidden="true">Cooper Delo</span></span></a>
  <span class="where">Chapel Hill, NC&nbsp;&nbsp;<span data-clock>--:--</span> ET</span>
  <nav class="links" aria-label="Primary"><a href="/work"><span class="roll"><span>Work</span><span aria-hidden="true">Work</span></span></a><a href="/resources"><span class="roll"><span>Resources</span><span aria-hidden="true">Resources</span></span></a><a href="/shop"><span class="roll"><span>Shop</span><span aria-hidden="true">Shop</span></span></a><a href="#contact" data-contact><span class="roll"><span>Contact</span><span aria-hidden="true">Contact</span></span></a></nav>
</header>
<main>
{body}
</main>
<footer class="contact" id="contact">
  <div class="bg"><picture><source type="image/avif" srcset="/img/chiphi-band-640.avif 640w, /img/chiphi-band-1280.avif 1280w, /img/chiphi-band-1920.avif 1920w" sizes="100vw" /><source type="image/webp" srcset="/img/chiphi-band-640.webp 640w, /img/chiphi-band-1280.webp 1280w, /img/chiphi-band-1920.webp 1920w" sizes="100vw" /><img src="/img/chiphi-band-1280.jpg" srcset="/img/chiphi-band-640.jpg 640w, /img/chiphi-band-1280.jpg 1280w, /img/chiphi-band-1920.jpg 1920w" sizes="100vw" width="1920" height="1080" alt="" loading="lazy" decoding="async" /></picture></div>
  <p class="label say">Say hi</p>
  <a class="mail" href="mailto:cooper@plugverse.app" data-rv><span class="line"><span data-fit>cooper@plugverse.app</span></span></a>
  <div class="cta">
    <a class="pill solid" href="{CAL}" target="_blank" rel="noreferrer">Book a call {ARROW}</a>
    <a class="pill" href="mailto:cooper@plugverse.app">Email</a>
    <a class="pill" href="https://www.linkedin.com/in/cooperdelo/" target="_blank" rel="noreferrer">LinkedIn</a>
  </div>
  <div class="base label">
    <span>&copy; 2026 Cooper Delo</span>
    <nav aria-label="Elsewhere">
      <a href="/resume">Resume</a>
      <a href="/resources">Resources</a>
      <a href="/gear">Gear</a>
      <a href="https://instagram.com/cooperdelo" target="_blank" rel="noreferrer">Instagram</a>
      <a href="https://tiktok.com/@cooperdelo" target="_blank" rel="noreferrer">TikTok</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </nav>
  </div>
</footer>
<script src="/assets/lenis.min.js" defer></script>
<script src="/assets/site.js" defer></script>
<script src="/assets/beacon.js" defer></script>
<script src="/assets/contact.js" defer></script>
<script src="/assets/together.js" defer></script>
</body>
</html>
"""
    out = ROOT / (path + ".html")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8", newline="\n")
    print("wrote", out.relative_to(ROOT))


KINDS = ["Film or motion", "Product or creative", "Summer 2027"]

PATHS = [
    ("01", "A film or motion piece",
     "A short film for a launch. Motion that makes a product easier to understand. Tell me the goal and what you have already, and we can figure out the right scope from there.",
     [("PlugVerse launch film", "/work/plugverse-launch-film"), ("Bioswap", "/work/bioswap")], KINDS[0]),
    ("02", "Product and creative",
     "Help turning an idea into something people can use. I built PlugVerse solo with Claude Code, across the product, design, front end and back end.",
     [("PlugVerse product", "/work/plugverse-product"), ("Chapter One", "/work/chapter-one")], KINDS[1]),
    ("03", "Summer 2027",
     "I'm looking for summer 2027 opportunities in growth, creative or product. SF first, NYC too.",
     [("Resume", "/resume"), ("LinkedIn", "https://www.linkedin.com/in/cooperdelo/")], KINDS[2]),
]


def work_with_me():
    rows = []
    for no, h, p, proof, kind in PATHS:
        links = "".join(
            f'<a href="{u}"{" target=\"_blank\" rel=\"noreferrer\"" if u.startswith("http") else ""}>{t}</a>' for t, u in proof)
        rows.append(f"""      <li class="path" data-rv>
        <span class="label no">{no}</span>
        <h2>{h}</h2>
        <p>{p}</p>
        <div class="proof"><span class="label">See it</span>{links}<a class="pill start" href="#brief" data-kind="{kind}">Start here {ARROW}</a></div>
      </li>""")
    kinds = "".join(
        f'<label class="kind"><input type="radio" name="kind" value="{k}"{" checked" if i == 0 else ""} /><span>{k}</span></label>'
        for i, k in enumerate(KINDS))
    body = f"""  <section class="pg-hero light" aria-labelledby="pg-h">
    <p class="label">Work with me</p>
    <h1 id="pg-h" data-hero><span class="line"><span>What are</span></span><span class="line"><span>you building?</span></span></h1>
    <p class="lede">I make films, motion and product. If you're building something and need help showing people why it matters, tell me what you're working on.</p>
  </section>
  <section class="paths light" aria-label="Ways to work together">
    <ol>
{chr(10).join(rows)}
    </ol>
  </section>
  <section class="brief dark" id="brief" aria-labelledby="brief-h">
    <div class="intro-b">
      <p class="label">The brief</p>
      <h2 id="brief-h" data-rv><span class="line"><span>Tell me</span></span><span class="line"><span>about it.</span></span></h2>
      <p>A few lines is plenty. What it is, who it's for, and where you're stuck. If you'd rather just talk, <a href="{CAL}" target="_blank" rel="noreferrer" style="border-bottom:1px solid currentColor">book a call</a>.</p>
    </div>
    <form data-brief novalidate>
      <fieldset><legend class="label">What is it</legend>{kinds}</fieldset>
      <label class="field"><span class="label">What are you working on</span><textarea name="brief" required maxlength="3000" placeholder="The project, who it's for, and where you need help."></textarea></label>
      <div class="row2">
        <label class="field"><span class="label">When</span><input name="timing" maxlength="120" placeholder="A rough timeline is fine" /></label>
        <label class="field"><span class="label">Budget or role, if you know</span><input name="budget" maxlength="180" placeholder="Optional" /></label>
      </div>
      <div class="send"><button class="pill solid" type="submit">Write the email {ARROW}</button><p class="note">This writes a draft in your own email app. Nothing gets sent or saved from this page.</p></div>
      <div class="ready" data-ready hidden role="status"><a class="pill" href="mailto:cooper@plugverse.app">Open the draft {ARROW}</a><p class="note">Read it over, add anything I missed, and send it when you're ready.</p></div>
    </form>
  </section>
  <section class="side light" aria-labelledby="side-h">
    <p class="label">Booking your own shows</p>
    <h2 id="side-h" data-rv><span class="line"><span>In a band?</span></span></h2>
    <p>I use PlugVerse for my band's gigs. When someone reaches out, I send an offer with the event details. They accept and sign in the same place.</p>
    <div class="acts"><a class="pill" href="{PV}" target="_blank" rel="noreferrer">See PlugVerse {ARROW}</a></div>
  </section>"""
    page("work-with-me", "Work with me", "Films, motion and product by Cooper Delo. Tell me what you're building.", body)


# Cooper's playbook (vault: Projects/personal-brand CONTENT-OS, SCRIPT-SYSTEM, MECHANIC-LIBRARY, IDEATION-RULE,
# CINEMATIC-FIELD-MANUAL). Public-safe: no private stats, names or topics. Each line: (rule, why it holds).
PLAYBOOK = [
    ("Hooks", "hooks", [
        ("Start mid-thought.", "No intro. Delete your first sentence. Most people who leave, leave at 0:01."),
        ("Confess, don't flex.", "A struggle holds people. A highlight reel loses them."),
        ("Say I, not you.", "Earn we and you later. One creator went from 3,900 views to 15M on that switch alone."),
        ("One detail nobody else could say.", "Themes are generic. Scenes are unforgeable."),
    ]),
    ("Story", "story", [
        ("What does a stranger want answered?", "Open that question in the first seconds."),
        ("But, or therefore.", "Every beat causes the next. Never and then."),
        ("Hold the lesson.", "Until the story earns it. Sometimes it never needs one."),
        ("Answer what you opened.", "Then give a true reason to come back."),
    ]),
    ("Retention", "retention", [
        ("Finishes beat likes.", "On my account, a video 24.9% of people finished got 2.2x the views of one 8.7% finished."),
        ("A new picture every second, for three seconds.", "Then cuts every 2 to 3. Only the point gets to breathe."),
        ("Two lines of text, max.", "About 40 characters, upper middle, readable in frame one."),
        ("Length isn't the problem.", "30 to 60 seconds of talking with no turn is. Never fade to black mid-video."),
    ]),
]


def film_prompt():
    rules = "\n\n".join(f"{name.upper()}\n" + "\n".join(f"- {r} {why}" for r, why in items) for name, _, items in PLAYBOOK)
    return ("I'm making a short video. Below is Cooper Delo's playbook: the hooks, story checks and retention rules he uses. "
            "Use it to shape my idea, in my words. It's a toolbox, not a checklist. Use what fits.\n\n"
            "MY IDEA: [one or two lines. What happened, and what footage you have or can get.]\n\n"
            + rules +
            "\n\nGIVE ME\n"
            "1. Three opening lines for my idea, each from a different hook, in my voice. Pick one and say why in a sentence.\n"
            "2. The story in 5 to 7 one-line beats, joined by but or therefore.\n"
            "3. A cut map for the first 10 seconds: what we see, hear and read.\n"
            "4. A shot list grouped by location, using only what I said I have.\n\n"
            "Never invent anything about my life or my footage. If I didn't say what actually happened, ask me that one question and nothing else.")


def resources():
    """Gaku's 'Curated insights & creative resources': every resource as a real cover, newest first."""
    import runpy
    ex = runpy.run_path(str(ROOT / "scripts" / "build-home-extras.py"))
    body = f"""  <section class="pg-hero light rs-hero" aria-labelledby="pg-h">
    <p class="label">Resources</p>
    <h1 id="pg-h" data-hero><span class="line"><span>Resources.</span></span></h1>
    <p class="lede">How I actually make things: films, content, the band, PlugVerse, the system behind it. Copy what helps. Nothing to sign up for unless you want the deep ones.</p>
  </section>
  {ex["res_bento"](heading=False)}"""
    page("resources/index", "Resources", "How Cooper Delo actually makes things: films, content, music, PlugVerse and the AI system behind it.", body, css=("/assets/doors.css",))


def film_plan():
    """Not a form, not an interview. Cooper's playbook on the page, and one prompt that carries it into your AI."""
    cols = "".join(f'''<div class="fp-col"><p class="label">{name}</p><ul>{"".join(f"<li><b>{r}</b><span>{why}</span></li>" for r, why in items)}</ul></div>''' for name, _, items in PLAYBOOK)
    prompt = html_escape(film_prompt()).replace("MY IDEA: [", '<mark>MY IDEA: [', 1).replace("can get.]", "can get.]</mark>", 1)
    body = f"""  <section class="fp-hero dark" aria-labelledby="pg-h">
    <video class="fp-vid" muted loop playsinline autoplay preload="metadata" poster="/videos/work/launch-film.jpg" aria-hidden="true"><source src="/videos/work/launch-film.mp4" type="video/mp4" /></video>
    <div class="fp-copy">
      <p class="label">Resources / Film planner</p>
      <h1 id="pg-h" data-hero><span class="line"><span>Hooks that</span></span><span class="line"><span>hold.</span></span></h1>
      <p class="lede">The hooks, story checks and retention rules I actually use. Paste them into ChatGPT or Claude with your idea, and it writes yours, your way.</p>
    </div>
  </section>
  <section class="fp light" aria-label="The playbook">
    <div class="fp-cols">{cols}</div>
    <div class="fp-prompt"><p class="label">One paste. Change the highlighted line.</p><div class="cb"><pre>{prompt}</pre><button type="button" class="cp" aria-label="Copy the prompt">Copy</button></div>
      <p class="note">Same rules behind the <a href="/work/plugverse-launch-film">PlugVerse launch film</a>.</p></div>
  </section>
  {next_block("film-plan")}"""
    page("resources/film-plan", "Film planner", "Cooper Delo's hooks, story checks and retention rules, as one prompt you paste into your AI with your idea.", body, css=("/assets/gear.css",))


def html_escape(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ---------- gear: only what Cooper confirmed on 2026-10-02 (vault Context/user.md). ----------
# Every item leads with a picture: his renders (/photos/gear-*.jpg) or a frame from his own footage.
AMAZON_TAG = ""  # add Cooper's Amazon Associates tag here when he has one
def amz(q):
    from urllib.parse import quote_plus
    return f"https://www.amazon.com/s?k={quote_plus(q)}" + (f"&tag={AMAZON_TAG}" if AMAZON_TAG else "")

GEAR = [
    ("Guitars", "guitars", [
        ("tele", "Fender Telecaster", "American Professional II. Indie, funk, country.", amz("Fender American Professional II Telecaster")),
        ("prs-live", "PRS Custom 24-08", "The core one, not the SE. Big classic-rock leads.", amz("PRS Custom 24-08")),
        ("acoustic", "Takamine GN51CE", "Acoustic. Passive DI to the PA at gigs.", amz("Takamine GN51CE")),
        ("bass", "Epiphone Embassy", "The green bass, for when I'm on bass.", amz("Epiphone Embassy Bass")),
    ]),
    ("Amps and effects", "amp", [
        ("", "Marshall DSL40CR", "Stealth Edition. All tubes. This is the tone.", amz("Marshall DSL40CR")),
        ("", "Line 6 Pod Go", "Pedals only. The amp block stays off.", amz("Line 6 Pod Go")),
        ("", "Fender Rumble 500", "Bass combo.", amz("Fender Rumble 500")),
    ]),
    ("Camera", "camera", [
        ("camera", "Sony A7C II", "With the FE 16mm F1.8 G and the FE 24-50mm F2.8 G.", amz("Sony A7C II")),
        ("", "K&F Concept 67mm VND", "7-click variable ND. On both lenses.", amz("K&F Concept 67mm variable ND")),
    ]),
    ("Studio", "studio", [
        ("desk", "Focusrite Scarlett 2i2", "Interface.", amz("Focusrite Scarlett 2i2")),
        ("", "sE Electronics sE2200", "Condenser. Vocals and voiceover.", amz("sE Electronics sE2200")),
        ("headphones", "beyerdynamic DT 770 Pro X", "Headphones.", amz("beyerdynamic DT 770 Pro X")),
    ]),
]
ALSO = [("Shure SM58", amz("Shure SM58")), ("RØDE mic arm", amz("RODE PSA1+")), ("Sony FE 16mm F1.8 G", amz("Sony FE 16mm F1.8 G")), ("Sony FE 24-50mm F2.8 G", amz("Sony FE 24-50mm F2.8 G"))]


def gimg(key, alt, sizes="(max-width: 700px) 90vw, 30vw"):
    return f'<img src="/img/gear/{key}-900.webp" srcset="/img/gear/{key}-480.webp 480w, /img/gear/{key}-900.webp 900w" sizes="{sizes}" alt="{alt}" loading="lazy" decoding="async" />'


def gear():
    """Concise: a hero, three rendered pieces, then one list of everything (ref: services list with a hover image)."""
    feat = [("prs-live", "Live", "The PRS into the Marshall, Chi Phi."), ("tele", "At the desk", "The Tele, most nights."), ("headphones", "Recording", "DT 770s on, Scarlett 2i2 in.")]
    feats = "".join(f'''<figure class="gf" data-tilt><span class="gf-img">{gimg(k, n, "(max-width: 900px) 90vw, 32vw")}</span><figcaption><b>{n}</b><span>{d}</span></figcaption></figure>''' for k, n, d in feat)
    rows = []
    for cat, slug, items in GEAR:
        rows.append(f'<li class="gl-cat label">{cat}</li>')
        rows += [f'''<li><a class="gl" href="{url}" target="_blank" rel="noreferrer sponsored" {f' data-img="/img/gear/{key}-480.webp"' if key else ""}><b>{name}</b><span>{note}</span><i class="label">Amazon {ARROW}</i></a></li>''' for key, name, note, url in items]
    rows.append('<li class="gl-cat label">Color and edit</li>')
    rows.append(f'''<li><a class="gl" href="https://www.blackmagicdesign.com/products/davinciresolve" target="_blank" rel="noreferrer" data-img="/videos/work/chapter-one.jpg"><b>DaVinci Resolve Studio</b><span>Every film on this site is cut and graded here.</span><i class="label">Blackmagic {ARROW}</i></a></li>''')
    rows.append(f'''<li><a class="gl" href="https://shop.gakuyen.com/products/odyssey-powergrade" target="_blank" rel="noreferrer" data-img="/videos/work/the-start.jpg"><b>Odyssey PowerGrade</b><span>Gaku's grade, on one adjustment layer.</span><i class="label">shop.gakuyen.com {ARROW}</i></a></li>''')
    rows.append('<li class="gl-cat label">Also on the desk</li>')
    rows += [f'<li><a class="gl" href="{u}" target="_blank" rel="noreferrer sponsored"><b>{n}</b><span></span><i class="label">Amazon {ARROW}</i></a></li>' for n, u in ALSO]
    body = f"""  <section class="gh dark" aria-labelledby="pg-h">
    <video class="gh-vid" muted loop playsinline autoplay preload="metadata" poster="/videos/work/gear-hero.jpg" aria-hidden="true">
      <source src="/videos/work/gear-hero.webm" type="video/webm" /><source src="/videos/work/gear-hero.mp4" type="video/mp4" /></video>
    <div class="gh-copy"><p class="label">Resources / Setup · always up to date</p>
      <h1 id="pg-h" data-hero><span class="line"><span>My setup.</span></span></h1>
      <p class="lede">Everything I shoot, play and record with, in one place.</p></div>
  </section>
  <section class="gfs dark" aria-label="In use">{feats}</section>
  <section class="gls light" aria-label="Everything I use">
    <ul class="gl-list" data-glist>{"".join(rows)}</ul>
    <p class="fine">Amazon links are searches for the exact model. <span class="draft">Draft</span> If they become affiliate links, this line will say so.</p>
    <img class="gl-float" data-gfloat alt="" aria-hidden="true" />
  </section>
  {mk_line("film-motion", "How I film with it", "gear")}"""
    page("gear", "My setup", "The guitars, amp, camera, studio gear and grade Cooper Delo actually uses.", body, css=("/assets/gear.css",))


if __name__ == "__main__":
    work_with_me()
    resources()
    film_plan()
    gear()
