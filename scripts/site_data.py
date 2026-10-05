"""One source for what the site shows, so the homepage, /work, /resources and the shop never drift apart.

Pillars are what Cooper does (Films & content, PlugVerse, Music). Resources are what he teaches.
Every work piece points at the resource that explains how it was made.
"""

PILLARS = [("films", "Films & content"), ("plugverse", "PlugVerse"), ("music", "Music")]

# slug, title, pillar, line, year, href, media (video name in /videos/work or image path), how-I-made-this resource slug
WORK_CARDS = [
    ("chapter-one", "Chapter One", "films", "Junior year, in 33 seconds.", "2026", "/work/chapter-one", ("video", "chapter-one"), "film-plan"),
    ("plugverse-product", "PlugVerse app", "plugverse", "I built it solo. Every show, one link.", "2025/26", "/work/plugverse-product", ("video", "pv-turntable"), "startup"),
    ("rubber-band", "Rubber Band", "music", "Guitar, and I run the bookings.", "2025", "/work/rubber-band", ("video", "rubber-band"), "music"),
    ("the-start", "The Start", "films", "I am terrified of starting.", "2026", "/work/the-start", ("video", "the-start"), "film-motion"),
    ("plugverse-launch-film", "PlugVerse launch film", "plugverse", "My first short film, for my startup's launch.", "2026", "/work/plugverse-launch-film", ("video", "launch-film"), "film-plan"),
    ("bioswap", "What's your rate?", "plugverse", "A PlugVerse ad, made in code.", "2026", "/work/bioswap", ("video", "bioswap-final"), "startup"),
    ("flicker-of-time", "Flicker of Time", "music", "My EP. Four songs.", "2024", "https://open.spotify.com/album/5kVO52fF80upZVRJlc84SO", ("image", "/img/chapters/ep-720.webp"), "music"),
]

# slug, title, line, cover key (/img/res/<key>-600|1200.webp), href, access (free | email | paid)
RESOURCES = [
    ("gear", "My setup", "Everything I shoot, play and record with. Always up to date.", "gear", "/gear", "free"),
    ("film-plan", "Hooks that hold", "My hooks and retention rules, in one paste for your AI.", "film", "/resources/film-plan", "free"),
    ("ai-system", "How I built my AI system", "One folder your AI reads before it answers.", "ai", "/resources/ai-system", "email"),
    ("film-motion", "Film your life with one camera", "Bank ten shots a spot. Use one or two.", "ch1", "/resources/guides/film-motion", "email"),
    ("linkedin", "LinkedIn posts strangers read", "Score your first line before you write the rest.", "pitch", "/resources/guides/linkedin", "email"),
    ("instagram-tiktok", "Short videos from your real week", "One week, one topic a day, filmed on Sunday.", "phone", "/resources/guides/instagram-tiktok", "email"),
    ("music", "Get your band booked", "One booking link, one note per song, a set in minutes.", "stage", "/resources/guides/music", "email"),
    ("startup", "Shipping PlugVerse solo", "What actually worked, and what didn't.", "pv", "/resources/guides/startup", "free"),
    ("design-kit", "Sites that don't look like AI", "The references, rules and prompt behind this site.", "designkit", "/shop/design-kit", "paid"),
]
RES = {r[0]: r for r in RESOURCES}
ACCESS = {"free": "Free", "email": "Free", "paid": "Kit"}  # never say "with email"; people find the ask when they open it


def res_img(key, alt="", sizes="(max-width: 900px) 100vw, 33vw", eager=False):
    return (f'<img src="/img/res/{key}-1200.webp" srcset="/img/res/{key}-600.webp 600w, /img/res/{key}-1200.webp 1200w" sizes="{sizes}" '
            f'alt="{alt}" loading="{"eager" if eager else "lazy"}" decoding="async" />')


# ---------------------------------------------------------------- the funnel (2026-10-05): one clear next step everywhere
ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
PRICE = {"design-kit": "$29"}


def pv(free, paid):
    """Both labels in the page. Production shows the free one (the Design kit is free on cooperdelo.com);
    /assets/kit-price.js switches to the paid one only when /api/kit reports a paid kit (QA / preview)."""
    return (f'<span class="if-free">{free}</span>' if free else "") + f'<span class="if-paid">{paid}</span>'


def tag(slug):
    """Free, or (previews only) Kit · $29. Never 'with email'."""
    acc = RES[slug][5]
    return pv("Free", f"Kit · {PRICE[slug]}") if acc == "paid" else ACCESS[acc]


# Homepage "Start here": what the visitor is trying to do -> the one resource for it.
PICKER = [
    ("film-motion", "Film your life"),
    ("music", "Get your band booked"),
    ("startup", "Ship something solo"),
    ("ai-system", "Run your life with AI"),
    ("design-kit", "Make a site that doesn't look like AI"),
]

# End of every free resource: one related free thing, plus the kit only where it genuinely fits.
NEXT = {
    "film-motion": ["film-plan", "gear"],
    "film-plan": ["film-motion"],
    "instagram-tiktok": ["film-plan"],
    "linkedin": ["instagram-tiktok", "design-kit"],
    "music": ["film-motion"],
    "startup": ["ai-system", "design-kit"],
    "ai-system": ["design-kit", "startup"],
}


def next_block(slug, theme="light"):
    """'Next' cards at the end of a free resource. Static, so it shows locked and unlocked."""
    items = NEXT.get(slug, [])
    if not items:
        return ""
    cards = "".join(
        f'''<li><a class="made" href="{RES[s][4]}" data-from="next" data-to="{s}"><span class="made-img">{res_img(RES[s][3], "", "(max-width: 700px) 100vw, 220px")}</span>
        <span class="made-cap"><span class="label">{tag(s)}</span><b>{RES[s][1]}</b><span>{RES[s][2]}</span></span><span class="made-go">{ARROW}</span></a></li>'''
        for s in items)
    return f'''<section class="nx {theme}" aria-labelledby="nx-h">
    <p class="label" id="nx-h">Next</p>
    <ol class="nx-list n{len(items)}">{cards}</ol>
  </section>'''


def mk_line(slug, label, frm):
    """One line that points at a resource: 'Make one like this' on case pages, the film guide on /gear."""
    if slug not in RES:
        return ""
    s = RES[slug]
    return f'''<a class="mk-line" href="{s[4]}" data-from="{frm}" data-to="{slug}"><span class="label">{label}</span><b>{s[1]}</b><span class="label mk-tag">{tag(slug)} {ARROW}</span></a>'''
