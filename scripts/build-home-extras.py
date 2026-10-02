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


def motion():
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
      <div class="acts"><a class="pill" href="/work/bioswap" data-handoff>Watch it with sound {ARROW}</a><a class="pill" href="mailto:cooper@plugverse.app?subject=Motion%20starter">I want the starter</a></div>
    </div>
  </section>"""


def records(first=2):
    items = []
    for a in ALBUMS:
        s = a["slug"]
        items.append(
            f'<li class="rx" data-title="{a["title"]}" data-artist="{a["artist"]}" data-year="{a["year"]}">'
            f'<button class="rx-hit" type="button" aria-pressed="false" aria-label="{a["title"]}, {a["artist"]}, {a["year"]}"><span class="rx-art"><span class="rx-disc">'
            f'<img class="rx-label" src="/img/records/label-{s}.webp" width="200" height="200" alt="" loading="lazy" decoding="async" />'
            f'<img class="rx-vinyl" src="/img/records/record-640.webp" srcset="/img/records/record-640.webp 640w, /img/records/record-960.webp 960w" sizes="(max-width: 666px) 80vw, (max-width: 900px) 535px, 340px" width="640" height="640" alt="" loading="lazy" decoding="async" />'
            f'</span><img class="rx-sleeve" src="/img/records/sleeve-{s}-640.webp" srcset="/img/records/sleeve-{s}-640.webp 640w, /img/records/sleeve-{s}-960.webp 960w" sizes="(max-width: 666px) 80vw, (max-width: 900px) 535px, 340px" width="640" height="640" alt="" loading="lazy" decoding="async" /></span></button></li>')
    f = ALBUMS[first]
    return f"""<section class="records dark" aria-labelledby="rx-h">
    <div class="rx-head"><p class="label" id="rx-h">On repeat</p><p>A few records I come back to.</p></div>
    <ol class="rx-strip" data-records>
      {(chr(10) + "      ").join(items)}
    </ol>
    <p class="rx-now" data-records-now aria-live="polite"><span class="label"><span class="swap" data-no>No. {first + 1:02d}</span></span><span><span class="swap"><span class="t" data-t>{f["title"]}</span><span class="a" data-a>{f["artist"]}, {f["year"]}</span></span></span><span class="label">33 1/3 RPM</span></p>
  </section>"""
