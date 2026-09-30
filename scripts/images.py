# Photo pipeline. Every photo slot on the site is defined in content/photos.json (see README-PHOTOS.md).
# This builds responsive image sets (AVIF + WebP + JPEG, 640/1280/1920 wide) into /img/ for each slot's source,
# and only re-encodes a source when its path, file or crop changed.
# Run on its own: python scripts/images.py   (build-work-pages.py also runs it first)
# Needs Pillow with AVIF support (Pillow >= 11.3 wheels ship it).
import pathlib, json, sys, re, hashlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PHOTOS = ROOT / "content" / "photos.json"
NAMES = ROOT / "scripts" / "photo-names.json"     # source -> derivative name. Keeps /img/ names stable. Not for hand editing.
MANIFEST = ROOT / "scripts" / "images.json"      # what was built: widths, size, and the stamp of the source
OUT = ROOT / "img"
WIDTHS = [640, 1280, 1920]


def canon(src):
    """Canonical form of a source path: repo-relative if inside the repo, else absolute. Forward slashes."""
    p = pathlib.Path(src.replace("\\", "/"))
    if not p.is_absolute():
        p = ROOT / p
    p = pathlib.Path(str(p.resolve()))
    try:
        return p.relative_to(ROOT).as_posix()
    except ValueError:
        return p.as_posix()


def src_path(c):
    p = pathlib.Path(c)
    return p if p.is_absolute() else ROOT / p


def load_slots():
    """Reads content/photos.json. Backslashes in "src" (a path pasted from Explorer) are accepted."""
    txt = PHOTOS.read_text(encoding="utf-8")
    txt = re.sub(r'("src"\s*:\s*")([^"]*)(")', lambda m: m.group(1) + m.group(2).replace("\\\\", "/").replace("\\", "/") + m.group(3), txt)
    data = json.loads(txt)
    slots = {}
    for s in data["slots"]:
        sid = s["slot_id"]
        if sid in slots:
            sys.exit(f"photos.json: slot_id {sid} is listed twice")
        s["src"] = canon(s["src"])
        if not src_path(s["src"]).exists():
            sys.exit(f"photos.json: {sid}: file not found: {s['src']}")
        slots[sid] = s
    return slots


def slug(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")[:40] or "photo"


def resolve_names(slots):
    names = json.loads(NAMES.read_text()) if NAMES.exists() else {}
    low = {k.lower(): v for k, v in names.items()}
    changed = False
    for s in slots.values():
        key = low.get(s["src"].lower())
        if not key:
            key = slug(pathlib.Path(s["src"]).stem) + "-" + hashlib.sha1(s["src"].lower().encode()).hexdigest()[:6]
            names[s["src"]] = key; low[s["src"].lower()] = key; changed = True
        crop = s.get("crop")
        s["key"] = key if not crop else f"{key}-c{hashlib.sha1(json.dumps(crop).encode()).hexdigest()[:6]}"
    if changed:
        NAMES.write_text(json.dumps(names, indent=1) + "\n")
    return slots


def stamp(s):
    st = src_path(s["src"]).stat()
    return {"src": s["src"], "size": st.st_size, "mtime": int(st.st_mtime), "crop": s.get("crop")}


def widths_for(width):
    ws = [w for w in WIDTHS if w < width] + ([min(width, 2400)] if width not in WIDTHS or width <= 1920 else [])
    return sorted(set(w for w in ws if w <= 2400))


def encode(s):
    from PIL import Image
    im = Image.open(src_path(s["src"])).convert("RGB")
    crop = s.get("crop")
    if crop:  # [left, top, right, bottom] as fractions of the frame
        W, H = im.size
        im = im.crop((round(crop[0] * W), round(crop[1] * H), round(crop[2] * W), round(crop[3] * H)))
    ws = widths_for(im.width)
    for w in ws:
        h = round(im.height * w / im.width)
        r = im.resize((w, h), Image.LANCZOS)
        r.save(OUT / f"{s['key']}-{w}.avif", quality=55, speed=6)
        r.save(OUT / f"{s['key']}-{w}.webp", quality=78, method=5)
        r.save(OUT / f"{s['key']}-{w}.jpg", quality=80, optimize=True, progressive=True)
    return {"w": ws, "ar": [im.width, im.height]}


def files_exist(key, ws):
    return all((OUT / f"{key}-{w}.{e}").exists() for w in ws for e in ("avif", "webp", "jpg"))


def build(verbose=True):
    """Returns (slots, manifest). Encodes only what changed."""
    from PIL import features
    OUT.mkdir(exist_ok=True)
    slots = resolve_names(load_slots())
    old = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    man, made = {}, []
    for s in slots.values():
        k = s["key"]
        if k in man:
            continue
        st = stamp(s)
        e = old.get(k)
        if e and files_exist(k, e["w"]) and (e.get("stamp") == st or ("stamp" not in e and not st["crop"])):
            man[k] = {"w": e["w"], "ar": e["ar"], "stamp": st}   # unchanged (or built before stamps existed)
            continue
        if not features.check("avif"):
            sys.exit("Pillow has no AVIF support")
        man[k] = {**encode(s), "stamp": st}
        made.append(k)
    for k, e in old.items():   # keep entries for sources no slot uses right now, so switching back costs nothing
        man.setdefault(k, e)
    MANIFEST.write_text(json.dumps(man, indent=1) + "\n")
    if verbose:
        print(f"images: {len(slots)} slots, {len({s['key'] for s in slots.values()})} distinct photos, re-encoded {len(made)}" + (f": {', '.join(made)}" if made else ""))
    return slots, man


if __name__ == "__main__":
    build()
