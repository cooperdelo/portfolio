"""Build what the record viewer loads on first click: cover textures, designed back covers, and records.json.

    python scripts/render/records_data.py <covers_dir> <fonts_dir> [repo_root]

Tracklists come from the original releases (MusicBrainz / Apple / Deezer, see album-meta.json). Previews are
Apple's 30-second clips. Cooper's own EP streams through Spotify instead.
"""
import json
import sys
import urllib.parse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

from vinyl_albums import ALBUMS

HERE = Path(__file__).resolve().parent
EP = {"spotify_album": "5kVO52fF80upZVRJlc84SO",
      "tracks": ["Waiting", "Flicker", "If You Exist", "What We Left Behind"],
      "spotify_artist": "https://open.spotify.com/artist/5ADdu7EYmsFlIUPrH5azhc"}


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def fit(d, text, path, size, w):
    while size > 12:
        f = ImageFont.truetype(path, size)
        if d.textlength(text, font=f) <= w:
            return f
        size -= 2
    return ImageFont.truetype(path, size)


def back_cover(a, tracks, no, fonts, out):
    """The back of the sleeve, designed like the labels: label colour as the field, the tracklist in two columns."""
    S = 1024
    bg, fg = rgb(a["label"]), rgb(a["ink"])
    img = Image.new("RGB", (S, S), bg)
    d = ImageDraw.Draw(img)
    bold, reg = str(fonts / "NimbusSans-Bold.ttf"), str(fonts / "NimbusSans-Regular.ttf")
    m = 74
    d.text((m, m), a["artist"].upper(), font=ImageFont.truetype(reg, 30), fill=fg)
    d.text((m, m + 44), a["title"].upper(), font=fit(d, a["title"].upper(), bold, 70, S - 2 * m), fill=fg)
    d.line((m, m + 150, S - m, m + 150), fill=fg, width=3)
    half = (len(tracks) + 1) // 2
    sides = [("TRACKLIST", tracks[:half]), ("", tracks[half:])]  # two columns, not LP sides: the real side splits vary
    col_w = (S - 2 * m - 40) // 2
    size = 27 if len(tracks) <= 12 else 23
    f_t, f_n = ImageFont.truetype(reg, size), ImageFont.truetype(bold, size)
    for ci, (side, ts) in enumerate(sides):
        x, y = m + ci * (col_w + 40), m + 186
        d.text((x, y), side, font=ImageFont.truetype(bold, 24), fill=fg)
        y += 50
        for i, t in enumerate(ts):
            n = i + 1 + (0 if ci == 0 else half)
            pick = a.get("fav") and t.lower().startswith(a["fav"].lower()[:12])
            label = t if d.textlength(t, font=f_t) <= col_w - 56 else t[: max(4, int(len(t) * (col_w - 70) / d.textlength(t, font=f_t)))].rstrip() + "…"
            d.text((x, y), f"{n:02d}", font=f_n, fill=fg)
            d.text((x + 52, y), label, font=f_n if pick else f_t, fill=fg)
            if pick:
                d.ellipse((x + 52 + d.textlength(label, font=f_n) + 12, y + size * 0.35, x + 52 + d.textlength(label, font=f_n) + 24, y + size * 0.35 + 12), fill=fg)
            y += int(size * 1.62)
    foot = (a.get("series") or f"ON REPEAT  No. {no:02d}") + f"   ·   {a['year']}   ·   COOPERDELO.COM"
    d.line((m, S - m - 56, S - m, S - m - 56), fill=fg, width=2)
    d.text((m, S - m - 34), foot, font=ImageFont.truetype(reg, 22), fill=fg)
    grain = Image.effect_noise((S, S), 16).filter(ImageFilter.GaussianBlur(1.1))
    img = Image.blend(img, Image.merge("RGB", (grain, grain, grain)), 0.03)
    img.save(out, "JPEG", quality=82, optimize=True, progressive=True)


def main(covers, fonts, repo):
    meta = json.loads((HERE / "album-meta.json").read_text(encoding="utf-8"))
    dst = repo / "img" / "records"
    dst.mkdir(parents=True, exist_ok=True)
    records, n = [], 0
    for a in ALBUMS:
        s = a["slug"]
        if not a.get("own"):
            n += 1
        Image.open(covers / f"{s}.jpg").convert("RGB").resize((1024, 1024), Image.LANCZOS).save(dst / f"cover-{s}-1024.jpg", "JPEG", quality=80, optimize=True, progressive=True)
        if a.get("own"):
            tracks = [{"t": t} for t in EP["tracks"]]
            links = {"spotify": f"https://open.spotify.com/album/{EP['spotify_album']}", "artist": EP["spotify_artist"]}
        else:
            m = meta[s]
            tracks = [{"t": t, **({"p": m["previews"][t]} if t in m.get("previews", {}) else {})} for t in m["tracks"]]
            q = urllib.parse.quote(f"{a['title']} {a['artist']}")
            links = {"spotify": f"https://open.spotify.com/search/{q}", "apple": m.get("apple") or f"https://music.apple.com/us/search?term={q}"}
        back_cover(a, [t["t"] for t in tracks], n, fonts, dst / f"back-{s}.jpg")
        flat = covers.parent / "labels" / f"label_{s}.png"  # the flat printed label, unlit: right for a 3D texture
        if flat.exists():
            Image.open(flat).convert("RGBA").resize((512, 512), Image.LANCZOS).save(dst / f"label3d-{s}.webp", "WEBP", quality=86, alpha_quality=95)
        rec = {"slug": s, "title": a["title"], "artist": a["artist"], "year": a["year"], "label": a["label"], "ink": a["ink"],
               "no": None if a.get("own") else n, "own": bool(a.get("own")), "fav": a.get("fav"), "favNote": a.get("fav_note"),
               "tracks": tracks, "links": links}
        if a.get("own"):
            rec["spotifyAlbum"] = EP["spotify_album"]
        records.append(rec)
    out = repo / "content" / "records.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(records, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(records)} records, {out.stat().st_size // 1024} KB of data")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]) if len(sys.argv) > 3 else HERE.parent.parent)
