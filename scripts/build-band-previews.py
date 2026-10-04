"""Band reviewer v2: build Drive-hosted previews for every band clip/photo and record them in the DB.
Needs 20261004-band-review-v2.sql applied (source_path, preview_drive_id, poster_drive_id). Originals are never touched.
Dry run is the default; nothing is written to the DB, G: or Drive until --apply.

    py scripts/build-band-previews.py                              # plan: scan G:, match DB rows, list previews to encode
    py scripts/build-band-previews.py --photos-dir "H:/My Drive/Band"   # also plan photos whose name contains 'band'
    py scripts/build-band-previews.py --apply --jobs 2             # insert/normalise rows, retire stale ones, encode into Drive
    py scripts/build-band-previews.py --link --apply               # after Drive for Desktop uploads: record preview/poster Drive ids
"""
import argparse, datetime, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests

G = Path("G:/")
GIGS = G / "Videos/03_GIGS"
BASE = "https://eibtnkaoqsgwiqttiwjo.supabase.co"
FOLDERS = {"pikapp_8-26-26": "Pi Kapp \u00b7 Aug 26", "axo_bid_8-25-26": "AXO bid \u00b7 Aug 25", "maw_9-11-26": "MAW \u00b7 Sep 11", "chiphi_9-12-26": "Chi Phi \u00b7 Sep 12"}
LEGACY = {"MAW": "maw_9-11-26", "Chi Phi": "chiphi_9-12-26", "Pi Kapp": "pikapp_8-26-26"}  # existing gig labels start with these
PHOTOS = "Band photos"
VIDEO = {".mov": "video/quicktime", ".mp4": "video/mp4"}
IMAGE = {".jpg": "image/jpeg", ".jpeg": "image/jpeg"}
NEW_COLS = "source_path,preview_drive_id,poster_drive_id"
MIGRATION = "apply 20261004-band-review-v2.sql first"
OUT_SUB = "My Drive/Rubber Band Review/previews"


def find_drive_root(given=None):
    """Drive for Desktop (stream mode) mounts a letter whose root holds 'My Drive'. G: is the SSD, so it is skipped."""
    if given:
        return Path(given)
    for L in "HIJKLMNOPQRSTUVWXYZFED":
        if Path(f"{L}:/My Drive").is_dir():
            return Path(f"{L}:/")
    return None


def gig_for(name):
    return next((f for p, f in LEGACY.items() if name.startswith(p)), None)


def scan_videos():
    out = []
    for folder in FOLDERS:
        d = GIGS / folder
        if d.is_dir():
            out += [(folder, p) for p in sorted(d.iterdir()) if p.is_file() and not p.name.startswith("._") and p.suffix.lower() in VIDEO]
    return out


def rel_g(p):
    return Path(p).relative_to(G).as_posix()


def probe(p):
    try:
        return round(float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(p)], text=True).strip()), 2)
    except Exception:
        return None


def run(cmd):
    return subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)


def encode_video(src, out, poster):
    part = out.with_name(out.stem + ".part.mp4")  # never leave a half-written file for Drive to upload under the final name
    r = run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", "scale=-2:'min(720,ih)'", "-c:v", "libx264", "-crf", "26", "-preset", "veryfast", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(part)])
    if r.returncode:
        part.unlink(missing_ok=True)
        return "ffmpeg: " + r.stderr[-200:]
    os.replace(part, out)
    if not poster.exists():
        for ss in (["-ss", "2"], []):  # clip shorter than 2s: fall back to the first frame
            run(["ffmpeg", "-v", "error", "-y", *ss, "-i", str(src), "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "5", str(poster)])
            if poster.exists():
                break
    return None


def encode_photo(src, out, thumb):
    # ffmpeg auto-rotates by EXIF; q:v 4 is about JPEG quality 82
    long_edge = "scale='if(gt(iw,ih),min(1600,iw),-2)':'if(gt(iw,ih),-2,min(1600,ih))'"
    for dst, vf, q in ((out, long_edge, "4"), (thumb, "scale=480:-2", "5")):
        if dst.exists():
            continue
        r = run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", vf, "-frames:v", "1", "-q:v", q, str(dst)])
        if r.returncode:
            return "ffmpeg: " + r.stderr[-200:]
    return None


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true"); ap.add_argument("--link", action="store_true")
    ap.add_argument("--drive-root"); ap.add_argument("--photos-dir"); ap.add_argument("--photos-match", default="band")
    ap.add_argument("--folder-id"); ap.add_argument("--jobs", type=int, default=2)
    a = ap.parse_args()
    env = Path("C:/Users/coope/Desktop/Claude/Projects/personal-brand/factory/.env").read_text()
    key = re.search(r"^SUPABASE_SERVICE_KEY\s*=\s*(.+?)\s*$", env, re.M).group(1).strip("\"'")
    H = {"apikey": key, "Authorization": "Bearer " + key}

    def get(path):
        return requests.get(BASE + "/rest/v1/" + path, headers=H, timeout=30)

    def patch(table, match, body):
        requests.patch(f"{BASE}/rest/v1/{table}?{match}", headers={**H, "Prefer": "return=minimal"}, json=body, timeout=30).raise_for_status()

    old = "id,drive_file_id,name,gig,mime_type,duration,proxy_path,retired_at"
    r = get(f"band_media_assets?select={old},{NEW_COLS}&retired_at=is.null&order=name&limit=2000")
    cols_ok = r.ok  # missing columns come back as a 400 (42703); fall back to the old ones so a dry run can still plan
    if not cols_ok:
        r = get(f"band_media_assets?select={old}&retired_at=is.null&order=name&limit=2000")
        r.raise_for_status()
        print(f"NOTE: new columns missing -- {MIGRATION}.")
        if a.apply:
            sys.exit("Refusing to write: " + MIGRATION)
    rows = r.json()
    root = find_drive_root(a.drive_root)

    if a.link:
        return link(a, rows, get, patch)

    vids = scan_videos()
    byfile = {(f, p.name): p for f, p in vids}
    plan_update, matched = [], set()
    for r in rows:
        if r["mime_type"].startswith("image/"):
            continue
        f = gig_for(r["gig"]) or next((f for f, lbl in FOLDERS.items() if lbl == r["gig"]), None)
        if f and (f, r["name"]) in byfile:
            matched.add((f, r["name"]))
            plan_update.append((r, f, byfile[(f, r["name"])]))
    upd_ids = {u[0]["id"] for u in plan_update}
    retire = [r for r in rows if not r["mime_type"].startswith("image/") and r["id"] not in upd_ids and not str(r["drive_file_id"]).startswith("local:")]
    plan_insert = [{"folder": f, "path": p} for (f, name), p in byfile.items() if (f, name) not in matched]

    photos = []
    if a.photos_dir:
        pd = Path(a.photos_dir)
        for p in sorted(pd.rglob("*")):
            if p.is_file() and not p.name.startswith("._") and p.suffix.lower() in IMAGE and a.photos_match.lower() in p.name.lower():
                try:
                    sp = "drive:" + p.relative_to(root).as_posix()
                except (ValueError, TypeError):
                    sp = "drive:" + p.name
                photos.append((p, sp))
    have_sp = {r.get("source_path") for r in rows}
    photo_new = [(p, sp) for p, sp in photos if sp not in have_sp]

    print(f"DB rows: {len(rows)} active | G: gig files: {len(vids)} | Drive mount: {root or 'NOT FOUND (placeholder <DRIVE>)'}")
    out_dir = (root or Path("<DRIVE>")) / OUT_SUB
    print("Previews folder:", out_dir)
    for r, f, p in plan_update:
        print(f"  match   {r['gig']!r:34} {r['name']:44} -> {rel_g(p)}  gig={FOLDERS[f]!r}")
    for r in retire:
        print(f"  RETIRE  {r['gig']!r:34} {r['name']:44} (no original on G:; already-cut B-roll)")
    for x in plan_insert:
        print(f"  insert  {FOLDERS[x['folder']]!r:34} {x['path'].name:44} local:{rel_g(x['path'])}")
    for p, sp in photo_new:
        print(f"  photo   {PHOTOS!r:34} {p.name:44} {sp}")
    if a.photos_dir and not photos:
        print("  (no photos matched --photos-match", repr(a.photos_match) + ")")

    if not a.apply:
        print(f"\nDRY RUN. update {len(plan_update)} | retire {len(retire)} | insert {len(plan_insert)} videos + {len(photo_new)} photos | "
              f"previews to encode {len(plan_update) + len(plan_insert) + len(photo_new)} (minus any already in the folder). Add --apply.")
        return
    if not root:
        sys.exit("No Google Drive mount found. Pass --drive-root (the drive whose root has 'My Drive').")

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    jobs = []  # (asset id, source file, is_photo)
    for r, f, p in plan_update:
        patch("band_media_assets", "id=eq." + r["id"], {"source_path": rel_g(p), "gig": FOLDERS[f]})
        jobs.append((r["id"], p, False))
    for r in retire:
        patch("band_media_assets", "id=eq." + r["id"], {"retired_at": now})
    ins = [{"drive_file_id": "local:" + rel_g(x["path"]), "name": x["path"].name, "gig": FOLDERS[x["folder"]], "mime_type": VIDEO[x["path"].suffix.lower()],
            "duration": probe(x["path"]), "source_path": rel_g(x["path"])} for x in plan_insert]
    ins += [{"drive_file_id": "local:" + sp, "name": p.name, "gig": PHOTOS, "mime_type": "image/jpeg", "source_path": sp} for p, sp in photo_new]
    if ins:
        r = requests.post(BASE + "/rest/v1/band_media_assets", headers={**H, "Prefer": "return=representation"}, json=ins, timeout=60)
        r.raise_for_status()
        paths = {("local:" + rel_g(x["path"])): x["path"] for x in plan_insert} | {("local:" + sp): p for p, sp in photo_new}
        for row in r.json():
            jobs.append((row["id"], paths[row["drive_file_id"]], row["mime_type"].startswith("image/")))
    out_dir.mkdir(parents=True, exist_ok=True)

    def work(j):
        aid, src, photo = j
        if photo:
            out, thumb = out_dir / f"{aid}.jpg", out_dir / f"{aid}.thumb.jpg"
            if out.exists() and thumb.exists():
                return "skip", src.name, None
            return "done", src.name, encode_photo(src, out, thumb)
        out, poster = out_dir / f"{aid}.mp4", out_dir / f"{aid}.jpg"
        if out.exists() and poster.exists():
            return "skip", src.name, None
        return "done", src.name, encode_video(src, out, poster)

    stats = {"done": 0, "skip": 0, "fail": 0}
    with ThreadPoolExecutor(max(1, a.jobs)) as ex:
        for st, name, err in ex.map(work, jobs):
            stats["fail" if err else st] += 1
            print(("FAIL " + name + " " + err) if err else st.upper() + " " + name)
    print(f"\nrows updated {len(plan_update)}, retired {len(retire)}, inserted {len(ins)} | previews: encoded {stats['done']}, existing {stats['skip']}, failed {stats['fail']}")
    print("Next: let Drive for Desktop finish uploading, then run with --link --apply.")


def link(a, rows, get, patch):
    sk = get("automation_secrets?select=value&key=eq.google_drive_api_key").json()
    if not (isinstance(sk, list) and sk and sk[0].get("value")):
        sys.exit("No google_drive_api_key in automation_secrets.")
    gkey = sk[0]["value"]

    def drive_list(q):
        files, tok = [], None
        while True:
            u = ("https://www.googleapis.com/drive/v3/files?q=" + requests.utils.quote(q, safe="") + "&fields=nextPageToken,files(id,name)&pageSize=1000&key=" + gkey
                 + (f"&pageToken={tok}" if tok else ""))
            j = requests.get(u, timeout=30).json()
            if "error" in j:
                sys.exit("Drive API: " + j["error"].get("message", str(j["error"])) + " (the folder must be shared as 'anyone with the link')")
            files += j["files"]
            tok = j.get("nextPageToken")
            if not tok:
                return files

    fid = a.folder_id
    if not fid:
        top = drive_list("name='Rubber Band Review' and mimeType='application/vnd.google-apps.folder' and trashed=false")
        sub = drive_list(f"'{top[0]['id']}' in parents and name='previews' and mimeType='application/vnd.google-apps.folder' and trashed=false") if top else []
        if not sub:
            sys.exit("previews folder not found in Drive yet (still uploading, or not shared). Pass --folder-id.")
        fid = sub[0]["id"]
    in_drive = {f["name"]: f["id"] for f in drive_list(f"'{fid}' in parents and trashed=false")}
    linked = waiting = 0
    for r in rows:
        if not r.get("source_path"):
            continue
        pv, po = (f"{r['id']}.jpg", f"{r['id']}.thumb.jpg") if r["mime_type"].startswith("image/") else (f"{r['id']}.mp4", f"{r['id']}.jpg")
        body = {k: in_drive[n] for k, n in (("preview_drive_id", pv), ("poster_drive_id", po)) if n in in_drive and r.get(k) != in_drive[n]}
        if pv not in in_drive or po not in in_drive:
            waiting += 1
        if body:
            linked += 1
            print(("LINK " if a.apply else "would link ") + r["name"], list(body))
            if a.apply:
                patch("band_media_assets", "id=eq." + r["id"], body)
    print(f"\nlinked {linked}, still uploading/missing {waiting}, drive files {len(in_drive)}" + ("" if a.apply else "  (dry run; add --apply)"))


if __name__ == "__main__":
    main()
