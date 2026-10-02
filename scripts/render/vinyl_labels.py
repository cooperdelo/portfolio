"""Print the centre labels for the On Repeat records.

Each label is a flat colour lifted from its own sleeve, set in Nimbus Sans, and
numbered as one series so the shelf reads like a curated run rather than eleven
unrelated pressings. Output is a square texture the Blender scene maps onto the
label disc.

    python scripts/render/vinyl_labels.py <covers_dir> <fonts_dir> <out_dir>
"""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

from vinyl_albums import ALBUMS

SIZE = 2048  # texture px across the full 100mm label
SPINDLE = 7.24 / 100  # spindle hole as a fraction of label diameter


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def fit(draw, text, font_path, size, max_w):
    while size > 10:
        f = ImageFont.truetype(font_path, size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return ImageFont.truetype(font_path, size)


def arc_text(img, text, font, radius, centre_deg, fill, tracking=0.0):
    """Set text along a circle, reading clockwise across the top."""
    d = ImageDraw.Draw(img)
    widths = [d.textlength(ch, font=font) + tracking for ch in text]
    total = sum(widths)
    ang = math.radians(centre_deg) - (total / radius) / 2
    cx = cy = SIZE / 2
    for ch, w in zip(text, widths):
        a = ang + (w / 2) / radius
        tile = Image.new("L", (int(font.size * 2), int(font.size * 2)), 0)
        ImageDraw.Draw(tile).text((tile.width / 2, tile.height / 2), ch, font=font, fill=255, anchor="mm")
        tile = tile.rotate(-math.degrees(a) - 90, resample=Image.BICUBIC, expand=False)
        x = cx + radius * math.cos(a) - tile.width / 2
        y = cy + radius * math.sin(a) - tile.height / 2
        img.paste(Image.new("RGB", tile.size, fill), (int(x), int(y)), tile)
        ang += w / radius


def build(album, idx, covers, fonts, out):
    bg, fg = hex_rgb(album["label"]), hex_rgb(album["ink"])

    img = Image.new("RGB", (SIZE, SIZE), bg)
    d = ImageDraw.Draw(img)
    c = SIZE / 2
    bold = str(fonts / "NimbusSans-Bold.ttf")
    reg = str(fonts / "NimbusSans-Regular.ttf")

    # Pressing ring and a hairline inner rule, the way real labels are struck.
    for r, w in ((SIZE * 0.485, 3), (SIZE * 0.415, 2)):
        d.ellipse((c - r, c - r, c + r, c + r), outline=fg, width=w)

    title = album["title"].upper()
    artist = album["artist"].upper()
    f_title = fit(d, title, bold, 132, SIZE * 0.62)
    f_artist = fit(d, artist, reg, 64, SIZE * 0.58)
    d.text((c, c - SIZE * 0.20), artist, font=f_artist, fill=fg, anchor="mm")
    d.text((c, c - SIZE * 0.12), title, font=f_title, fill=fg, anchor="mm")

    small = ImageFont.truetype(reg, 46)
    tiny = ImageFont.truetype(bold, 46)
    d.text((c - SIZE * 0.24, c + 4), "SIDE A", font=tiny, fill=fg, anchor="mm")
    d.text((c + SIZE * 0.24, c + 4), "33 RPM", font=tiny, fill=fg, anchor="mm")
    d.text((c, c + SIZE * 0.15), f"ON REPEAT  No. {idx:02d}", font=small, fill=fg, anchor="mm")
    d.text((c, c + SIZE * 0.21), str(album["year"]), font=small, fill=fg, anchor="mm")

    arc_text(img, "ON REPEAT  ·  CHAPEL HILL  ·  STEREO", ImageFont.truetype(reg, 40),
             SIZE * 0.445, -90, fg, tracking=6)

    # Soft press texture so the flat colour isn't digital-flat.
    grain = Image.effect_noise((SIZE, SIZE), 18).filter(ImageFilter.GaussianBlur(1.2))
    img = Image.blend(img, Image.merge("RGB", (grain, grain, grain)), 0.035)

    # Punch the spindle hole as alpha so it renders through.
    alpha = Image.new("L", (SIZE, SIZE), 255)
    hr = SIZE * SPINDLE / 2
    ImageDraw.Draw(alpha).ellipse((c - hr, c - hr, c + hr, c + hr), fill=0)
    img.putalpha(alpha)
    img.save(out / f"label_{album['slug']}.png")
    print("label", album["slug"], bg)


if __name__ == "__main__":
    covers, fonts, out = (Path(p) for p in sys.argv[1:4])
    out.mkdir(parents=True, exist_ok=True)
    for i, a in enumerate(ALBUMS, 1):
        build(a, i, covers, fonts, out)
