"""Build /work-with-me, /resources and /resources/film-plan with the site's own head, nav and footer.

    python scripts/build-together-pages.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
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
  <nav class="links" aria-label="Primary"><a href="/work"><span class="roll"><span>Work</span><span aria-hidden="true">Work</span></span></a><a href="/resources"><span class="roll"><span>Resources</span><span aria-hidden="true">Resources</span></span></a><a href="/#about"><span class="roll"><span>About</span><span aria-hidden="true">About</span></span></a><a href="/#contact"><span class="roll"><span>Contact</span><span aria-hidden="true">Contact</span></span></a></nav>
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


PROMPTS = [
    ("The actual idea", "What happened? What do you want someone to feel?", "idea"),
    ("The first thing we see or hear", "Give someone a reason to keep watching.", "opening"),
    ("What are we waiting to find out", "A real unanswered question, not a vague promise.", "question"),
    ("What changes", "The attempt, complication or detail that moves it forward.", "change"),
    ("What the ending gives us", "Answer the question you opened. You don't need a life lesson.", "payoff"),
    ("What you need to shoot", "The action, framing, location and sound. Use what you actually have.", "shots"),
    ("What happens after someone watches", "Come back, see more of your work, try the thing, or just enjoy it.", "next_step"),
]


def resources():
    sheet = "".join(f"<li><span>{h}</span><i></i><i></i></li>" for h, _, _ in PROMPTS)
    body = f"""  <section class="pg-hero light" aria-labelledby="pg-h">
    <p class="label">Resources</p>
    <h1 id="pg-h" data-hero><span class="line"><span>Take what</span></span><span class="line"><span>helps.</span></span></h1>
    <p class="lede">Things I actually use, cleaned up so you can use them too. One is ready. One I'm still pulling apart.</p>
  </section>
  <section class="shelf light" aria-label="Resources">
    <article class="res res-wide" data-rv>
      <div class="top label"><span class="state live">Ready, free</span><span>Updated Oct 2026</span></div>
      <a class="plate rig-mini" href="/gear" aria-label="Open the gear page">
        <span class="rm-end">Tele or PRS</span><span class="rm-pod"><i class="off">Amp</i><i>EQ</i><i>Screamer</i><i>Chorus</i><i>Delay</i><i>Reverb</i></span><span class="rm-end">Marshall DSL40CR</span>
      </a>
      <h2>Gear</h2>
      <p>The guitars, amp, camera and studio gear I actually use, with the Pod Go chain I run into the Marshall.</p>
      <div class="acts"><a class="pill" href="/gear">See the gear {ARROW}</a></div>
    </article>
    <article class="res" data-rv>
      <div class="top label"><span class="state live">Ready, free</span><span>No email needed</span></div>
      <div class="plate desk">
        <div class="sheet" aria-label="What the planner asks">
          <p class="sheet-h">My film plan</p>
          <ol>{sheet}</ol>
          <p class="sheet-foot label">cooperdelo.com/resources/film-plan</p>
        </div>
        <figure class="taped"><img src="/img/p-launch-film-640.webp" width="640" height="360" alt="A still from the PlugVerse launch film" loading="lazy" decoding="async" /><figcaption>PlugVerse launch film</figcaption></figure>
      </div>
      <h2>Film planner</h2>
      <p>The questions I answer before I shoot anything. Fill them in, it saves in your browser, and you can download or print the plan when you're done.</p>
      <div class="acts"><a class="pill" href="/resources/film-plan">Open the planner {ARROW}</a></div>
    </article>
    <article class="res" data-rv>
      <div class="top label"><span class="state">In progress</span><span>Not ready yet</span></div>
      <div class="plate anatomy">
        <picture><source type="image/webp" srcset="/img/resources/motion-anatomy-720.webp 720w, /img/resources/motion-anatomy-1200.webp 1200w" sizes="(max-width: 900px) 92vw, 46vw" /><img src="/img/resources/motion-anatomy-720.webp" width="720" height="720" alt="A frame from Bioswap: a glass music card floating over a blurred band page" loading="lazy" decoding="async" /></picture>
        <span class="pin r" style="--x:96%;--y:80%"><b>Glass card</b>blur, lit top edge, soft inner shadow</span>
        <span class="pin r" style="--x:96%;--y:5%"><b>Depth</b>the page stays behind it, out of focus</span>
        <span class="pin" style="--x:4%;--y:5%"><b>One camera</b>the whole scene moves, never a cut</span>
        <span class="wip label">What I'm pulling out</span>
      </div>
      <h2>Motion starter</h2>
      <p>The camera rig, the glass cards and the spring timings from Bioswap, pulled out so you can drop them into your own Remotion project. I'm still building it, so there's nothing to download yet.</p>
      <div class="acts"><a class="pill" href="mailto:cooper@plugverse.app?subject=Motion%20starter">Email me when it's ready</a><a class="pill" href="/#motion">How Bioswap moves</a></div>
      <p class="fine">That button just opens an email to me. There's no mailing list behind it.</p>
    </article>
  </section>
  <section class="side light" aria-labelledby="side-h">
    <p class="label">Booking your own shows</p>
    <h2 id="side-h" data-rv><span class="line"><span>In a band?</span></span></h2>
    <p>I use PlugVerse for my band's gigs. When someone reaches out, I send an offer with the event details. They accept and sign in the same place.</p>
    <div class="acts"><a class="pill" href="{PV}" target="_blank" rel="noreferrer">See PlugVerse {ARROW}</a></div>
  </section>"""
    page("resources/index", "Resources", "Things Cooper Delo uses, cleaned up so you can use them too.", body)


def film_plan():
    """Not a form. Cooper's framework, and one prompt you paste into your own AI so it interviews you."""
    steps = "".join(f'<li><span class="label">{i + 1:02d}</span><b>{h}</b><span>{l}</span></li>' for i, (h, l, _) in enumerate(PROMPTS))
    prompt = ("You're helping me plan a short video. Use Cooper Delo's film framework.\n\n"
              "Ask me these one at a time, and wait for my answer before the next:\n"
              + "\n".join(f"{i + 1}. {h}. {l}" for i, (h, l, _) in enumerate(PROMPTS))
              + "\n\nRules: keep my answers in my words. If an answer is vague, ask one follow-up, not five. "
                "Never invent details about my life or my footage.\n\n"
                "When we're done, give me one page: the idea in one line, the opening shot, the question it holds, "
                "what changes, the ending, and a shot list grouped by location (about 10 shots per location, each a different size, height or action).")
    body = f"""  <section class="fp-hero dark" aria-labelledby="pg-h">
    <video class="fp-vid" muted loop playsinline autoplay preload="metadata" poster="/videos/work/launch-film.jpg" aria-hidden="true"><source src="/videos/work/launch-film.mp4" type="video/mp4" /></video>
    <div class="fp-copy">
      <p class="label">Resources / Film planner</p>
      <h1 id="pg-h" data-hero><span class="line"><span>Plan it</span></span><span class="line"><span>in one paste.</span></span></h1>
      <p class="lede">The seven questions I answer before I shoot anything. Copy the prompt, paste it into ChatGPT or Claude, and it interviews you.</p>
    </div>
  </section>
  <section class="fp light" aria-label="The framework">
    <ol class="fp-steps">{steps}</ol>
    <div class="fp-prompt"><p class="label">The prompt</p><div class="cb"><pre>{html_escape(prompt)}</pre><button type="button" class="cp" aria-label="Copy the prompt">Copy</button></div>
      <p class="note">This is how the <a href="/work/plugverse-launch-film">PlugVerse launch film</a> got planned.</p></div>
  </section>"""
    page("resources/film-plan", "Film planner", "Cooper Delo's seven-question film framework, as one prompt you paste into your AI.", body, css=("/assets/gear.css",))


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
        ("rig-prs", "PRS Custom 24-08", "The core one, not the SE. Big classic-rock leads.", amz("PRS Custom 24-08")),
        ("rig-takamine", "Takamine GN51CE", "Acoustic. Passive DI to the PA at gigs.", amz("Takamine GN51CE")),
        ("rig-bass", "Epiphone Embassy", "The green bass, for when I'm on bass.", amz("Epiphone Embassy Bass")),
    ]),
    ("Amps and effects", "amp", [
        ("rig-marshall", "Marshall DSL40CR", "Stealth Edition. All tubes. This is the tone.", amz("Marshall DSL40CR")),
        ("rig-pedals", "Line 6 Pod Go", "Pedals only. The amp block stays off.", amz("Line 6 Pod Go")),
        ("rig-amp", "Fender Rumble 500", "Bass combo.", amz("Fender Rumble 500")),
    ]),
    ("Camera", "camera", [
        ("camera", "Sony A7C II", "With the FE 16mm F1.8 G and the FE 24-50mm F2.8 G.", amz("Sony A7C II")),
        ("camera-vnd-filter", "K&F Concept 67mm VND", "7-click variable ND. On both lenses.", amz("K&F Concept 67mm variable ND")),
    ]),
    ("Studio", "studio", [
        ("studio-interface", "Focusrite Scarlett 2i2", "Interface.", amz("Focusrite Scarlett 2i2")),
        ("studio-mic", "sE Electronics sE2200", "Condenser. Vocals and voiceover.", amz("sE Electronics sE2200")),
        ("studio-headphones", "beyerdynamic DT 770 Pro X", "Headphones.", amz("beyerdynamic DT 770 Pro X")),
    ]),
]
ALSO = [("Shure SM58", amz("Shure SM58")), ("RØDE mic arm", amz("RODE PSA1+")), ("Sony FE 16mm F1.8 G", amz("Sony FE 16mm F1.8 G")), ("Sony FE 24-50mm F2.8 G", amz("Sony FE 24-50mm F2.8 G"))]


def gimg(key, alt, sizes="(max-width: 700px) 90vw, 30vw"):
    return f'<img src="/img/gear/{key}-900.webp" srcset="/img/gear/{key}-480.webp 480w, /img/gear/{key}-900.webp 900w" sizes="{sizes}" alt="{alt}" loading="lazy" decoding="async" />'


def gear():
    groups = []
    for cat, slug, items in GEAR:
        cards = "".join(f'''<li><a class="gi" href="{url}" target="_blank" rel="noreferrer sponsored">
          <span class="gi-img">{gimg(key, name)}</span>
          <span class="gi-cap"><b>{name}</b><span>{note}</span><span class="gi-buy label">Amazon {ARROW}</span></span></a></li>''' for key, name, note, url in items)
        groups.append(f'<section class="gg2 g-{slug}" data-rv><p class="label">{cat}</p><ul class="n{len(items)}">{cards}</ul></section>')
    also = " · ".join(f'<a href="{u}" target="_blank" rel="noreferrer sponsored">{n}</a>' for n, u in ALSO)
    body = f"""  <section class="gh dark" aria-labelledby="pg-h">
    <video class="gh-vid" muted loop playsinline autoplay preload="metadata" poster="/videos/work/gear-hero.jpg" aria-hidden="true">
      <source src="/videos/work/gear-hero.webm" type="video/webm" /><source src="/videos/work/gear-hero.mp4" type="video/mp4" /></video>
    <div class="gh-copy"><p class="label">Gear</p>
      <h1 id="pg-h" data-hero><span class="line"><span>What I</span></span><span class="line"><span>play through.</span></span></h1>
      <p class="lede">The rig behind Rubber Band, the camera behind the films, the desk I make it all at.</p></div>
  </section>
  <section class="chain2 dark" aria-labelledby="chain-h">
    <p class="label" id="chain-h">The live rig</p>
    <div class="c2">
      <figure><span>{gimg("tele", "Telecaster")}</span><figcaption><b>Tele or PRS</b></figcaption></figure>
      <i aria-hidden="true">{ARROW}</i>
      <figure><span>{gimg("rig-pedals", "Line 6 Pod Go")}</span><figcaption><b>Pod Go</b><span>EQ · Screamer · Chorus · Delay · Reverb. Amp block off.</span></figcaption></figure>
      <i aria-hidden="true">{ARROW}</i>
      <figure><span>{gimg("rig-marshall", "Marshall DSL40CR")}</span><figcaption><b>Marshall DSL40CR</b><span>The tube amp is the tone.</span></figcaption></figure>
    </div>
  </section>
  <section class="kit2 light" aria-label="Everything I use">
    {"".join(groups)}
    <section class="gg2 g-color" data-rv><p class="label">Color and edit</p>
      <div class="gc">
        <a class="gc-card" href="https://www.blackmagicdesign.com/products/davinciresolve" target="_blank" rel="noreferrer"><span class="gc-img"><img src="/videos/work/chapter-one.jpg" alt="A frame from Chapter One, graded in Resolve" loading="lazy" /></span><span class="gi-cap"><b>DaVinci Resolve Studio</b><span>Every film on this site is cut and graded here.</span><span class="gi-buy label">Blackmagic {ARROW}</span></span></a>
        <a class="gc-card" href="https://shop.gakuyen.com/products/odyssey-powergrade" target="_blank" rel="noreferrer"><span class="gc-img"><img src="/videos/work/the-start.jpg" alt="A frame from The Start" loading="lazy" /></span><span class="gi-cap"><b>Odyssey PowerGrade</b><span>Gaku's grade. One adjustment layer over the whole timeline.</span><span class="gi-buy label">shop.gakuyen.com {ARROW}</span></span></a>
      </div></section>
    <p class="g-also"><span class="label">Also on the desk</span> {also}</p>
    <p class="fine">Amazon links are searches for the exact model. <span class="draft">Draft</span> If they become affiliate links, this line will say so.</p>
  </section>"""
    page("gear", "Gear", "The guitars, amp, camera, studio gear and grade Cooper Delo actually uses.", body, css=("/assets/gear.css",))

if __name__ == "__main__":
    work_with_me()
    resources()
    film_plan()
    gear()
