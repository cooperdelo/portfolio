"""Build /work-with-me, /resources and /resources/film-plan with the site's own head, nav and footer.

    python scripts/build-together-pages.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
CAL = "https://cal.com/cooper-delo1"
PV = "https://plugverse.app/?utm_source=cooperdelo&utm_medium=portfolio&utm_campaign=artist_workflow"


def page(path, title, desc, body, og="https://cooperdelo.com/img/poster-montage-1920-3a4824-1280.jpg"):
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
<link rel="stylesheet" href="/assets/together.css" />
<script>(function(d){{var r=d.documentElement;try{{if(sessionStorage.getItem('cd-intro'))r.classList.add('seen')}}catch(e){{}}if(matchMedia('(prefers-reduced-motion: reduce)').matches)r.classList.add('rm')}})(document)</script>
</head>
<body class="page">
<header class="nav label">
  <a class="mark" href="/" aria-label="Cooper Delo, home"><span class="roll"><span>Cooper Delo</span><span aria-hidden="true">Cooper Delo</span></span></a>
  <span class="where">Chapel Hill, NC&nbsp;&nbsp;<span data-clock>--:--</span> ET</span>
  <nav class="links" aria-label="Primary"><a href="/#work"><span class="roll"><span>Work</span><span aria-hidden="true">Work</span></span></a><a href="/#about"><span class="roll"><span>About</span><span aria-hidden="true">About</span></span></a><a href="/#contact"><span class="roll"><span>Contact</span><span aria-hidden="true">Contact</span></span></a></nav>
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
      <a href="https://instagram.com/cooperdelo" target="_blank" rel="noreferrer">Instagram</a>
      <a href="https://tiktok.com/@cooperdelo" target="_blank" rel="noreferrer">TikTok</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </nav>
  </div>
</footer>
<script src="/assets/lenis.min.js" defer></script>
<script src="/assets/site.js" defer></script>
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
    qs = "".join(f"""
      <section class="q"><div><h2>{h}</h2><label for="{n}">{l}</label><div class="field"><textarea id="{n}" name="{n}" maxlength="5000" rows="3"></textarea></div></div></section>"""
                 for h, l, n in PROMPTS)
    body = f"""  <section class="pg-hero light" aria-labelledby="pg-h">
    <p class="label">Resources / Film planner</p>
    <h1 id="pg-h" data-hero><span class="line"><span>Get it out</span></span><span class="line"><span>of your head.</span></span></h1>
    <p class="lede">The questions I answer before I shoot anything. Fill in what matters, download it, and go shoot.</p>
    <p class="lede">No account and no email. Your notes stay in this browser.</p>
  </section>
  <section class="planner light" aria-label="Planner">
    <form data-planner>{qs}
    </form>
    <aside>
      <div class="acts"><button class="pill" type="button" data-plan-download>Download my plan</button><button class="pill" type="button" data-plan-print>Print</button></div>
      <p class="note" data-plan-status role="status">Saved in this browser only.</p>
      <p class="note">Want to see where this goes? <a href="/work/plugverse-launch-film">Watch the launch film</a>.</p>
    </aside>
  </section>"""
    page("resources/film-plan", "Film planner", "Plan your next film: the questions Cooper Delo answers before he shoots anything.", body)


if __name__ == "__main__":
    work_with_me()
    resources()
    film_plan()
