"""Pack the private guide files into the SHOP_KITS_GZ value Vercel serves through /api/kit.

    python scripts/pack-shop-kits.py [guides_dir]

Reads <guides_dir>/public/*.json (default F:/Renders/cooper-corpus/guides; never in this public repo), keeps only
the fields the API uses, and writes base64(gzip(JSON keyed by slug)) to <guides_dir>/SHOP_KITS_GZ.txt.
The previous value is kept as SHOP_KITS_GZ.prev.txt. Paste the new value into Vercel (SHOP_KITS_GZ) by hand.
"""
import base64, gzip, json, shutil, sys
from pathlib import Path

DIR = Path(sys.argv[1] if len(sys.argv) > 1 else r"F:/Renders/cooper-corpus/guides")
FIELDS = ("slug", "pillar", "title", "result", "proof_links", "steps", "master_prompt")  # what api/_lib/shop.mjs reads

kits = {}
for f in sorted((DIR / "public").glob("*.json")):
    j = json.loads(f.read_text(encoding="utf-8"))
    kits[j["slug"]] = {k: j[k] for k in FIELDS if k in j}
    assert kits[j["slug"]]["steps"], f"{f.name}: no steps"

out = DIR / "SHOP_KITS_GZ.txt"
if out.exists():
    shutil.copy2(out, DIR / "SHOP_KITS_GZ.prev.txt")
value = base64.b64encode(gzip.compress(json.dumps(kits, ensure_ascii=False).encode("utf-8"), mtime=0)).decode("ascii")
out.write_text(value, encoding="ascii")
assert json.loads(gzip.decompress(base64.b64decode(value))) == kits  # round-trips
print(f"packed {len(kits)} kits ({', '.join(kits)}) -> {out} ({len(value)} chars); previous kept as SHOP_KITS_GZ.prev.txt")
