# Builds index.html, /work/*.html and plugverse.html from one data table.
# Run: python scripts/build-work-pages.py   (no deps). Output is committed; the site has no build step.
# v2 (2026-09-29): no view counts or stats anywhere public. The footage is the argument.
import html, pathlib, json

ROOT = pathlib.Path(__file__).resolve().parent.parent
E = html.escape
EMAIL = "cooper@plugverse.app"
CAL = "https://cal.com/cooper-delo1"

MAN = json.loads((pathlib.Path(__file__).resolve().parent / "images.json").read_text())

def pic(key, alt="", sizes="100vw", eager=False, cls=""):
    m = MAN[key]; ws = m["w"]; W, H = m["ar"]
    ss = lambda ext: ", ".join(f"/img/{key}-{w}.{ext} {w}w" for w in ws)
    mid = next((w for w in ws if w >= 1280), ws[-1])
    load = 'fetchpriority="high" decoding="async"' if eager else 'loading="lazy" decoding="async"'
    c = f' class="{cls}"' if cls else ""
    return (f'<picture><source type="image/avif" srcset="{ss("avif")}" sizes="{sizes}" /><source type="image/webp" srcset="{ss("webp")}" sizes="{sizes}" />'
            f'<img{c} src="/img/{key}-{mid}.jpg" srcset="{ss("jpg")}" sizes="{sizes}" width="{W}" height="{H}" alt="{E(alt)}" {load} /></picture>')

ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
PLAY = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 1l11 6-11 6z" fill="currentColor"/></svg>'

WORK = [
  dict(slug="chapter-one", title="Chapter One", disc="Short film", year="2026", video="chapter-one", ar="16/9",
       full="chapter-one-full", full_ar="16/9", runtime="0:33",
       say="Junior year. Chapel Hill, NC.",
       credits=[("Role", "Director, editor"), ("Year", "2026"), ("Tools", "DaVinci Resolve Studio"),
                ("Link", [("Instagram", "https://www.instagram.com/p/DcM4LvpxbXi/"), ("TikTok", "https://www.tiktok.com/@cooperdelo/video/7675530318664731934")])],
       stills=[("w-ch1-belltower", "wide", "The bell tower"), ("w-ch1-street", "", "Franklin St."), ("w-ch1-house", "drop", "")]),
  dict(slug="plugverse-launch-film", title="PlugVerse launch film", disc="Short film", year="2026", video="launch-film", ar="16/9",
       full="launch-film-full", full_ar="16/9", runtime="1:00",
       say="My first short film, made for my startup's launch.",
       credits=[("Role", "Director, editor"), ("Year", "2026"), ("Tools", "DaVinci Resolve Studio, Fusion"),
                ("Link", [("Instagram", "https://www.instagram.com/p/Ddoy0gcTvp2/"), ("TikTok", "https://www.tiktok.com/@cooperdelo/video/7688777020007845151")])],
       stills=[("w-launch-film-1", "wide", "48 hours before"), ("w-launch-film-2", "", ""), ("w-launch-film-3", "drop", ""), ("w-launch-film-4", "wide", "")]),
  dict(slug="the-start", title="The Start", disc="Short film, opening", year="2026", video="the-start", ar="16/9",
       full="the-start-full", full_ar="16/9", runtime="0:20",
       say="I am terrified of starting.",
       credits=[("Role", "Director, editor"), ("Year", "2026"), ("Tools", "DaVinci Resolve Studio"),
                ("Link", [("Instagram", "https://www.instagram.com/p/Ddg7Hn2RAHP/"), ("TikTok", "https://www.tiktok.com/@cooperdelo/video/7687644625829498143")])],
       stills=[("w-afraid-s1", "", ""), ("w-afraid-s2", "drop", ""), ("w-afraid-s3", "", ""), ("w-afraid-s4", "drop", "")]),
  dict(slug="bioswap", title="Bioswap", disc="Motion design", year="2026", video="bioswap", ar="1/1",
       full="bioswap-full", full_ar="1/1", runtime="0:20",
       say="What's your rate?",
       credits=[("Role", "Motion design"), ("Year", "2026"), ("Tools", "Remotion, React"), ("Link", [("plugverse.app", "https://plugverse.app")])],
       stills=[("w-bioswap-1", "", ""), ("w-bioswap-2", "drop", ""), ("w-bioswap-3", "", ""), ("w-bioswap-4", "drop", "")], still_ar="1/1"),
  dict(slug="plugverse-product", title="PlugVerse product", disc="Product design, full stack", year="2025/26", video="pv-turntable", ar="1/1",
       say="Every show. One link.", product=True, hero_img="r-pv-hero",
       credits=[("Role", "Founder. Design, front end, back end"), ("Year", "Nov 2025 to now"),
                ("Tools", "Next.js, React, Supabase, Stripe Connect, Claude Code"),
                ("Link", [("plugverse.app", "https://plugverse.app"), ("The company", "/plugverse")])],
       stills=[]),
  dict(slug="rubber-band", title="Rubber Band", disc="Live, guitar", year="2025", video="rubber-band", ar="16/9",
       say="Chapel Hill cover band. I play guitar and run the bookings.",
       credits=[("Role", "Guitar, bookings"), ("Year", "2025 to now"), ("Gear", "PRS Custom 24-08, Telecaster, Pod Go"),
                ("Link", [("Band page", "/rubber-band"), ("Book the band", "https://plugverse.app/a/2499f269-dff2-4025-85a6-cf1ff8991382")])],
       stills=[("chiphi-solo", "wide", "Chi Phi, Chapel Hill"), ("bar-gig", "", "Might As Well"), ("chiphi-porch", "drop", "Chi Phi")]),
]

COMPANY = dict(slug="plugverse", path="/plugverse", no="", title="PlugVerse", disc="Company", year="2025/26", hero_img="w-pv-pitch",
       say="I built PlugVerse solo so a band can get booked from one link.",
       credits=[("Role", "Founder. Design and engineering"), ("Year", "Nov 2025 to now. Live 23 Sep 2026"),
                ("Tools", "Next.js, React, Supabase, Stripe Connect, Claude Code"),
                ("Link", [("plugverse.app", "https://plugverse.app"), ("Product", "/work/plugverse-product"), ("Launch film", "/work/plugverse-launch-film")])],
       stills=[("w-pv-luby", "", "Luby Pitch Competition"), ("r-pv-duo", "drop", "Calendar and contract, rendered from the live app"), ("r-pv-hero", "wide", "plugverse.app, rendered from the live app")])

HEAD_JS = "(function(d){var r=d.documentElement;try{if(sessionStorage.getItem('cd-intro'))r.classList.add('seen')}catch(e){}if(matchMedia('(prefers-reduced-motion: reduce)').matches)r.classList.add('rm')})(document)"

def head(title, desc, url, image="https://cooperdelo.com/img/hero-poster-1280.jpg", preload=""):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}" />
<meta name="theme-color" content="#16130F" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="manifest" href="/site.webmanifest" />
<meta property="og:title" content="{E(title)}" />
<meta property="og:description" content="{E(desc)}" />
<meta property="og:image" content="{image}" />
<meta property="og:url" content="{url}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="preload" href="/fonts/DrukWideBold.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/fonts/NimbusSans-Bold.woff2" as="font" type="font/woff2" crossorigin />{preload}
<link rel="stylesheet" href="/assets/site.css" />
<script>{HEAD_JS}</script>
</head>"""

def roll(t):
    t = E(t)
    return f'<span class="roll"><span>{t}</span><span aria-hidden="true">{t}</span></span>'

NAV = f"""<header class="nav label">
  <a class="mark" href="/" aria-label="Cooper Delo, home">{roll("Cooper Delo")}</a>
  <span class="where">Chapel Hill, NC&nbsp;&nbsp;<span data-clock>--:--</span> ET</span>
  <nav class="links" aria-label="Primary"><a href="/#work">{roll("Work")}</a><a href="/#about">{roll("About")}</a><a href="/#contact">{roll("Contact")}</a></nav>
</header>"""

SCRIPTS = """<script src="/assets/lenis.min.js" defer></script>
<script src="/assets/site.js" defer></script>"""

def footer(bg="chiphi-band"):
    return f"""<footer class="contact" id="contact">
  <div class="bg">{pic(bg, "", "100vw")}</div>
  <p class="label say">Say hi</p>
  <a class="mail" href="mailto:{EMAIL}" data-rv><span class="line"><span data-fit>{EMAIL}</span></span></a>
  <div class="cta">
    <a class="pill solid" href="{CAL}" target="_blank" rel="noreferrer">Book a call {ARROW}</a>
    <a class="pill" href="mailto:{EMAIL}">Email</a>
    <a class="pill" href="https://www.linkedin.com/in/cooperdelo/" target="_blank" rel="noreferrer">LinkedIn</a>
  </div>
  <div class="base label">
    <span>&copy; 2026 Cooper Delo</span>
    <nav aria-label="Elsewhere">
      <a href="/resume">Resume</a>
      <a href="https://instagram.com/cooperdelo" target="_blank" rel="noreferrer">Instagram</a>
      <a href="https://tiktok.com/@cooperdelo" target="_blank" rel="noreferrer">TikTok</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </nav>
  </div>
</footer>"""

def lines(t):
    return f'<span class="line"><span>{E(t)}</span></span>'

def still_src(n):
    return f"/photos/{n[3:]}.jpg" if n.startswith("../") else f"/photos/work/{n}.jpg"

def credits_table(w):
    rows = []
    for k, v in w["credits"]:
        if isinstance(v, list):
            cell = "<br />".join(f'<a href="{u}"{" target=&quot;_blank&quot; rel=&quot;noreferrer&quot;".replace("&quot;", chr(34)) if u.startswith("http") else ""}>{E(t)}</a>' for t, u in v)
        else:
            cell = E(v)
        rows.append(f'<tr><th scope="row">{E(k)}</th><td>{cell}</td></tr>')
    return f'<table class="credits" data-rv><caption class="sr">Credits</caption>{"".join(rows)}</table>'

def stills_block(w):
    figs = []
    ar = w.get("still_ar", "16/9").replace("/", " / ")
    for i, (n, cls, cap) in enumerate(w["stills"]):
        fl = ["float", "float b", "float c"][i % 3]
        c = f'<figcaption class="label">{E(cap)}</figcaption>' if cap else ""
        sz = "(max-width: 700px) 100vw, " + ("100vw" if cls == "wide" else "50vw")
        figs.append(f'<figure class="{cls}" data-rv style="--ar:{ar}"><div class="film clip {fl}">{pic(n, w["title"] + ", still " + str(i + 1), sz)}</div>{c}</figure>')
    return f'<section class="stills light" aria-label="Stills">{"".join(figs)}</section>' if figs else ""

def product_block():
    shots = [("r-pv-trio", "wide", "Dashboard, booking chat and landing on iPhone"), ("r-pv-macbook", "", "Rubber Band's booking page"),
             ("r-pv-duo", "drop", "Calendar and contract"), ("r-pv-mb-dash", "wide", "Artist dashboard")]
    figs = "".join(f'<figure class="{c}" data-rv style="--ar:{MAN[k]["ar"][0]} / {MAN[k]["ar"][1]}"><div class="film clip">{pic(k, cap, "(max-width: 700px) 100vw, " + ("100vw" if c == "wide" else "50vw"))}</div><figcaption class="label">{E(cap)}</figcaption></figure>' for k, c, cap in shots)
    turn = """<figure class="turn" data-rv><div class="film clip"><video data-lazy muted loop playsinline preload="none" poster="/videos/work/pv-turntable.jpg" aria-label="PlugVerse on iPhone, turntable"><source src="/videos/work/pv-turntable.webm" type="video/webm; codecs=av01.0.08M.08" /><source src="/videos/work/pv-turntable.mp4" type="video/mp4" /></video></div><figcaption class="label">Real screens, rendered in Blender</figcaption></figure>"""
    return f'<section class="renders dark" aria-label="Device renders">{figs}{turn}</section>'

def case(w, nxt, no):
    poster = f"/videos/work/{w.get('video')}.jpg"
    if w.get("hero_img"):
        k = w["hero_img"]
        media = f'<div class="media"><div class="zoom">{pic(k, w["title"], "(max-width: 700px) 180vh, 100vw" if w.get("product") else "100vw", eager=True)}</div></div>'
        poster = f"/img/{k}-1280.jpg"
    else:
        media = f'<div class="media"><div class="zoom"><video src="/videos/work/{w["video"]}.mp4" poster="{poster}" autoplay muted loop playsinline preload="auto" aria-label="{E(w["title"])}, loop"></video></div></div>'
        if w["ar"] in ("1/1", "9/16"):
            a, b = (int(x) for x in w["ar"].split("/"))
            media = f'''<div class="media contain" style="--ar:{w["ar"].replace("/", " / ")}; --arn:{a / b:.4f}">
      <div class="back"><img src="{poster}" alt="" /></div>
      <div class="front"><div class="zoom"><video src="/videos/work/{w["video"]}.mp4" poster="{poster}" autoplay muted loop playsinline preload="auto" aria-label="{E(w["title"])}, loop"></video></div></div>
    </div>'''
    watch = ""
    if w.get("full"):
        a, b = (int(x) for x in w["full_ar"].split("/"))
        shape = " square" if a == b else (" tall" if a < b else "")
        watch = f'''<section class="watch dark" aria-label="Watch">
    <div class="player{shape}" style="--ar:{a} / {b}; --arn:{a / b:.4f}" data-cursor="Play">
      <video src="/videos/work/{w["full"]}.mp4" poster="{poster}" playsinline preload="none" aria-label="{E(w["title"])}, full cut"></video>
      <button class="cover" type="button" aria-label="Play {E(w["title"])} with sound"><span class="btn">{PLAY} Play with sound</span></button>
    </div>
    <div class="under label"><span>{E(w["title"])}</span><span>{E(w.get("runtime", ""))}</span></div>
  </section>'''
    body = f'''<section class="case-body light">
    <p class="say" data-rv>{lines(w["say"])}</p>
    {credits_table(w)}
  </section>'''
    extra = product_block() if w.get("product") else ""
    nposter = f"/videos/work/{nxt['video']}.jpg"
    desc = f"{w['title']}. {w['disc']}, {w['year']}. By Cooper Delo."
    return f"""{head(w['title'] + ' / Cooper Delo', desc, 'https://cooperdelo.com' + w.get('path', '/work/' + w['slug']), 'https://cooperdelo.com' + poster)}
<body class="case">
{NAV}
<main>
  <section class="case-hero{' pv' if w.get('product') else ''}">
    {media}
    <div class="shade"></div>
    <div class="title-c" data-hero>
      <span class="label no">{no or '&nbsp;'}</span>
      <h1>{lines(w['title'])}</h1>
      <span class="label down">{E(w['disc'])}, {E(w['year'])}</span>
    </div>
  </section>
  {watch}
  {body}
  {extra}
  {stills_block(w)}
  <a class="next dark" href="/work/{nxt['slug']}" data-cursor="Next">
    <span class="label"><span>Next</span><span>{E(nxt['disc'])}</span></span>
    <span class="t">{E(nxt['title'])}</span>
    <span class="thumb film">{pic("p-" + nxt["video"], "", "(max-width: 800px) 100vw, 26vw")}</span>
  </a>
</main>
{footer()}
{SCRIPTS}
</body>
</html>
"""

def index_rows():
    out = []
    for i, w in enumerate(WORK):
        no = f"{i + 1:02d}"
        out.append(f"""      <li class="row" data-rv data-src="/videos/work/{w['video']}.mp4" data-poster="/videos/work/{w['video']}.jpg" data-ar="{w['ar']}">
        <a href="/work/{w['slug']}" data-handoff data-cursor="View">
          <span class="label no">{no}</span>
          <span class="t">{E(w['title'])}</span>
          <span class="poster film">{pic("p-" + w["video"], "", "(max-width: 900px) 100vw, 1px")}</span>
          <span class="meta-m"><span class="d">{E(w['disc'])}</span><span class="yr">{E(w['year'])}</span></span>
          <span class="go">{ARROW}{ARROW}</span>
        </a>
        <div class="rule"></div>
      </li>""")
    return "\n".join(out)

FRAMES = [("desk-guitar", "f1", "Writing, late", "0.10"), ("chiphi-solo", "f2", "Chi Phi", "-0.06"), ("desk-phone", "f3", "Booking the next one", "0.14"),
          ("belltower", "f4", "The bell tower", "-0.10"), ("bar-gig", "f5", "Might As Well", "0.06"), ("chiphi-steps", "f6", "Chi Phi house", "-0.14"),
          ("chiphi-porch", "f7", "Porch show, Rubber Band", "0.08")]

def frames_block():
    figs = "".join(f'<figure class="{c}" data-speed="{sp}" data-rv><div class="film clip">{pic(n, cap or "Cooper Delo", "(max-width: 800px) 70vw, 45vw")}</div>{f"""<figcaption class="label"><span>{E(cap)}</span><span>Chapel Hill</span></figcaption>""" if cap else ""}</figure>' for n, c, cap, sp in FRAMES)
    return figs

INDEX = """{HEAD}
<body class="home">
<div class="intro" aria-hidden="true">
  <div class="row label"><span>Cooper Delo</span><span>Loading frames</span></div>
  <div class="row"><div class="count">000</div><span class="label">Chapel Hill, NC</span></div>
</div>
{NAV}
<main>
  <section class="title">
    <div class="bg">
      <picture><source media="(max-width: 700px)" type="image/avif" srcset="/img/hero-poster-m-720.avif" /><source media="(max-width: 700px)" srcset="/img/hero-poster-m-720.jpg" /><source type="image/avif" srcset="/img/hero-poster-1280.avif 1280w, /img/hero-poster-1920.avif 1920w" sizes="100vw" /><img src="/img/hero-poster-1920.jpg" srcset="/img/hero-poster-1280.jpg 1280w, /img/hero-poster-1920.jpg 1920w" sizes="100vw" width="1920" height="1080" alt="Cooper Delo on Franklin Street, Chapel Hill" fetchpriority="high" decoding="async" /></picture>
      <video class="hero-vid" muted loop playsinline autoplay preload="auto" data-d="/videos/hero/hero-1920" data-m="/videos/hero/hero-720x1280" aria-hidden="true"></video>
    </div>
    <div class="copy">
      <h1 data-hero><span class="line"><span>Founder of PlugVerse.</span></span><span class="line"><span>I make films, motion</span></span><span class="line"><span>and product.</span></span><span class="line"><span>CS + Business, UNC.</span></span></h1>
      <div class="meta"><a class="pill" href="#work">See the work {ARROW}</a><a class="pill" href="{CAL}" target="_blank" rel="noreferrer">Book a call</a></div>
    </div>
    <div class="foot">
      <div class="bar label"><span>35.913N 79.056W</span><span>Chapel Hill, NC</span></div>
      <p class="wordmark" data-hero aria-label="Cooper Delo">
        <span class="d line"><span data-fit>Cooper Delo</span></span>
        <span class="m line"><span data-fit="m">Cooper</span></span><span class="m line"><span data-fit="m">Delo</span></span>
      </p>
    </div>
  </section>

  <section class="index light" id="work" aria-label="Work">
    <div class="top" data-rv><h2>{L1}</h2><span class="label">(0{COUNT})</span></div>
    <div class="head label"><span>No.</span><span>Title</span><span>Discipline</span><span class="r">Year</span><span></span></div>
    <div class="rule" data-rv></div>
    <ol class="rows" data-index>
{ROWS}
    </ol>
  </section>

  <section class="frames dark" aria-label="Chapel Hill, in frames">
    <p class="big" data-rv>{L2}{L3}</p>
    <div class="grid">{FRAMES}</div>
  </section>

  <section class="about light" id="about" aria-label="About">
    <div class="pic" data-rv><div class="film clip float b">{ABOUTPIC}</div></div>
    <div class="txt">
      <div class="intro-t" data-rv>
        <p class="label">About</p>
        <h2 class="about-h"><span class="line"><span>I'm Cooper.</span></span></h2>
        <p class="lede">Junior at UNC Chapel Hill, studying CS and Business. I built PlugVerse on my own, play guitar in Rubber Band and shoot and cut my own films.</p>
      </div>
      <ul class="facts" data-rv>
        <li><span class="label">01</span><span>Built PlugVerse solo. Live since 23 Sep 2026.</span></li>
        <li><span class="label">02</span><span>Guitar in Rubber Band. I run the bookings too.</span></li>
        <li><span class="label">03</span><span>I shoot and cut my own films in DaVinci Resolve.</span></li>
        <li><span class="label">04</span><span>UNC Chapel Hill, class of 2028. CS and Business.</span></li>
      </ul>
      <div class="out">
        <a class="pill" href="/resume">Resume</a>
        <a class="pill" href="{CAL}" target="_blank" rel="noreferrer">Book a call</a>
        <a class="pill" href="https://www.linkedin.com/in/cooperdelo/" target="_blank" rel="noreferrer">LinkedIn</a>
        <a class="pill" href="https://instagram.com/cooperdelo" target="_blank" rel="noreferrer">Instagram</a>
        <a class="pill" href="https://tiktok.com/@cooperdelo" target="_blank" rel="noreferrer">TikTok</a>
      </div>
    </div>
  </section>
</main>
{FOOTER}
{SCRIPTS}
</body>
</html>
"""


# ---------------- resume (facts: vault Projects/portfolio-website/resume.md + Cooper_Delo_Resume_2026.pdf) ----------------
RESUME_ROLES = [
  ("Truist Financial", "Technology and Innovation Intern, Leadership Development Program", "Charlotte, NC", "Summer 2026", [
      "Selected for Truist's 2026 T&I LDP.",
      "Shipping product improvements in collaboration with senior engineers and PMs."], None),
  ("PlugVerse", "Founder and CEO", "Chapel Hill, NC", "Nov 2025 to now", [
      "Founded PlugVerse LLC. Sole developer of a full-stack artist and venue booking marketplace.",
      "Built on Next.js, React, Supabase and Stripe Connect. 8 user roles, 48-suite QA pipeline.",
      "Won the $20K Luby Pitch Competition and a $1,850 1789 grant. Managing a 4-person intern team."], "/work/plugverse-product"),
  ("UNC Kenan-Flagler Business School", "AI Research and Product Assistant", "Chapel Hill, NC", "Jul 2025 to Dec 2025", [
      "Built an AI resume generator deployed to all incoming Kenan-Flagler students. Demoed to the Associate Dean."], None),
  ("CleverCX", "Product Management Intern, early-stage fintech startup", "Charlotte, NC", "May 2025 to Aug 2025", [
      "Reported 300+ Jira issues, improving QA coverage across 4 user roles.",
      "Tracked 500+ support cases in an Excel dashboard. Worked with 10+ engineers and PMs."], None),
  ("Global Career Accelerator", "Data Analyst Trainee", "Chapel Hill, NC", "May 2025 to Jul 2025", [
      "Analyzed a 600K+ row Intel dataset in Python and SQL. Completed 20+ analytics assignments."], None),
]
RESUME_PROJECTS = [
  ("Rubber Band", "Guitarist and business manager", "Chapel Hill, NC", "Jul 2025 to now", [
      "Guitar and vocals for UNC's top event cover band.",
      "Manage all contracts, venue negotiations and pricing. $50K+ in cumulative bookings."], "/work/rubber-band"),
  ("Carolina Data Challenge 2025", "Data Analyst", "Chapel Hill, NC", "Sep 2025", [
      "Modeled risk for the $500B space economy. Presented an investment matrix to industry judges."], None),
]

def resume_rows(items, start):
    out = []
    for i, (org, role, where, when, bullets, link) in enumerate(items):
        li = "".join(f"<li>{E(b)}</li>" for b in bullets)
        more = f'<a class="more label" href="{link}">See the work {ARROW}</a>' if link else ""
        out.append(f"""<li class="rrow" data-rv>
      <span class="label no">{start + i:02d}</span>
      <div class="org"><h3>{E(org)}</h3><p class="role">{E(role)}</p></div>
      <div class="det"><p class="label when">{E(when)}<span>{E(where)}</span></p><ul>{li}</ul>{more}</div>
    </li>""")
    return "".join(out)

def resume_page():
    table = [("School", "UNC Chapel Hill, Kenan-Flagler Business School"),
             ("Degrees", "BSBA, Business Administration. BA, Computer Science, second major"),
             ("Class", "May 2028"), ("GPA", "3.867. Dean's List, Fall 2024 and Spring 2025")]
    skills = [("Code", "JavaScript, TypeScript, React, Next.js, Node.js, Python, SQL, Java"),
              ("Stack", "Supabase, PostgreSQL, Stripe API, Vercel, GitHub, PostHog, Azure, Claude AI and API"),
              ("Tools", "Jira, Miro"),
              ("Clubs", "1789 Venture Lab, Finance Society, Busi-Tech Club, Consulting Club, UNC Habitat for Humanity"),
              ("Certs", "SQL and Python Specialist (UNC GCA), Powering Medicine (NC State)"),
              ("Into", "Cybersecurity, AI, golf, music production, guitar")]
    tr = lambda rows: "".join(f'<tr><th scope="row">{E(k)}</th><td>{E(v)}</td></tr>' for k, v in rows)
    return f"""{head("Resume / Cooper Delo", "Cooper Delo. Founder of PlugVerse. CS and Business at UNC Chapel Hill.", "https://cooperdelo.com/resume")}
<body class="resume">
{NAV}
<main>
  <section class="r-hero dark">
    <div class="r-pic film">{pic("chiphi-solo-2", "Cooper Delo playing guitar at Chi Phi", "(max-width: 800px) 100vw, 55vw", eager=True)}</div>
    <div class="r-copy" data-hero>
      <p class="label">Resume, 2026</p>
      <h1>{lines("Cooper")}{lines("Delo")}</h1>
      <p class="r-sub">Founder of PlugVerse. CS and Business at UNC Chapel Hill.</p>
      <div class="r-cta"><a class="pill solid" href="/Cooper_Delo_Resume_2026.pdf" download>Download PDF {ARROW}</a><a class="pill" href="{CAL}" target="_blank" rel="noreferrer">Book a call</a><a class="pill" href="mailto:{EMAIL}">Email</a></div>
    </div>
  </section>
  <section class="r-edu light" aria-label="Education">
    <h2 class="r-h" data-rv>{lines("Education")}</h2>
    <table class="credits" data-rv>{tr(table)}</table>
  </section>
  <section class="r-list light" aria-label="Experience">
    <h2 class="r-h" data-rv>{lines("Experience")}</h2>
    <ol class="rrows">{resume_rows(RESUME_ROLES, 1)}</ol>
  </section>
  <section class="r-strip dark" aria-label="Photos">
    <figure class="film">{pic("desk-guitar", "Cooper at his desk with a guitar", "(max-width: 700px) 100vw, 33vw")}</figure>
    <figure class="film">{pic("bar-gig", "Cooper at Might As Well", "(max-width: 700px) 100vw, 33vw")}</figure>
    <figure class="film">{pic("w-pv-luby", "Luby Pitch Competition", "(max-width: 700px) 100vw, 33vw")}</figure>
  </section>
  <section class="r-list light" aria-label="Projects and leadership">
    <h2 class="r-h" data-rv>{lines("Projects")}</h2>
    <ol class="rrows">{resume_rows(RESUME_PROJECTS, len(RESUME_ROLES) + 1)}</ol>
  </section>
  <section class="r-edu light" aria-label="Skills">
    <h2 class="r-h" data-rv>{lines("Skills")}</h2>
    <table class="credits" data-rv>{tr(skills)}</table>
  </section>
</main>
{footer()}
{SCRIPTS}
</body>
</html>
"""

if __name__ == "__main__":
    for i, w in enumerate(WORK):
        (ROOT / "work" / f"{w['slug']}.html").write_text(case(w, WORK[(i + 1) % len(WORK)], f"{i + 1:02d}"), encoding="utf-8")
    (ROOT / "plugverse.html").write_text(case(COMPANY, WORK[4], ""), encoding="utf-8")
    (ROOT / "resume.html").write_text(resume_page(), encoding="utf-8")
    HP = """
<link rel="preload" as="image" type="image/avif" media="(min-width: 701px)" imagesrcset="/img/hero-poster-1280.avif 1280w, /img/hero-poster-1920.avif 1920w" imagesizes="100vw" fetchpriority="high" />
<link rel="preload" as="image" type="image/avif" media="(max-width: 700px)" href="/img/hero-poster-m-720.avif" fetchpriority="high" />"""
    page = (INDEX.replace("{HEAD}", head("Cooper Delo", "Founder of PlugVerse. Films, motion and product. CS and Business at UNC Chapel Hill.", "https://cooperdelo.com", preload=HP))
            .replace("{NAV}", NAV).replace("{ROWS}", index_rows()).replace("{COUNT}", str(len(WORK)))
            .replace("{L1}", lines("Selected work")).replace("{L2}", lines("Chapel Hill,")).replace("{L3}", lines("in frames"))
            .replace("{FRAMES}", frames_block()).replace("{FOOTER}", footer("chiphi-porch")).replace("{ABOUTPIC}", pic("lawn", "Cooper Delo on the lawn at dusk", "(max-width: 900px) 100vw, 40vw")).replace("{SCRIPTS}", SCRIPTS)
            .replace("{CAL}", CAL).replace("{ARROW}", ARROW))
    (ROOT / "index.html").write_text(page, encoding="utf-8")
    urls = ["/", "/resume", "/plugverse", "/rubber-band", "/privacy", "/terms"] + [f"/work/{w['slug']}" for w in WORK]
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(f"  <url><loc>https://cooperdelo.com{u}</loc></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8")
    print("built", len(WORK), "pieces + index + plugverse + sitemap")
