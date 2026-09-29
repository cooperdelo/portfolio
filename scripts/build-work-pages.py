# Generates index.html's work list and /work/*.html case studies from one data table.
# Run: python scripts/build-work-pages.py   (no deps). Output is committed; the site has no build step.
# Numbers: v_social_posts_latest (Supabase eibtnkaoqsgwiqttiwjo), as of 2026-09-29. Update AS_OF + figures together.
import html, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
AS_OF = "29 SEP 2026"
E = html.escape

WORK = [
  dict(slug="plugverse-launch-film", no="01", title="PlugVerse launch film", disc="Short film", year="2026",
       video="launch-film", ar="16/9", fit="cover",
       say="i spent 12 hours editing the launch video.",
       say_src=("LinkedIn @cooperdelo, 28 Sep 2026", "https://www.linkedin.com/posts/cooperdelo_buildinpublic-activity-7510394147330060289-9pcU"),
       credits=[("Role", "Director, editor"), ("Year", "2026. Released 23 Sep"), ("Tools", "DaVinci Resolve Studio, Fusion"),
                ("Link", [("Instagram @plugverse.app", "https://www.instagram.com/p/Ddoy0gcTvp2/"), ("TikTok @cooperdelo", "https://www.tiktok.com/@cooperdelo/video/7688777020007845151")])],
       stats=[("8,896", "Views", "Instagram @plugverse.app"), ("1,745", "Views", "TikTok @cooperdelo"), ("140", "Views", "TikTok @plugverse.app")],
       watch=[("Watch on Instagram", "https://www.instagram.com/p/Ddoy0gcTvp2/"), ("Watch on TikTok", "https://www.tiktok.com/@cooperdelo/video/7688777020007845151")],
       stills=[("launch-film-1", "full", "48 hours before"), ("launch-film-2", "l7", ""), ("launch-film-3", "r5", ""), ("launch-film-4", "mid", "")]),
  dict(slug="time-to-change-my-life", no="02", title="Time to change my life fr", disc="Short film", year="2026",
       video="afraid-to-start", ar="16/9", fit="cover",
       say="I am terrified of starting.", say_src=None, grid="two",
       credits=[("Role", "Director, editor"), ("Year", "2026. Released 20 Sep"), ("Tools", "DaVinci Resolve Studio"),
                ("Link", [("Instagram @cooperdelo", "https://www.instagram.com/p/Ddg7Hn2RAHP/"), ("TikTok @cooperdelo", "https://www.tiktok.com/@cooperdelo/video/7687644625829498143")])],
       stats=[("7,024", "Views", "Instagram @cooperdelo"), ("2,446", "Views", "TikTok @cooperdelo"), ("234", "Likes", "Instagram @cooperdelo"), ("221", "Likes", "TikTok @cooperdelo")],
       watch=[("Watch on Instagram", "https://www.instagram.com/p/Ddg7Hn2RAHP/"), ("Watch on TikTok", "https://www.tiktok.com/@cooperdelo/video/7687644625829498143")],
       stills=[("afraid-s1", "c6", ""), ("afraid-s2", "c6", ""), ("afraid-s3", "c6", ""), ("afraid-s4", "c6", "")]),
  dict(slug="plugverse-teaser", no="03", title="PlugVerse teaser", disc="Teaser, vertical", year="2026",
       video="teaser", ar="9/16", fit="contain",
       say="9/23. 1 PM EST.", say_src=("Caption, Instagram @plugverse.app, 23 Sep 2026", "https://www.instagram.com/p/DdnEQgqTlEv/"),
       credits=[("Role", "Director, editor"), ("Year", "2026. Released 23 Sep"), ("Tools", "DaVinci Resolve Studio"),
                ("Link", [("Instagram @plugverse.app", "https://www.instagram.com/p/DdnEQgqTlEv/")])],
       stats=[("776", "Views", "Instagram @plugverse.app"), ("58", "Likes", "Instagram @plugverse.app"), ("12", "Comments", "Instagram @plugverse.app")],
       watch=[("Watch on Instagram", "https://www.instagram.com/p/DdnEQgqTlEv/")],
       stills=[("teaser-1", "c4", ""), ("teaser-2", "c4", ""), ("teaser-3", "c4", "Live 9/23")]),
  dict(slug="bioswap", no="04", title="Bioswap", disc="Motion graphics", year="2026",
       video="bioswap", ar="1/1", fit="contain",
       say="What's your rate?", say_src=None,
       credits=[("Role", "Motion design"), ("Year", "2026"), ("Tools", "Remotion, React"),
                ("Link", "Not posted yet, as of " + AS_OF.title())],
       stats=[], watch=[],
       stills=[("bioswap-1", "c6", ""), ("bioswap-2", "c6", ""), ("bioswap-3", "c6", ""), ("bioswap-4", "c6", "")]),
  dict(slug="plugverse-product", no="05", title="PlugVerse product", disc="UI/UX, full stack", year="2025/26",
       video="plugverse-product", ar="1512/897", fit="cover",
       say="Every show. One link.", say_src=("Landing page, plugverse.app", "https://plugverse.app"),
       credits=[("Role", "Founder. Design, front end, back end"), ("Year", "Nov 2025 to now. Live 23 Sep 2026"),
                ("Tools", "Next.js, React, Supabase, Stripe Connect, Claude Code"),
                ("Link", [("plugverse.app", "https://plugverse.app"), ("The company", "/plugverse")])],
       stats=[], watch=[("Open plugverse.app", "https://plugverse.app")],
       stills=[("pv-landing", "full", "Landing"), ("pv-tonight", "l7", "Tonight"), ("pv-native-dashboard", "r5", "Dashboard, iOS"),
               ("pv-public-rubberband", "full", "Rubber Band's booking page"), ("pv-search", "l7", "Discover"),
               ("pv-native-contracts", "r5", "Contracts, iOS"), ("pv-pricing", "full", "Pricing")]),
]

COMPANY = dict(slug="plugverse", path="/plugverse", no="", title="PlugVerse", disc="Company", year="2025/26",
       img="pv-pitch", fit="cover",
       say="I built PlugVerse solo so a band can get booked from one link.", say_src=None, grid="two",
       credits=[("Role", "Founder, sole member. Design and engineering"), ("Year", "Nov 2025 to now. Live 23 Sep 2026"),
                ("Tools", "Next.js, React, Supabase, Stripe Connect, Claude Code"),
                ("Link", [("plugverse.app", "https://plugverse.app"), ("Product case study", "/work/plugverse-product"), ("Launch film", "/work/plugverse-launch-film")])],
       stats=[("$20,000", "Luby Pitch prize, won", "Admin funding ledger, active 31 Jul 2026"),
              ("$1,850", "1789 Venture Fund grant", "Admin funding ledger, received 26 Mar 2026"),
              ("0%", "Equity given", "Sole member, NC SOS record 15 Apr 2026")],
       watch=[("Open plugverse.app", "https://plugverse.app")],
       stills=[("pv-luby", "c6", "Luby Pitch Competition"), ("pv-merch", "c6", "Merch"),
               ("pv-landing", "c6", "plugverse.app"), ("pv-tonight", "c6", "Tonight")])

HEAD_JS = "(function(d){var r=d.documentElement;try{if(sessionStorage.getItem('cd-intro'))r.classList.add('seen')}catch(e){}if(matchMedia('(prefers-reduced-motion: reduce)').matches)r.classList.add('rm')})(document)"

def head(title, desc, url, image="https://cooperdelo.com/photos/og-cover.png"):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}" />
<meta name="theme-color" content="#0A0A0A" />
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

def roll(text):
    t = E(text)
    return f'<span class="roll"><span>{t}</span><span aria-hidden="true">{t}</span></span>'

NAV = f"""<header class="nav label">
  <a class="mark" href="/" aria-label="Cooper Delo, home">{roll("Cooper Delo")}</a>
  <span class="where">Chapel Hill, NC&nbsp;&nbsp;<span data-clock>--:--</span> ET</span>
  <nav class="links" aria-label="Primary"><a href="/#index">{roll("Index")}</a><a href="/#about">{roll("About")}</a><a href="/#contact">{roll("Contact")}</a></nav>
</header>"""

SCRIPTS = """<script src="/assets/lenis.min.js" defer></script>
<script src="/assets/site.js" defer></script>"""

EMAIL = "cooperdelo6@gmail.com"

def footer():
    return f"""<footer class="contact" id="contact">
  <p class="label say">Say hi</p>
  <a class="mail" href="mailto:{EMAIL}" data-rv><span class="line"><span data-fit>{EMAIL}</span></span></a>
  <div class="base label">
    <span>&copy; 2026 Cooper Delo</span>
    <nav aria-label="Elsewhere">
      <a href="/resume">Resume</a>
      <a href="https://www.linkedin.com/in/cooperdelo/" target="_blank" rel="noreferrer">LinkedIn</a>
      <a href="https://instagram.com/cooperdelo" target="_blank" rel="noreferrer">Instagram</a>
      <a href="https://tiktok.com/@cooperdelo" target="_blank" rel="noreferrer">TikTok</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </nav>
  </div>
</footer>"""

def lines(text):
    return "".join(f'<span class="line"><span>{E(w)}</span></span>' for w in text)

def case(w, nxt):
    vid = f"/videos/work/{w.get('video')}.mp4"
    poster = f"/videos/work/{w.get('video')}.jpg"
    if w.get("img"):
        media = f"""<div class="media"><div class="zoom"><img src="/photos/work/{w['img']}.jpg" alt="{E(w['title'])}" fetchpriority="high" /></div></div>"""
        poster = f"/photos/work/{w['img']}.jpg"
    elif w["fit"] == "contain":
        a, b = (int(x) for x in w["ar"].split("/"))
        media = f"""<div class="media contain" style="--ar:{w['ar'].replace('/', ' / ')}; --arn:{a / b:.4f}">
      <div class="back"><img src="{poster}" alt="" /></div>
      <div class="front"><div class="zoom"><video src="{vid}" poster="{poster}" autoplay muted loop playsinline preload="auto" aria-label="{E(w['title'])}, loop"></video></div></div>
    </div>"""
    else:
        media = f"""<div class="media"><div class="zoom"><video src="{vid}" poster="{poster}" autoplay muted loop playsinline preload="auto" aria-label="{E(w['title'])}, loop"></video></div></div>"""
    rows = []
    for k, v in w["credits"]:
        if isinstance(v, list):
            cell = "<br />".join(f'<a href="{u}"{" target=\"_blank\" rel=\"noreferrer\"" if u.startswith("http") else ""}>{E(t)}</a>' for t, u in v)
        else:
            cell = E(v)
        rows.append(f"<tr><th scope=\"row\">{E(k)}</th><td>{cell}</td></tr>")
    src = ""
    if w.get("say_src"):
        src_t, src_u = w["say_src"]
        inner = f'<a href="{src_u}" target="_blank" rel="noreferrer">{E(src_t)}</a>' if src_u else E(src_t)
        src = f'<span class="label dim src">{inner}</span>'
    stats = ""
    if w["stats"]:
        cells = "".join(f"""<div class="stat" data-rv><div class="v" data-odo="{E(v)}">{E(v)}</div><p class="label k">{E(k)}</p><p class="label s">{E(s)}</p></div>""" for v, k, s in w["stats"])
        stats = f"""<section class="stats" aria-label="Numbers">
  <div class="grid" style="--cols:{min(len(w['stats']), 4)}; --n:{max(len(x[0]) for x in w['stats'])}">{cells}</div>
  <p class="label note">{E(w.get('note', 'As of ' + AS_OF + '.'))}</p>
</section>"""
    watch = ""
    if w["watch"]:
        watch = '<div class="watch">' + "".join(f'<a class="pill" href="{u}" target="_blank" rel="noreferrer">{E(t)} &#8599;</a>' for t, u in w["watch"]) + "</div>"
    figs = []
    for i, (img, cls, cap) in enumerate(w["stills"]):
        fl = ["float", "float b", "float c"][i % 3]
        capt = f'<figcaption class="label">{E(cap)}</figcaption>' if cap else ""
        figs.append(f'<figure class="{cls}" data-rv><div class="clip {fl}"><img src="/photos/work/{img}.jpg" alt="{E(w["title"])}, still {i+1}" loading="lazy" decoding="async" /></div>{capt}</figure>')
    desc = f"{w['title']}. {w['disc']}, {w['year']}. By Cooper Delo."
    return f"""{head(w['title'] + ' / Cooper Delo', desc, 'https://cooperdelo.com' + w.get('path', '/work/' + w['slug']), 'https://cooperdelo.com' + poster)}
<body class="case">
{NAV}
<main>
  <section class="case-hero">
    {media}
    <div class="shade"></div>
    <div class="title" data-hero>
      <span class="label no">{w['no'] or '&nbsp;'}</span>
      <h1>{lines([w['title']])}</h1>
    </div>
  </section>

  <section class="case-body">
    <p class="say" data-rv>{lines([w['say']])}{src}</p>
    <table class="credits" data-rv>
      <caption class="sr">Credits</caption>
      {''.join(rows)}
    </table>
  </section>

  {stats}
  {watch}

  <section class="stills{' two' if w.get('grid') == 'two' else ''}" aria-label="Stills">
    {''.join(figs)}
  </section>

  <a class="next" href="/work/{nxt['slug']}">
    <span class="label"><span>Next</span><span>{nxt['no']}</span></span>
    <span class="t">{E(nxt['title'])}</span>
  </a>
</main>
{footer()}
{SCRIPTS}
</body>
</html>
"""

def index_rows():
    out = []
    for w in WORK:
        ar = w["ar"]
        a, b = (int(x) for x in ar.split("/"))
        tall = " tall" if a < b else ""
        out.append(f"""      <li class="row" data-rv data-src="/videos/work/{w['video']}.mp4" data-poster="/videos/work/{w['video']}.jpg" data-ar="{ar}">
        <a href="/work/{w['slug']}" data-handoff>
          <span class="label no">{w['no']}</span>
          <span class="t">{E(w['title'])}</span>
          <span class="poster{tall}" style="--ar:{ar.replace('/', ' / ')}"><img src="/videos/work/{w['video']}.jpg" alt="" loading="lazy" decoding="async" /></span>
          <span class="d">{E(w['disc'])}</span>
          <span class="yr">{E(w['year'])}</span>
        </a>
        <div class="rule"></div>
      </li>""")
    out.append("""      <li class="row" data-rv data-src="/videos/work/rubber-band.mp4" data-poster="/videos/work/rubber-band.jpg" data-ar="16/9">
        <a href="/rubber-band" data-handoff>
          <span class="label no">06</span>
          <span class="t">Rubber Band</span>
          <span class="poster" style="--ar:16 / 9"><img src="/videos/work/rubber-band.jpg" alt="" loading="lazy" decoding="async" /></span>
          <span class="d">Guitar, bookings</span>
          <span class="yr">2025</span>
        </a>
        <div class="rule"></div>
      </li>""")
    return "\n".join(out)

if __name__ == "__main__":
    for i, w in enumerate(WORK):
        (ROOT / "work" / f"{w['slug']}.html").write_text(case(w, WORK[(i + 1) % len(WORK)]), encoding="utf-8")
    (ROOT / "plugverse.html").write_text(case(COMPANY, WORK[4]), encoding="utf-8")
    tpl = (ROOT / "scripts" / "index.template.html").read_text(encoding="utf-8")
    page = (tpl.replace("{{HEAD}}", head("Cooper Delo", "Founder of PlugVerse. Films, motion and product UI. CS and Business at UNC Chapel Hill.", "https://cooperdelo.com"))
               .replace("{{NAV}}", NAV).replace("{{ROWS}}", index_rows()).replace("{{COUNT}}", f"{len(WORK) + 1:02d}")
               .replace("{{FOOTER}}", footer()).replace("{{SCRIPTS}}", SCRIPTS))
    (ROOT / "index.html").write_text(page, encoding="utf-8")
    print("built", len(WORK), "case studies + index")
