"""Homepage pieces that sit between the generated sections: the Bioswap motion breakdown
and the rendered On Repeat shelf. Imported by build-work-pages.py via runpy."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "render"))
from vinyl_albums import ALBUMS  # noqa: E402

ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'

DUR = 18.6
BEATS = [
    (0.0, 2.6, "0:00", "It starts in the DMs.",
     "What's your rate? Can you do a three hour set? Have you played around here before? That's what comes in when you run a band's bookings, so that's where it opens."),
    (2.6, 4.6, "0:03", "The camera never cuts.",
     "The questions pull into the band's profile in one move. There are no hard cuts and no fades anywhere in the piece. The camera just keeps going."),
    (4.6, 7.4, "0:05", "The bio swap.",
     "“DM for bookings” turns into a PlugVerse link. That's the whole idea of the piece, so it gets its own beat."),
    (7.4, 14.6, "0:08", "Everything floats, then lands.",
     "Music, past shows, availability, gear. Each card drifts in on glass and settles soft, like gel, instead of snapping into place."),
    (14.6, 18.6, "0:15", "End on the thing you'd tap.",
     "It finishes on Request dates, then the URL. The only sounds are textures, no musical notes, so nothing fights the interface."),
]


def motion(in_case=False):
    ticks = "".join(f'<i style="--t:{a / DUR:.4f}"></i>' for a, *_ in BEATS)
    lis = "".join(f"""
        <li data-t="{a}" data-end="{e}"><button class="mo-beat" type="button"><span class="label">{tc}</span><span class="h">{h}</span><span class="d">{t}</span></button></li>"""
                  for a, e, tc, h, t in BEATS)
    return f"""<section class="motion dark" id="motion" aria-labelledby="motion-h" data-motion data-duration="{DUR}">
    <div class="mo-top">
      <p class="label">Motion design</p>
      <h2 class="mo-big" id="motion-h" data-rv><span class="line"><span>One camera.</span></span><span class="line"><span>No cuts.</span></span></h2>
      <p class="mo-lede" data-rv>Bioswap is a 19 second piece I built in code for PlugVerse. Here's how it moves, one beat at a time.</p>
    </div>
    <div class="mo-body">
      <div class="mo-stage">
        <div class="mo-plate"><img src="/videos/work/bioswap-final.jpg" width="960" height="960" alt="Bioswap, a motion piece for PlugVerse" loading="lazy" decoding="async" /><video muted playsinline preload="none" aria-hidden="true" data-d="/videos/motion/bioswap-scrub-960" data-m="/videos/motion/bioswap-scrub-720"></video></div>
        <div class="mo-meter"><div class="mo-rail" aria-hidden="true"><span class="mo-fill"></span>{ticks}</div><div class="mo-time label"><span data-tc>0:00</span><span>0:19</span></div></div>
      </div>
      <ol class="mo-beats">{lis}
      </ol>
    </div>
    <div class="mo-foot">
      <p class="label credit">Remotion and React, finished in DaVinci Resolve</p>
      <p class="kit">I'm pulling the camera rig and the glass cards out into a starter you can drop into your own Remotion project. <strong>It isn't ready yet.</strong> If you want it when it is, email me and I'll send it over.</p>
      <div class="acts">{"" if in_case else f'<a class="pill" href="/work/bioswap" data-handoff>Watch it with sound {ARROW}</a>'}<a class="pill" href="mailto:cooper@plugverse.app?subject=Motion%20starter">I want the starter</a></div>
    </div>
  </section>"""


def records():
    items = []
    for a in ALBUMS:  # not a ranking, so no numbers
        s = a["slug"]
        own = a.get("own")
        if own:  # Cooper's 2024 EP stays off the homepage (ruling 2026-10-03)
            continue
        items.append(
            f'<li class="rx{" mine" if own else ""}" data-slug="{s}" data-title="{a["title"]}">'
            f'<button class="rx-hit" type="button" aria-haspopup="dialog" aria-label="Open {a["title"]}, {a["artist"]}, {a["year"]}">'
            f'<span class="rx-art">{"<span class=rx-sticker>Mine</span>" if own else ""}<span class="rx-disc">'
            f'<img class="rx-label" src="/img/records/label-{s}.webp" width="200" height="200" alt="" loading="lazy" decoding="async" />'
            f'<img class="rx-vinyl" src="/img/records/record-640.webp" srcset="/img/records/record-640.webp 640w, /img/records/record-960.webp 960w" sizes="(max-width: 700px) 60vw, 360px" width="640" height="640" alt="" loading="lazy" decoding="async" />'
            f'</span><img class="rx-sleeve" src="/img/records/sleeve-{s}-640.webp" srcset="/img/records/sleeve-{s}-640.webp 640w, /img/records/sleeve-{s}-960.webp 960w" sizes="(max-width: 700px) 60vw, 360px" width="640" height="640" alt="" loading="lazy" decoding="async" /></span>'
            f'<span class="rx-cap"><b>{a["title"]}</b><span>{a["artist"]}, {a["year"]}</span></span></button></li>')
    # A moving belt (ref: marquee that slows on hover). The set is drawn twice so it loops without a seam;
    # the copy is hidden from screen readers and keyboard.
    copy = [i.replace('<li class="rx', '<li aria-hidden="true" class="rx', 1).replace('<button class="rx-hit" type="button"', '<button class="rx-hit" type="button" tabindex="-1"', 1) for i in items]
    return f"""<section class="records dark" aria-labelledby="rx-h">
    <div class="rx-head"><p class="label" id="rx-h">On repeat</p><p class="rx-sub">A few records I come back to. <span class="rx-tag">Pick one</span></p></div>
    <div class="rx-belt" data-records><ol class="rx-track">
      {(chr(10) + "      ").join(items + copy)}
    </ol></div>
  </section>"""


# ---------------------------------------------------------------- showcase: one screen, four tabs, one best piece each
SHOW = [
    {"tab": "Storytelling", "title": "Chapter One", "line": "Junior year, in 33 seconds.", "stat": "0:33 · 2026",
     "cta": ("Watch it", "/work/chapter-one"), "video": "chapter-one", "ar": "16/9"},
    {"tab": "Motion", "title": "Bioswap", "line": "One camera, no cuts. Built in code.", "stat": "Remotion, React, Resolve",
     "cta": ("See how it moves", "/work/bioswap"), "video": "bioswap-final", "ar": "1/1", "webm": True},
    {"tab": "Product", "title": "PlugVerse", "line": "I built it solo, then made the film that launched it.", "stat": "Live since Sep 23, 2026",
     "cta": ("See PlugVerse", "/work/plugverse-product"), "video": "launch-film", "ar": "16/9"},
    {"tab": "Systems", "title": "My AI system", "line": "One folder every Claude reads, so it already knows my work.", "stat": "Built PlugVerse with it: 5,314 commits",
     "cta": ("See how it works", "/work/ai-system"), "video": None},
]
ALL_WORK = [("My AI system", "/work/ai-system"), ("Chapter One", "/work/chapter-one"), ("PlugVerse launch film", "/work/plugverse-launch-film"), ("The Start", "/work/the-start"),
            ("Bioswap", "/work/bioswap"), ("PlugVerse product", "/work/plugverse-product"), ("Rubber Band", "/work/rubber-band")]


def systems_diagram():
    # Counts checked against the vault on Oct 2, 2026: Decisions/ dated files, Context/auto-memory/,
    # TASK-ROSTER.md recurring tasks switched on, CLAUDE.md Hard Rules.
    agents = "".join(f'<span class="ag" style="--d:{i * 0.6}s">{n}</span>' for i, n in enumerate(["Claude Code", "Cowork", "claude.ai", "Jev"]))
    facts = "".join(f'<li><b>{v}</b><span>{k}</span></li>' for v, k in [("50", "decisions"), ("162", "memories"), ("45", "scheduled tasks"), ("28", "rules")])
    return f'''<div class="sys" aria-label="Claude Code, Cowork, claude.ai and Jev all read one vault of files">
        <div class="agents">{agents}</div>
        <svg class="wires" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M2 8 C 40 8, 45 30, 62 30"/><path d="M2 23 C 40 23, 45 30, 62 30"/><path d="M2 37 C 40 37, 45 30, 62 30"/><path d="M2 52 C 40 52, 45 30, 62 30"/></svg>
        <div class="vault"><p class="label">The vault</p><ul>{facts}</ul><p class="loop label">Every chat ends by saving what it learned</p></div>
      </div>'''


def showcase():
    tabs = "".join(
        f'<button type="button" role="tab" id="sc-t{i}" aria-controls="sc-p{i}" aria-selected="{str(i == 0).lower()}" tabindex="{0 if i == 0 else -1}"><span class="n">0{i + 1}</span><span class="nm">{s["tab"]}</span><i aria-hidden="true"></i></button>'
        for i, s in enumerate(SHOW))
    copy = "".join(
        f'''<div class="sc-copy" role="tabpanel" id="sc-p{i}" aria-labelledby="sc-t{i}"{"" if i == 0 else " hidden"}>
          <h2 class="sc-title">{s["title"]}</h2><p class="sc-line">{s["line"]}</p><p class="label sc-stat">{s["stat"]}</p>
          <a class="pill" href="{s["cta"][1]}">{s["cta"][0]} {ARROW}</a></div>''' for i, s in enumerate(SHOW))
    media = []
    for i, s in enumerate(SHOW):
        if s["video"]:
            v = s["video"]
            src = f'data-webm="/videos/work/{v}.webm" ' if s.get("webm") else ""
            inner = (f'<img class="bg" src="/videos/work/{v}.jpg" alt="" loading="lazy" decoding="async" />' if s["ar"] == "1/1" else "") + \
                    f'<video muted loop playsinline preload="none" poster="/videos/work/{v}.jpg" data-src="/videos/work/{v}.mp4" {src}aria-hidden="true" class="{"sq" if s["ar"] == "1/1" else ""}"></video>'
        else:
            inner = systems_diagram()
        media.append(f'<div class="sc-media{" on" if i == 0 else ""}" data-i="{i}">{inner}</div>')
    allw = " ".join(f'<a href="{u}">{t}</a>' for t, u in ALL_WORK)
    return f"""<section class="sc light" id="work" aria-label="Selected work" data-showcase>
    <div class="sc-top"><p class="label">Selected work</p><div class="sc-tabs" role="tablist" aria-label="Selected work">{tabs}</div></div>
    <div class="sc-stage">
      <div class="sc-copies">{copy}</div>
      <div class="sc-plate">{"".join(media)}</div>
    </div>
    <p class="sc-all label"><a class="sc-allk" href="/work">All work</a> {allw}</p>
  </section>"""


def strip(frames_html):
    """Chapel Hill, in frames, as one slow moving strip (the images come from the generator's frames block)."""
    return f"""<div class="strip" aria-label="Chapel Hill, in frames">
      <p class="label strip-l">Chapel Hill, in frames</p>
      <div class="strip-track"><div class="strip-set">{frames_html}</div><div class="strip-set" aria-hidden="true">{frames_html}</div></div>
    </div>"""


# ---------------------------------------------------------------- free things, right after the work
TAKE = [("Gear", "Everything I shoot, play and record with.", "/gear", "The rig"),
        ("Film planner", "The questions I answer before I shoot anything.", "/resources/film-plan", "Free, no email"),
        ("Work with me", "Films, motion and product. Tell me what you're building.", "/work-with-me", "Hire me")]

def take():
    cards = "".join(f'''<li><a class="tk" href="{u}"><span class="label">{tag}</span><b>{t}</b><span>{d}</span><span class="go">{ARROW}</span></a></li>''' for t, d, u, tag in TAKE)
    return f"""<section class="take light" aria-labelledby="tk-h">
    <div class="tk-head"><p class="label" id="tk-h">Resources</p><p>Free things I actually use. <a href="/resources">See all {ARROW}</a></p></div>
    <ol class="tk-grid">{cards}</ol>
  </section>"""


# ---------------------------------------------------------------- the homepage, as the hero promised it:
# "I make films, motion and product." Four chapters prove it, the same four words everywhere: Films, Motion,
# Product, Music. Systems is how the product got built, so it lives inside Product. The records live in Music.
CH = [("films", "01", "Films"), ("motion", "02", "Motion"), ("product", "03", "Product"), ("music", "04", "Music")]
CH_THUMB = {"films": "/videos/work/chapter-one.jpg", "motion": "/videos/work/bioswap-final.jpg", "product": "/videos/work/pv-turntable.jpg", "music": "/img/chapters/stage-color-720.webp"}


def _vid(name, ar, webm=False, cls=""):
    w = f' data-webm="/videos/work/{name}.webm"' if webm else ""
    return (f'<video class="cv {cls}" muted loop playsinline preload="none" poster="/videos/work/{name}.jpg" '
            f'data-src="/videos/work/{name}.mp4"{w} aria-hidden="true" style="aspect-ratio:{ar}"></video>')


def _pic(key, alt, sizes="(max-width: 900px) 100vw, 50vw", cls=""):
    return (f'<picture class="{cls}"><source type="image/webp" srcset="/img/chapters/{key}-720.webp 720w, /img/chapters/{key}-1440.webp 1440w" sizes="{sizes}" />'
            f'<img src="/img/chapters/{key}-1440.jpg" alt="{alt}" loading="lazy" decoding="async" /></picture>')


def _head(key, no, name, line):
    return f'''<header class="ch-head"><p class="ch-no label">{no}</p><h2 class="ch-name" data-rv><span class="line"><span>{name}</span></span></h2><p class="ch-line">{line}</p></header>'''


def chapter_index():
    items = "".join(f'<li><a href="#{k}"><span class="ci-thumb" style="background-image:url({CH_THUMB[k]})" aria-hidden="true"></span><span class="label">{no}</span><b>{n}</b></a></li>' for k, no, n in CH)
    return f'<nav class="ch-index light" aria-label="What I make"><ol>{items}</ol></nav>'


def chapter_films():
    tile = lambda slug, vid, title, say, meta, cls: f'''<a class="ct {cls}" href="/work/{slug}" data-handoff>
          <span class="ct-media">{_vid(vid, "16/9")}</span>
          <span class="ct-cap"><b>{title}</b><span>{say}</span><span class="label">{meta}</span></span></a>'''
    return f'''<section class="ch ch-films light" id="films" aria-labelledby="films-h">
    {_head("films", "01", "Films", "Short films I shoot and cut myself.").replace('class="ch-name"', 'class="ch-name" id="films-h"')}
    <div class="ct-grid">
      {tile("chapter-one", "chapter-one", "Chapter One", "Junior year, in 33 seconds.", "0:33 · 2026", "big")}
      {tile("the-start", "the-start", "The Start", "I am terrified of starting.", "0:20 · 2026", "")}
      {tile("plugverse-launch-film", "launch-film", "PlugVerse launch film", "My first short film, made for my startup's launch.", "1:00 · 2026", "")}
    </div>
  </section>'''


def chapter_motion():
    return f'''<section class="ch ch-motion dark" id="motion" aria-labelledby="motion-h">
    {_head("motion", "02", "Motion", "Made in code. One camera, no cuts.").replace('class="ch-name"', 'class="ch-name" id="motion-h"')}
    <div class="cm">
      <a class="cm-plate" href="/work/bioswap" data-handoff><img class="cm-bg" src="/videos/work/bioswap-final.jpg" alt="" aria-hidden="true" />{_vid("bioswap-final", "1/1", webm=True)}</a>
      <div class="cm-copy">
        <p class="label">Bioswap · 0:19</p>
        <h3>"What's your rate?"</h3>
        <p>A band's bio swaps into a booking page without a single cut. Built in Remotion and React, finished in DaVinci Resolve.</p>
        <div class="acts"><a class="pill" href="/work/bioswap" data-handoff>See how it moves {ARROW}</a></div>
      </div>
    </div>
  </section>'''


def chapter_product(diagram):
    return f'''<section class="ch ch-product light" id="product" aria-labelledby="product-h">
    {_head("product", "03", "Product", "I built PlugVerse by myself. Every show, one link.").replace('class="ch-name"', 'class="ch-name" id="product-h"')}
    <div class="cp-grid">
      <a class="ct cp-turn" href="/work/plugverse-product" data-handoff><span class="ct-media">{_vid("pv-turntable", "1/1", webm=True)}</span><span class="ct-cap"><b>PlugVerse</b><span>Design, front end, back end. All of it.</span></span></a>
      <a class="ct cp-wide" href="/work/plugverse-product" data-handoff><span class="ct-media">{_vid("plugverse-product", "16/9")}</span><span class="ct-cap"><b>The product</b><span>The screens are from the live app.</span></span></a>
      <ul class="cp-facts"><li><b>Solo</b><span class="label">built by me</span></li><li><b>Sep 23</b><span class="label">live since, 2026</span></li><li><b>5,314</b><span class="label">commits</span></li></ul>
    </div>
    <div class="cp-how">
      <div class="cp-how-copy"><p class="label">How I built it</p><h3>One folder every Claude reads.</h3><p>Built from this room. Every session starts already knowing my work, and ends by saving what it learned.</p>
        <div class="acts"><a class="pill" href="/work/ai-system">See the system {ARROW}</a><a class="pill" href="/plugverse">The company</a></div></div>
      <div class="cp-how-plate">{_vid("ai-hero", "16/9", webm=True)}</div>
    </div>
  </section>'''


def chapter_music(records_html):
    return f'''<section class="ch ch-music dark" id="music" aria-labelledby="music-h">
    <div class="cmu-hero">{_pic("stage-color", "Rubber Band on a packed stage", "100vw")}
      {_head("music", "04", "Music", "Guitar in Rubber Band. I run the bookings too.").replace('class="ch-name"', 'class="ch-name" id="music-h"')}
    </div>
    <div class="cmu-grid">
      <a class="ct" href="/work/rubber-band" data-handoff><span class="ct-media">{_vid("rubber-band", "16/9")}</span><span class="ct-cap"><b>Rubber Band, live</b><span>Chapel Hill cover band.</span></span></a>
      <a class="ct cmu-ep" href="https://open.spotify.com/album/5kVO52fF80upZVRJlc84SO" target="_blank" rel="noreferrer"><span class="ct-media">{_pic("ep", "Flicker of Time EP cover", "(max-width: 900px) 50vw, 25vw")}</span><span class="ct-cap"><b>Flicker of Time</b><span>My EP. Listen on Spotify.</span></span></a>
      <figure class="ct cmu-bass"><span class="ct-media">{_pic("bass", "Cooper playing bass", "(max-width: 900px) 50vw, 25vw")}</span></figure>
    </div>
    {records_html}
  </section>'''


TAKE2 = [("Gear", "Everything I shoot, play and record with.", "/gear", "The rig", "desk", "Cooper at his desk"),
         ("Film planner", "The questions I answer before I shoot anything.", "/resources/film-plan", "Free, no email", "film-still", "A still from the PlugVerse launch film")]


def take2():
    cards = "".join(f'''<li><a class="tk2" href="{u}"><span class="tk2-media">{_pic(img, alt, "(max-width: 900px) 100vw, 50vw")}</span><span class="tk2-cap"><span class="label">{tag}</span><b>{t}</b><span>{d}</span></span><span class="go">{ARROW}</span></a></li>''' for t, d, u, tag, img, alt in TAKE2)
    return f"""<section class="take2 light" aria-labelledby="tk-h">
    <div class="tk-head"><p class="label" id="tk-h">Resources</p><p>Free things I actually use. <a href="/resources">See all {ARROW}</a></p></div>
    <ol class="tk2-grid">{cards}</ol>
  </section>"""


def chapters(records_html, diagram):
    return "\n  ".join([chapter_index(), chapter_films(), chapter_motion(), chapter_product(diagram), chapter_music(records_html), take2()])


# ---------------------------------------------------------------- four doors (plan 2026-10-03): Work, Resources, Shop, Contact
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parent))
from site_data import PILLARS, WORK_CARDS, RESOURCES, RES, ACCESS, res_img, PICKER, tag  # noqa: E402


def _work_media(kind, val):
    if kind == "video":
        webm = f' data-webm="/videos/work/{val}.webm"' if val in ("bioswap-final", "pv-turntable") else ""
        return (f'<img class="wk-poster" src="/videos/work/{val}.jpg" alt="" loading="lazy" decoding="async" />'
                f'<video class="wk-vid" muted loop playsinline preload="none" data-src="/videos/work/{val}.mp4"{webm} aria-hidden="true"></video>')
    return f'<img class="wk-poster" src="{val}" alt="" loading="lazy" decoding="async" />'


# The homepage shows one piece per thing Cooper does, in one screen. Everything else lives on /work.
HOME_WORK = ("chapter-one", "plugverse-product", "the-start", "rubber-band")


def work_grid(heading=True, limit=None, home=False):
    """Selected work, Gaku-style: tall cards, video on hover. /work gets filter chips by pillar; the homepage gets four."""
    names = dict(PILLARS)
    cards = []
    items = [w for s in HOME_WORK for w in WORK_CARDS if w[0] == s] if home else WORK_CARDS[:limit]
    for slug, title, pillar, line, year, href, (kind, val), how in items:
        ext = href.startswith("http")
        cards.append(f'''<li data-pillar="{pillar}"><a class="wk" href="{href}"{' target="_blank" rel="noreferrer"' if ext else " data-handoff"}>
        <span class="wk-media">{_work_media(kind, val)}</span>
        <span class="wk-chip label">{names[pillar]}</span>
        <span class="wk-cap"><b>{title}</b><span>{line}</span><span class="label">{year} {ARROW}</span></span></a></li>''')
    if home:
        return f'''<section class="wkg wkg-home light" id="work" aria-labelledby="wk-h">
    <div class="wk-head"><h2 class="wk-h" id="wk-h" data-rv><span class="line"><span>Selected work</span></span></h2>
      <a class="wk-all label" href="/work">All work {ARROW}</a></div>
    <ol class="wk-grid">{"".join(cards)}</ol>
  </section>'''
    chips = '<button type="button" class="on" data-f="all">All</button>' + "".join(f'<button type="button" data-f="{k}">{n}</button>' for k, n in PILLARS)
    head = f'''<div class="wk-head"><h2 class="wk-h" data-rv><span class="line"><span>Selected work</span></span></h2>
      <div class="wk-chips label" role="group" aria-label="Filter work">{chips}</div></div>''' if heading else f'<div class="wk-head"><div class="wk-chips label" role="group" aria-label="Filter work">{chips}</div></div>'
    return f'''<section class="wkg light" id="work" aria-label="Selected work" data-workgrid>
    {head}
    <ol class="wk-grid">{"".join(cards)}</ol>
  </section>'''


def res_bento(heading=True, limit=None, exclude=()):
    """Resources as a bento of real covers (ref: Interactive Bento Gallery)."""
    items = [r for r in RESOURCES if r[0] not in exclude][:limit]
    cards = "".join(f'''<li class="rb-{i}"><a class="rb" href="{href}">{res_img(key)}
        <span class="rb-cap"><span class="label">{ACCESS[acc]}</span><b>{title}</b><span>{line}</span></span><span class="rb-go">{ARROW}</span></a></li>'''
                    for i, (slug, title, line, key, href, acc) in enumerate(items))
    head = f'''<div class="rb-head"><h2 data-rv><span class="line"><span>Resources</span></span></h2>
      <p>How I actually make things. Copy what helps, skip what doesn't. <a href="/resources">See all {ARROW}</a></p></div>''' if heading else ""
    return f'''<section class="rbs light" aria-label="Resources">
    {head}
    <ol class="rb-grid{" n" + str(len(items)) if limit else ""}">{cards}</ol>
  </section>'''


def start_here():
    """Homepage Resources, led by a picker: what are you trying to do -> the one resource for it.
    Everything the picker doesn't name sits under it as one compact line."""
    rows = "".join(f'''<li><a class="pk" href="{RES[s][4]}" data-from="picker" data-to="{s}">
        <span class="label pk-no">{i + 1:02d}</span><span class="pk-img">{res_img(RES[s][3], "", "(max-width: 900px) 72px, 160px")}</span>
        <span class="pk-cap"><b>{ask}</b><span>{RES[s][2]}</span></span><span class="label pk-tag">{tag(s)}</span><span class="pk-go">{ARROW}</span></a></li>'''
                   for i, (s, ask) in enumerate(PICKER))
    named = {s for s, _ in PICKER}
    rest = "".join(f'<li><a href="{r[4]}" data-from="picker_all" data-to="{r[0]}">{r[1]}</a></li>' for r in RESOURCES if r[0] not in named)
    return f'''<section class="rbs pks light" id="start" aria-labelledby="pk-h">
    <div class="rb-head pk-head"><div><p class="label">Start here · Free playbooks</p><h2 id="pk-h" data-rv><span class="line"><span>What are you</span></span><span class="line"><span>trying to do?</span></span></h2></div>
      <p>Pick one. Four free guides and one paid kit.</p></div>
    <ol class="pk-list">{rows}</ol>
    <div class="pk-all"><p class="label">Also free</p><ul>{rest}</ul><a class="pk-allk label" href="/resources">All resources {ARROW}</a></div>
  </section>'''


def shop_teaser():
    d = RES["design-kit"]
    return f'''<section class="sht dark" aria-labelledby="sht-h">
    <a class="sht-card" href="/shop">
      <span class="sht-media">{res_img(d[3], "", "(max-width: 900px) 100vw, 60vw")}</span>
      <span class="sht-copy"><span class="label">Shop</span><b id="sht-h">Tools I made for my own work.</b><span>Kits, prompts and templates. Try every one before you get it.</span><span class="pill">Open the shop {ARROW}</span></span>
    </a>
  </section>'''
