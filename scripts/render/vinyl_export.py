"""Export the Blender renders to the web sizes the On Repeat shelf loads.

    python scripts/render/vinyl_export.py <render_out_dir> [repo_root]

Full pipeline, from the repo root:
    python scripts/render/vinyl_labels.py <covers> <fonts> <labels>
    blender -b --factory-startup -P scripts/render/vinyl_scene.py -- <covers> <labels> <render_out> all 256
    python scripts/render/vinyl_export.py <render_out>
"""
import os
import sys

from PIL import Image

from vinyl_albums import ALBUMS


def save(im, path, size, q=84):
    im.resize((size, size), Image.LANCZOS).save(path, "WEBP", quality=q, method=6, alpha_quality=90)


def main(src, repo):
    dst = os.path.join(repo, "img", "records")
    os.makedirs(dst, exist_ok=True)
    rec = Image.open(os.path.join(src, "record.png")).convert("RGBA")
    for z in (640, 960):
        save(rec, os.path.join(dst, f"record-{z}.webp"), z)
    for a in ALBUMS:
        s = a["slug"]
        sv = Image.open(os.path.join(src, f"sleeve_{s}.png")).convert("RGBA")
        for z in (640, 960):
            save(sv, os.path.join(dst, f"sleeve-{s}-{z}.webp"), z)
        lb = Image.open(os.path.join(src, f"label_{s}.png")).convert("RGBA")
        save(lb, os.path.join(dst, f"label-{s}.webp"), 200, 88)
    small = sum(os.path.getsize(os.path.join(dst, f)) for f in os.listdir(dst) if "-960" not in f)
    print(f"exported {len(os.listdir(dst))} files, {small // 1024} KB at the 640 size")


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else os.path.abspath(os.path.join(here, "..", "..")))
