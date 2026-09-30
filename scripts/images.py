# Builds responsive image sets (AVIF + WebP + JPEG, 640/1280/1920 wide) into /img/.
# Sources are real frames/stills from Cooper's footage (see PORTFOLIO-BUILD-LOG.md for the picks).
# Run: python scripts/images.py   (needs Pillow with AVIF support, which Pillow >= 11.3 wheels ship)
import pathlib, json, sys
from PIL import Image, features

ROOT = pathlib.Path(__file__).resolve().parent.parent
CANDS = pathlib.Path(r"C:\Users\coope\Desktop\Claude\Projects\design-references\proofs\portfolio\_work\cands")
OUT = ROOT / "img"; OUT.mkdir(exist_ok=True)
WIDTHS = [640, 1280, 1920]

SOURCES = {
  # photos of Cooper (v3 picks)
  "lawn": CANDS / "lawn-c_002.85.jpg",
  "chiphi-solo": CANDS / "chiphi-solo-b_001.02.jpg",
  "chiphi-solo-2": CANDS / "chiphi-solo-b_000.78.jpg",
  "chiphi-band": CANDS / "chiphi-solo-a_002.33.jpg",
  "chiphi-porch": CANDS / "gig-porch_002.34.jpg",
  "desk-guitar": CANDS / "desk-guitar_001.88.jpg",
  "desk-phone": CANDS / "desk-phone_002.59.jpg",
  "couch": CANDS / "couch_009.99.jpg",
  "franklin-walk": ROOT / "photos/v2/franklin-walk.jpg",
  "belltower": ROOT / "photos/v2/belltower.jpg",
  "bar-gig": ROOT / "photos/v2/bar-gig.jpg",
  "chiphi-steps": ROOT / "photos/v2/chiphi.jpg",
  "hero-poster": pathlib.Path(r"C:\Users\coope\Desktop\Claude\Projects\design-references\proofs\portfolio\_work\hero\poster-1920.jpg"),
  "hero-poster-m": pathlib.Path(r"C:\Users\coope\Desktop\Claude\Projects\design-references\proofs\portfolio\_work\hero\poster-720.jpg"),
}
# case-study stills + product renders: everything already in photos/work and renders
for p in sorted((ROOT / "photos/work").glob("*.jpg")):
    SOURCES["w-" + p.stem] = p
for p in sorted((ROOT / "renders").glob("*.png")) if (ROOT / "renders").exists() else []:
    SOURCES["r-" + p.stem] = p
for p in sorted((ROOT / "videos/work").glob("*.jpg")):
    SOURCES["p-" + p.stem] = p
for k in [k for k in SOURCES if k.startswith("w-") and any(x in k for x in ("pv-landing", "pv-tonight", "pv-search", "pv-pricing", "pv-public", "pv-native", "ch1-selfie"))]:
    SOURCES.pop(k)

if not features.check("avif"):
    sys.exit("Pillow has no AVIF support")
manifest = {}
for key, src in SOURCES.items():
    im = Image.open(src).convert("RGB")
    ws = [w for w in WIDTHS if w < im.width] + ([min(im.width, 2400)] if im.width not in WIDTHS or im.width <= 1920 else [])
    ws = sorted(set(w for w in ws if w <= 2400))
    for w in ws:
        h = round(im.height * w / im.width)
        r = im.resize((w, h), Image.LANCZOS)
        r.save(OUT / f"{key}-{w}.avif", quality=55, speed=6)
        r.save(OUT / f"{key}-{w}.webp", quality=78, method=5)
        r.save(OUT / f"{key}-{w}.jpg", quality=80, optimize=True, progressive=True)
    manifest[key] = {"w": ws, "ar": [im.width, im.height]}
(ROOT / "scripts/images.json").write_text(json.dumps(manifest, indent=1))
print("images", len(manifest))
