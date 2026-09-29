# Builds index.html, /work/*.html and plugverse.html from one data table.
# Run: python scripts/build-work-pages.py   (no deps). Output is committed; the site has no build step.
# v2 (2026-09-29): no view counts or stats anywhere public. The footage is the argument.
import html, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
E = html.escape
EMAIL = "cooper@plugverse.app"
CAL = "https://cal.com/cooper-delo1"

ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
PLAY = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 1l11 6-11 6z" fill="currentColor"/></svg>'

WORK = [
  dict(slug="chapter-one", title="Chapter One", disc="Short film", year="2026", video="chapter-one", ar="16/9",
       full="chapter-one-full", full_ar="16/9", runtime="0:33",
       say="Junior year. Chapel Hill, NC.",
       credits=[("Role", "Director, editor"), ("Year", "2026"), ("Tools", "DaVinci Resolve Studio"),
                ("Link", [("Instagram", "https://www.instagram.com/p/DcM4LvpxbXi/"), ("TikTok", "https://www.tiktok.com/@cooperdelo/video/7675530318664731934")])],
       stills=[("ch1-belltower", "wide", "The bell tower"), ("ch1-selfie", "", ""), ("ch1-street", "drop", "Franklin St."), ("ch1-house", "wide", "")]),
  dict(slug="plugverse-launch-film", title="PlugVerse launch film", disc="Short film", year="2026", video="launch-film", ar="16/9",
       full="launch-film-full", full_ar="16/9", runtime="1:00",
       say="My first short film, made for my startup's launch.",
       credits=[("Role", "Director, editor"), ("Year", "2026"), ("Tools", "DaVinci Resolve Studio, Fusion"),
                ("Link", [("Instagram", "https://www.instagram.com/p/Ddoy0gcTvp2/"), ("TikTok", "https://www.tiktok.com/@cooperdelo/video/7688777020007845151")])],
       stills=[("launch-film-1", "wide", "48 hours before"), ("launch-film-2", "", ""), ("launch-film-3", "drop", ""), ("launch-film-4", "wide", "")]),
  dict(slug="the-start", title="The Start", disc="Short film, opening", year="2026", video="the-start", ar="16/9",
       full="the-start-full", full_ar="16/9", runtime="0:20",
       say="I am terrified of starting.",
       credits=[("Role", "Director, editor"), ("Year", "2026"), ("Tools", "DaVinci Resolve Studio"),
                ("Link", [("Instagram", "https://www.instagram.com/p/Ddg7Hn2RAHP/"), ("TikTok", "https://www.tiktok.com/@cooperdelo/video/7687644625829498143")])],
       stills=[("afraid-s1", "", ""), ("afraid-s2", "drop", ""), ("afraid-s3", "", ""), ("afraid-s4", "drop", "")]),
  dict(slug="bioswap", title="Bioswap", disc="Motion design", year="2026", video="bioswap", ar="1/1",
       full="bioswap-full", full_ar="1/1", runtime="0:20",
       say="What's your rate?",
       credits=[("Role", "Motion design"), ("Year", "2026"), ("Tools", "Remotion, React"), ("Link", [("plugverse.app", "https://plugverse.app")])],
       stills=[("bioswap-1", "", ""), ("bioswap-2", "drop", ""), ("bioswap-3", "", ""), ("bioswap-4", "drop", "")], still_ar="1/1"),
  dict(slug="plugverse-product", title="PlugVerse product", disc="Product design, full stack", year="2025/26", video="plugverse-product", ar="16/9",
       say="Every show. One link.", product=True,
       credits=[("Role", "Founder. Design, front end, back end"), ("Year", "Nov 2025 to now"),
                ("Tools", "Next.js, React, Supabase, Stripe Connect, Claude Code"),
                ("Link", [("plugverse.app", "https://plugverse.app"), ("The company", "/plugverse")])],
       stills=[("pv-landing", "wide", "Landing"), ("pv-public-rubberband", "", "Band page"), ("pv-tonight", "drop", "Tonight"), ("pv-pricing", "wide", "Pricing")]),
  dict(slug="rubber-band", title="Rubber Band", disc="Live, guitar", year="2025", video="rubber-band", ar="16/9",
       say="Chapel Hill cover band. I play guitar and run the bookings.",
       credits=[("Role", "Guitar, bookings"), ("Year", "2025 to now"), ("Gear", "PRS Custom 24-08, Telecaster, Pod Go"),
                ("Link", [("Band page", "/rubber-band"), ("Book the band", "https://plugverse.app/a/2499f269-dff2-4025-85a6-cf1ff8991382")])],
       stills=[("../v2/houseshow-band", "wide", "House show"), ("../v2/bar-gig", "", "Might As Well"), ("../v2/stage-pink", "drop", ""), ("../v2/lawn-gig", "wide", "Lawn show")]),
]

COMPANY = dict(slug="plugverse", path="/plugverse", no="", title="PlugVerse", disc="Company", year="2025/26", img="pv-pitch",
       say="I built PlugVerse solo so a band can get booked from one link.",
       credits=[("Role", "Founder. Design and engineering"), ("Year", "Nov 2025 to now. Live 23 Sep 2026"),
                ("Tools", "Next.js, React, Supabase, Stripe Connect, Claude Code"),
                ("Link", [("plugverse.app", "https://plugverse.app"), ("Product", "/work/plugverse-product"), ("Launch film", "/work/plugverse-launch-film")])],
       stills=[("pv-luby", "", "Luby Pitch Competition"), ("pv-merch", "drop", "Merch"), ("pv-landing", "wide", "plugverse.app")])

HEAD_JS = "(function(d){var r=d.documentElement;try{if(sessionStorage.getItem('cd-intro'))r.classList.add('seen')}catch(e){}if(matchMedia('(prefers-reduced-motion: reduce)').matches)r.classList.add('rm')})(document)"

def head(title, desc, url, image="https://cooperdelo.com/photos/v2/title-campus.jpg"):
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
<link rel="preload" href="/fonts/NimbusSans-Bold.woff2" as="font" type="font/woff2" crossorigin />
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

def footer(bg="/photos/v2/stage-pink.jpg"):
    return f"""<footer class="contact" id="contact">
  <div class="bg"><img src="{bg}" alt="" loading="lazy" decoding="async" /></div>
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
        figs.append(f'<figure class="{cls}" data-rv style="--ar:{ar}"><div class="film clip {fl}"><img src="{still_src(n)}" alt="{E(w["title"])}, still {i + 1}" loading="lazy" decoding="async" /></div>{c}</figure>')
    return f'<section class="stills light" aria-label="Stills">{"".join(figs)}</section>'

def product_block():
    beats = [("dashboard", "Dashboard"), ("booking-hub", "Booking hub"), ("bookings", "Bookings"), ("calendar", "Calendar"), ("artist-page", "Band page"), ("setlists", "Setlists")]
    s = "".join(f'<figure data-rv><div class="film clip"><video data-src="/videos/work/pv-{b}.mp4" poster="/videos/work/pv-{b}.jpg" muted loop playsinline preload="none" aria-label="{E(c)}, screen in motion"></video></div><figcaption class="label">{E(c)}</figcaption></figure>' for b, c in beats)
    phones = [("pv-native-dashboard", "Dashboard, iOS"), ("pv-native-booking-link", "Booking link, iOS"), ("pv-native-contracts", "Contracts, iOS")]
    p = "".join(f'<figure data-rv><div class="film clip"><img src="/photos/work/{n}.jpg" alt="{E(c)}" loading="lazy" decoding="async" /></div><figcaption class="label">{E(c)}</figcaption></figure>' for n, c in phones)
    return f'<section class="screens dark" aria-label="Screens in motion">{s}</section><section class="phones dark" aria-label="Native app">{p}</section>'

def case(w, nxt, no):
    poster = f"/videos/work/{w.get('video')}.jpg"
    if w.get("img"):
        media = f'<div class="media"><div class="zoom"><img src="/photos/work/{w["img"]}.jpg" alt="{E(w["title"])}" fetchpriority="high" /></div></div>'
        poster = f"/photos/work/{w['img']}.jpg"
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
      <video src="/videos/work/{w["full"]}.mp4" poster="{poster}" playsinline preload="metadata" aria-label="{E(w["title"])}, full cut"></video>
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
  <section class="case-hero">
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
    <span class="thumb film"><img src="{nposter}" alt="" loading="lazy" decoding="async" /></span>
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
          <span class="poster film"><img src="/videos/work/{w['video']}.jpg" alt="" loading="lazy" decoding="async" /></span>
          <span class="meta-m"><span class="d">{E(w['disc'])}</span><span class="yr">{E(w['year'])}</span></span>
          <span class="go">{ARROW}{ARROW}</span>
        </a>
        <div class="rule"></div>
      </li>""")
    return "\n".join(out)

FRAMES = [("franklin-walk", "f1", "Franklin St.", "0.10"), ("houseshow-band", "f2", "House show", "-0.06"), ("golden", "f3", "", "0.14"),
          ("belltower", "f4", "The bell tower", "-0.10"), ("bar-gig", "f5", "Might As Well", "0.06"), ("chiphi", "f6", "Chi Phi", "-0.14"),
          ("title-franklin", "f7", "", "0.12"), ("quad", "f8", "Campus", "-0.05")]

def frames_block():
    figs = "".join(f'<figure class="{c}" data-speed="{sp}" data-rv><div class="film clip"><img src="/photos/v2/{n}.jpg" alt="{E(cap) or "Still from Cooper Delo footage"}" loading="lazy" decoding="async" /></div>{f"""<figcaption class="label"><span>{E(cap)}</span><span>Chapel Hill</span></figcaption>""" if cap else ""}</figure>' for n, c, cap, sp in FRAMES)
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
    <div class="bg"><img src="/photos/v2/title-campus.jpg" alt="Cooper Delo on campus in Chapel Hill" fetchpriority="high" /></div>
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
    <div class="pic" data-rv><div class="film clip float b"><img src="/photos/v2/title-franklin-b.jpg" alt="Cooper Delo on Franklin Street" loading="lazy" decoding="async" /></div></div>
    <div>
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

if __name__ == "__main__":
    for i, w in enumerate(WORK):
        (ROOT / "work" / f"{w['slug']}.html").write_text(case(w, WORK[(i + 1) % len(WORK)], f"{i + 1:02d}"), encoding="utf-8")
    (ROOT / "plugverse.html").write_text(case(COMPANY, WORK[4], ""), encoding="utf-8")
    page = (INDEX.replace("{HEAD}", head("Cooper Delo", "Founder of PlugVerse. Films, motion and product. CS and Business at UNC Chapel Hill.", "https://cooperdelo.com"))
            .replace("{NAV}", NAV).replace("{ROWS}", index_rows()).replace("{COUNT}", str(len(WORK)))
            .replace("{L1}", lines("Selected work")).replace("{L2}", lines("Chapel Hill,")).replace("{L3}", lines("in frames"))
            .replace("{FRAMES}", frames_block()).replace("{FOOTER}", footer("/photos/v2/lawn-gig.jpg")).replace("{SCRIPTS}", SCRIPTS)
            .replace("{CAL}", CAL).replace("{ARROW}", ARROW))
    (ROOT / "index.html").write_text(page, encoding="utf-8")
    urls = ["/", "/resume", "/plugverse", "/rubber-band", "/privacy", "/terms"] + [f"/work/{w['slug']}" for w in WORK]
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(f"  <url><loc>https://cooperdelo.com{u}</loc></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8")
    print("built", len(WORK), "pieces + index + plugverse + sitemap")
