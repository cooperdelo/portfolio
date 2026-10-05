"""Post-quality downloads for the band reviewer, next to the previews in the shared Drive folder.

Photos: 2048px JPEG (q90) rendered from the original (Sony ARW or JPG). Videos: 1080p H.264 (CRF 20, AAC 192k,
faststart) cut from the original on G:, 4K scaled down. Files are named <asset_id>.hd.jpg / <asset_id>.hd.mp4 so
/api/band-share finds them by name; nothing in the database changes. Originals are only read. Re-runs skip
files that already exist. Writes go to a .part file first so Drive never uploads half a file.

    python scripts/build-band-downloads.py               # dry run: what would be made
    python scripts/build-band-downloads.py --apply --jobs 3
"""
import argparse, re, string, subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests

BASE = "https://eibtnkaoqsgwiqttiwjo.supabase.co"
G = Path("G:/")
ap = argparse.ArgumentParser(); ap.add_argument("--apply", action="store_true"); ap.add_argument("--jobs", type=int, default=3)
ap.add_argument("--drive-root"); ap.add_argument("--only", choices=["photos", "videos"]); a = ap.parse_args()
env = Path("C:/Users/coope/Desktop/Claude/Projects/personal-brand/factory/.env").read_text()
key = re.search(r"^SUPABASE_SERVICE_KEY\s*=\s*(.+?)\s*$", env, re.M).group(1).strip("\"'")
H = {"apikey": key, "Authorization": "Bearer " + key}


def drive_root():
    if a.drive_root: return Path(a.drive_root)
    for l in string.ascii_uppercase:
        if l != "G" and (Path(f"{l}:/") / "My Drive").is_dir(): return Path(f"{l}:/")
    raise SystemExit("No Google Drive mount found (pass --drive-root).")


OUT = drive_root() / "My Drive" / "Rubber Band Review" / "previews"
rows = requests.get(BASE + "/rest/v1/band_media_assets?select=id,name,mime_type,duration,source_path&retired_at=is.null&source_path=not.is.null", headers=H, timeout=30).json()


def src_of(r):
    sp = r["source_path"]
    if sp.startswith("drive:"): return drive_root() / sp[len("drive:"):]
    p = (G / sp).resolve()
    if not str(p).lower().startswith(("g:\\videos\\", "g:\\photos\\")): raise ValueError("source outside G:/Videos or G:/Photos: " + sp)
    return p


def job(r):
    photo = r["mime_type"].startswith("image/")
    out = OUT / f"{r['id']}.hd.{'jpg' if photo else 'mp4'}"
    if out.exists(): return "skip", r["name"]
    src = src_of(r)
    if not src.exists(): return "missing", r["name"]
    if not a.apply: return "would", r["name"]
    part = out.with_suffix(".part" + out.suffix)
    if photo:
        cmd = ["magick", str(src), "-auto-orient", "-resize", "2048x2048>", "-quality", "90", str(part)]
    else:
        cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", "scale=-2:'min(1080,ih)'", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
               "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(part)]
    r2 = subprocess.run(cmd, capture_output=True, text=True)
    if r2.returncode != 0 or not part.exists():
        part.unlink(missing_ok=True); return "failed", f"{r['name']}: {r2.stderr.strip()[:160]}"
    part.replace(out); return "made", r["name"]


picked = [r for r in rows if not a.only or (a.only == "photos") == r["mime_type"].startswith("image/")]
picked.sort(key=lambda r: (not r["mime_type"].startswith("image/"), float(r["duration"] or 0)))  # photos, then short clips first
print(f"{len(picked)} assets -> {OUT}{'' if a.apply else '  (DRY RUN, add --apply)'}")
counts = {}
with ThreadPoolExecutor(a.jobs) as pool:
    for status, name in pool.map(job, picked):
        counts[status] = counts.get(status, 0) + 1
        if status in ("made", "failed", "missing"): print(status.upper(), name, flush=True)
print("done:", counts)
