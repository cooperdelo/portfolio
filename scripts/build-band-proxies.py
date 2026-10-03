"""Build small review previews for every band clip from the originals on G:, upload them to the private
band-review bucket, and record proxy_path. Originals are never touched. Re-runs skip clips that already have one.

    python scripts/build-band-proxies.py            # all missing
    python scripts/build-band-proxies.py --dry-run  # show the matches only
"""
import argparse, hashlib, json, re, subprocess, tempfile
from pathlib import Path
import requests

GIGS = Path("G:/Videos/03_GIGS")
FOLDER = {"MAW": "maw_9-11-26", "Pi Kapp": "pikapp_8-26-26", "Chi Phi": "chiphi_9-12-26"}
BASE = "https://eibtnkaoqsgwiqttiwjo.supabase.co"

ap = argparse.ArgumentParser(); ap.add_argument("--dry-run", action="store_true"); a = ap.parse_args()
env = Path("C:/Users/coope/Desktop/Claude/Projects/personal-brand/factory/.env").read_text()
key = re.search(r"^SUPABASE_SERVICE_KEY\s*=\s*(.+?)\s*$", env, re.M).group(1).strip("\"'")
H = {"apikey": key, "Authorization": "Bearer " + key}

assets = requests.get(BASE + "/rest/v1/band_media_assets?select=id,drive_file_id,name,gig,proxy_path&retired_at=is.null", headers=H, timeout=30).json()


def original(asset):
    folder = next((GIGS / f for g, f in FOLDER.items() if asset["gig"].startswith(g)), None)
    if not folder or not folder.exists():
        return None
    exact = folder / asset["name"]
    if exact.exists():
        return exact
    stem = Path(asset["name"]).stem  # Pi Kapp originals are V1-00xx_<name>.mov; Drive copies are <name>.mp4
    hits = [p for p in folder.iterdir() if p.stem == stem or p.stem.endswith("_" + stem)]
    if not hits:
        hits = [p for p in (GIGS.parent / "01_BROLL").iterdir() if p.stem == stem]
    return hits[0] if len(hits) == 1 else None


done = 0
for asset in assets:
    if asset["proxy_path"] or not asset["name"].lower().endswith((".mp4", ".mov")):
        continue
    src = original(asset)
    print(("OK  " if src else "MISS"), asset["gig"], asset["name"], "->", src)
    if a.dry_run or not src:
        continue
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / "p.mp4"
        # 720p, frequent keyframes so scrubbing the timeline is instant, small enough to stream on a phone.
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", "scale=-2:720", "-c:v", "libx264", "-preset", "veryfast", "-crf", "27",
                        "-g", "25", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(out)], check=True)
        data = out.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        path = f"{asset['drive_file_id']}/{digest[:16]}.mp4"
        r = requests.post(f"{BASE}/storage/v1/object/band-review/{path}", headers={**H, "Content-Type": "video/mp4", "x-upsert": "true"}, data=data, timeout=300)
        r.raise_for_status()
        back = requests.get(f"{BASE}/storage/v1/object/authenticated/band-review/{path}", headers=H, timeout=300)
        back.raise_for_status(); assert hashlib.sha256(back.content).hexdigest() == digest, "readback mismatch"
        dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(out)], text=True))
        r = requests.patch(BASE + "/rest/v1/band_media_assets", params={"id": "eq." + asset["id"]}, headers={**H, "Prefer": "return=representation"},
                           json={"proxy_path": path, "duration": round(dur, 2)}, timeout=30)
        r.raise_for_status(); assert r.json()[0]["proxy_path"] == path
        done += 1
        print(f"     uploaded {len(data) / 1e6:.1f} MB, {dur:.1f}s, verified")
print("built", done)
