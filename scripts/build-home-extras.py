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


def records(first=3):
    items = []
    for a in ALBUMS:
        s = a["slug"]
        items.append(
            f'<li class="rx{" mine" if a.get("own") else ""}" data-slug="{s}" data-title="{a["title"]}" data-artist="{a["artist"]}" data-year="{a["year"]}">'
            f'<button class="rx-hit" type="button" aria-pressed="false" aria-haspopup="dialog" aria-label="Open {a["title"]}, {a["artist"]}, {a["year"]}"><span class="rx-art">{"<span class=rx-sticker>Mine</span>" if a.get("own") else ""}<span class="rx-disc">'
            f'<img class="rx-label" src="/img/records/label-{s}.webp" width="200" height="200" alt="" loading="lazy" decoding="async" />'
            f'<img class="rx-vinyl" src="/img/records/record-640.webp" srcset="/img/records/record-640.webp 640w, /img/records/record-960.webp 960w" sizes="(max-width: 666px) 80vw, (max-width: 900px) 535px, 340px" width="640" height="640" alt="" loading="lazy" decoding="async" />'
            f'</span><img class="rx-sleeve" src="/img/records/sleeve-{s}-640.webp" srcset="/img/records/sleeve-{s}-640.webp 640w, /img/records/sleeve-{s}-960.webp 960w" sizes="(max-width: 666px) 80vw, (max-width: 900px) 535px, 340px" width="640" height="640" alt="" loading="lazy" decoding="async" /></span></button></li>')
    f = ALBUMS[first]
    no = sum(1 for x in ALBUMS[: first + 1] if not x.get("own"))
    return f"""<section class="records dark" aria-labelledby="rx-h">
    <div class="rx-head"><p class="label" id="rx-h">On repeat</p><p>A few records I come back to, and one of mine. <span class="rx-tag">Pick one</span></p></div>
    <ol class="rx-strip" data-records>
      {(chr(10) + "      ").join(items)}
    </ol>
    <p class="rx-now" data-records-now aria-live="polite"><span class="label"><span class="swap" data-no>No. {no:02d}</span></span><span><span class="swap"><span class="t" data-t>{f["title"]}</span><span class="a" data-a>{f["artist"]}, {f["year"]}</span></span></span><span class="label">Open it ↗</span></p>
  </section>"""


# ---------------------------------------------------------------- showcase: one screen, four tabs, one best piece each
SHOW = [
    {"tab": "Storytelling", "title": "Chapter One", "line": "Junior year, in 33 seconds.", "stat": "17.6K views on TikTok",
     "cta": ("Watch it", "/work/chapter-one"), "video": "chapter-one", "ar": "16/9"},
    {"tab": "Motion", "title": "Bioswap", "line": "One camera, no cuts. Built in code.", "stat": "Remotion, React, Resolve",
     "cta": ("See how it moves", "/work/bioswap"), "video": "bioswap-final", "ar": "1/1", "webm": True},
    {"tab": "Product", "title": "PlugVerse", "line": "I built it solo, then made the film that launched it.", "stat": "Live since Sep 23, 2026",
     "cta": ("See PlugVerse", "/work/plugverse-product"), "video": "launch-film", "ar": "16/9"},
    {"tab": "Systems", "title": "My AI system", "line": "One set of files every AI reads, so it already knows my work.", "stat": "Built PlugVerse with it: 5,314 commits",
     "cta": ("See what it built", "/work/plugverse-product"), "video": None},
]
ALL_WORK = [("Chapter One", "/work/chapter-one"), ("PlugVerse launch film", "/work/plugverse-launch-film"), ("The Start", "/work/the-start"),
            ("Bioswap", "/work/bioswap"), ("PlugVerse product", "/work/plugverse-product"), ("Rubber Band", "/work/rubber-band")]


def systems_diagram():
    # Counts from the vault as of Oct 2, 2026 (commits, Decisions/, auto-memory/, TASK-ROSTER.md).
    agents = "".join(f'<span class="ag" style="--d:{i * 0.6}s">{n}</span>' for i, n in enumerate(["Claude", "Codex", "ChatGPT"]))
    facts = "".join(f'<li><b>{v}</b><span>{k}</span></li>' for v, k in [("50", "decisions"), ("162", "memories"), ("45", "scheduled tasks"), ("307", "saves since May")])
    return f'''<div class="sys" aria-label="Claude, Codex and ChatGPT all read one vault of files">
        <div class="agents">{agents}</div>
        <svg class="wires" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M2 10 C 40 10, 45 30, 62 30"/><path d="M2 30 L 62 30"/><path d="M2 50 C 40 50, 45 30, 62 30"/></svg>
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
    <p class="sc-all label"><span>All work</span> {allw}</p>
  </section>"""


def strip(frames_html):
    """Chapel Hill, in frames, as one slow moving strip (the images come from the generator's frames block)."""
    return f"""<div class="strip" aria-label="Chapel Hill, in frames">
      <p class="label strip-l">Chapel Hill, in frames</p>
      <div class="strip-track"><div class="strip-set">{frames_html}</div><div class="strip-set" aria-hidden="true">{frames_html}</div></div>
    </div>"""
