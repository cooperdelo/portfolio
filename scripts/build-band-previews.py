"""Band reviewer v2: build Drive-hosted previews for every band clip/photo and record them in the DB.
Needs 20261004-band-review-v2.sql applied (source_path, preview_drive_id, poster_drive_id). Originals are never touched.
Dry run is the default; nothing is written to the DB, G: or Drive until --apply.

    py scripts/build-band-previews.py                              # plan: scan G:, match DB rows, list previews to encode
    py scripts/build-band-previews.py --photos-dir "H:/My Drive/Band"   # also plan photos whose name contains 'band'
    py scripts/build-band-previews.py --photos-from "G:/Videos/00_INBOX/2026-10-04_a7c2"   # plan camera RAW/JPG photos (one asset per shot)
    py scripts/build-band-previews.py --apply --jobs 2             # insert/normalise rows, retire stale ones, encode into Drive
    py scripts/build-band-previews.py --link --apply --folder-id <previews folder id>   # after Drive for Desktop uploads: record preview/poster ids
"""
import argparse, collections, datetime, os, re, struct, subprocess, sys
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
RAW = ".arw"
PHOTO_ROOTS = ("Videos/00_INBOX", "Photos")  # same roots finish-band-review.py accepts for G: photos
SHOT_EXT = (RAW, ".jpg", ".jpeg")
GIG_DATES = {"2026-08-25": "AXO bid \u00b7 Aug 25", "2026-08-26": "Pi Kapp \u00b7 Aug 26", "2026-09-11": "MAW \u00b7 Sep 11", "2026-09-12": "Chi Phi \u00b7 Sep 12", "2026-09-26": "Phi Mu \u00b7 Sep 26", "2026-10-02": "DZ State \u00b7 Oct 2"}
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


def date_label(d):
    """Gig label for a shot date (datetime.date): a known gig's label, else 'Photos \u00b7 Sep 26' (no leading zero)."""
    return GIG_DATES.get(d.isoformat()) or f"Photos \u00b7 {d.strftime('%b')} {d.day}"


def parse_exif_date(s):
    """'2026:09:26 16:56:44' -> date, or None."""
    m = re.match(r"\s*(\d{4}):(\d{2}):(\d{2})", s or "")
    try:
        return datetime.date(int(m[1]), int(m[2]), int(m[3])) if m else None
    except ValueError:
        return None


def pair_shots(paths):
    """One shot per stem: [(original, jpg_sidecar_or_None)]. An ARW is the original and a same-stem JPG its sidecar; a JPG alone is its own original."""
    by = collections.defaultdict(list)
    for p in paths:
        n = Path(p).name
        if not n.startswith("._") and not n.endswith(".partial") and Path(p).suffix.lower() in SHOT_EXT:
            by[Path(p).stem.lower()].append(Path(p))
    out = []
    for stem in sorted(by):
        raws = [p for p in by[stem] if p.suffix.lower() == RAW]
        jpgs = [p for p in by[stem] if p.suffix.lower() != RAW]
        out.append((raws[0], jpgs[0] if jpgs else None) if raws else (jpgs[0], None))
    return out


def tiff_date(path):
    """DateTimeOriginal from a TIFF-based RAW (ARW). ImageMagick does not expose ARW EXIF, so read IFD0 -> Exif IFD directly."""
    try:
        with open(path, "rb") as f:
            h = f.read(8)
            e = "<" if h[:2] == b"II" else ">" if h[:2] == b"MM" else None
            if not e or struct.unpack(e + "H", h[2:4])[0] != 42:
                return None

            def ifd(off):
                f.seek(off)
                n = struct.unpack(e + "H", f.read(2))[0]
                return {t: (ty, c, v) for t, ty, c, v in (struct.unpack(e + "HHI4s", f.read(12)) for _ in range(n))}

            def asc(t):
                ty, c, v = t
                if ty != 2:
                    return None
                if c <= 4:
                    return v[:c].rstrip(b"\0").decode("ascii", "replace")
                f.seek(struct.unpack(e + "I", v)[0])
                return f.read(c).rstrip(b"\0").decode("ascii", "replace")

            i0 = ifd(struct.unpack(e + "I", h[4:8])[0])
            if 0x8769 in i0:
                ex = ifd(struct.unpack(e + "I", i0[0x8769][2])[0])
                for t in (0x9003, 0x9004):
                    if t in ex:
                        return parse_exif_date(asc(ex[t]))
            return parse_exif_date(asc(i0[306])) if 306 in i0 else None
    except Exception:
        return None


def magick_dates(paths, batch=40):
    """{path: date} via ImageMagick (`magick identify`, several files per call). Works for JPG; ImageMagick does not expose ARW EXIF."""
    out = {}
    for i in range(0, len(paths), batch):
        chunk = paths[i:i + batch]
        try:
            txt = subprocess.run(["magick", "identify", "-format", "%f|%[EXIF:DateTimeOriginal]\n", *[str(p) + "[0]" for p in chunk]],
                                 capture_output=True, text=True, timeout=300).stdout
        except Exception:
            continue
        got = {}
        for line in txt.splitlines():
            name, _, val = line.partition("|")
            d = parse_exif_date(val)
            if d:
                got.setdefault(name, d)
        out.update({p: got[p.name] for p in chunk if p.name in got})
    return out


def shot_dates(shots):
    """{original: date}: EXIF DateTimeOriginal (ARW via TIFF parse, JPG via ImageMagick), falling back to the file's mtime."""
    orig = [o for o, _ in shots]
    dates = {o: tiff_date(o) for o in orig if o.suffix.lower() == RAW}
    dates.update(magick_dates([o for o in orig if o.suffix.lower() != RAW]))
    return {o: dates.get(o) or datetime.date.fromtimestamp(o.stat().st_mtime) for o in orig}


def check_photos_dir(path):
    """Error message, or None when `path` is an existing folder on G: under Videos/00_INBOX/ or Photos/ (what finish-band-review accepts)."""
    p = Path(path)
    if not p.is_dir():
        return f"--photos-from: not a folder: {path}"
    try:
        rel = Path(os.path.realpath(p)).relative_to(os.path.realpath(G)).as_posix()
    except ValueError:
        return f"--photos-from must be on G: (got {path})"
    if not any(rel == r or rel.startswith(r + "/") for r in PHOTO_ROOTS):
        return f"--photos-from must be under G:/Videos/00_INBOX/ or G:/Photos/ (got {path})"
    return None


def is_gig_date(d):
    return d.isoformat() in GIG_DATES


def skipped_summary(dates):
    """'Aug 17 (2), Sep 9 (1)' for the dates of skipped shots, in date order."""
    c = collections.Counter(dates)
    return ", ".join(f"{d.strftime('%b')} {d.day} ({n})" for d, n in sorted(c.items()))


def scan_shots(folder):
    d = Path(folder)
    return pair_shots([p for p in sorted(d.iterdir()) if p.is_file()]) if d.is_dir() else []


def photo_mime(p):
    return "image/x-sony-arw" if Path(p).suffix.lower() == RAW else "image/jpeg"


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


def encode_raw(src, out, thumb):
    """ImageMagick decodes ARW. Written under a .part name so Drive never uploads a half-written final file; the thumb is made from the preview."""
    if not out.exists():
        part = out.with_name(out.stem + ".part.jpg")
        r = run(["magick", str(src), "-auto-orient", "-resize", "1600x1600>", "-quality", "82", str(part)])
        if r.returncode or not part.exists():
            part.unlink(missing_ok=True)
            return "magick: " + r.stderr[-200:]
        os.replace(part, out)
    if not thumb.exists():
        part = thumb.with_name(thumb.stem + ".part.jpg")
        r = run(["magick", str(out), "-auto-orient", "-resize", "480x480>", "-quality", "80", str(part)])
        if r.returncode or not part.exists():
            part.unlink(missing_ok=True)
            return "magick: " + r.stderr[-200:]
        os.replace(part, thumb)
    return None


def encode_photo(src, out, thumb):
    if Path(src).suffix.lower() == RAW:
        return encode_raw(src, out, thumb)
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
    ap.add_argument("--include-other-dates", action="store_true", help="also import --photos-from shots whose date is not a known gig date (default: skip them)")
    ap.add_argument("--photos-from", help="folder of camera photos (.ARW/.JPG, not recursive): one asset per shot, gig label from the shot date")
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
    photo_new = [{"path": p, "sp": sp, "mime": "image/jpeg", "gig": PHOTOS} for p, sp in photos]
    shot_info = []  # (original, jpg sidecar, date, label) for --photos-from
    skipped = []
    if a.photos_from:
        bad = check_photos_dir(a.photos_from)
        if bad:
            sys.exit(bad)
        shots = scan_shots(a.photos_from)
        dates = shot_dates(shots)
        skipped = [dates[o] for o, j in shots if not is_gig_date(dates[o]) and not a.include_other_dates]
        for o, j in shots:
            if not is_gig_date(dates[o]) and not a.include_other_dates:
                continue
            shot_info.append((o, j, dates[o], date_label(dates[o])))
            photo_new.append({"path": o, "sp": rel_g(o), "mime": photo_mime(o), "gig": date_label(dates[o])})
    photo_all = list(photo_new)
    have_sp = {r.get("source_path") for r in rows}
    photo_new = [x for x in photo_new if x["sp"] not in have_sp]

    print(f"DB rows: {len(rows)} active | G: gig files: {len(vids)} | Drive mount: {root or 'NOT FOUND (placeholder <DRIVE>)'}")
    out_dir = (root or Path("<DRIVE>")) / OUT_SUB
    print("Previews folder:", out_dir)
    for r, f, p in plan_update:
        print(f"  match   {r['gig']!r:34} {r['name']:44} -> {rel_g(p)}  gig={FOLDERS[f]!r}")
    for r in retire:
        print(f"  RETIRE  {r['gig']!r:34} {r['name']:44} (no original on G:; already-cut B-roll)")
    for x in plan_insert:
        print(f"  insert  {FOLDERS[x['folder']]!r:34} {x['path'].name:44} local:{rel_g(x['path'])}")
    for x in photo_new:
        if not x["sp"].startswith("Videos/00_INBOX/"):
            print(f"  photo   {x['gig']!r:34} {x['path'].name:44} {x['sp']}")
    if a.photos_from:
        new_sp = {x["sp"] for x in photo_new}
        mine = [t for t in shot_info if rel_g(t[0]) in new_sp]
        raws = sum(1 for t in shot_info if t[0].suffix.lower() == RAW)
        print(f"\nPhotos in {a.photos_from}: {len(shot_info)} gig shots ({raws} ARW originals, {len(shot_info) - raws} JPG-only, "
              f"{sum(1 for t in shot_info if t[1] and t[0].suffix.lower() == RAW)} ARW+JPG pairs) | new {len(mine)}, already in DB {len(shot_info) - len(mine)}")
        for (lbl, d), n in sorted(collections.Counter((t[3], t[2].isoformat()) for t in mine).items(), key=lambda kv: kv[0][1]):
            print(f"  {lbl!r:30} {d}  {n}")
        if skipped:
            print(f"skipped {len(skipped)} shots from non-gig dates: {skipped_summary(skipped)} -- add --include-other-dates to import them")
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
    ins += [{"drive_file_id": "local:" + x["sp"], "name": x["path"].name, "gig": x["gig"], "mime_type": x["mime"], "source_path": x["sp"]} for x in photo_new]
    if ins:
        r = requests.post(BASE + "/rest/v1/band_media_assets", headers={**H, "Prefer": "return=representation"}, json=ins, timeout=60)
        r.raise_for_status()
        paths = {("local:" + rel_g(x["path"])): x["path"] for x in plan_insert} | {("local:" + x["sp"]): x["path"] for x in photo_new}
        for row in r.json():
            jobs.append((row["id"], paths[row["drive_file_id"]], row["mime_type"].startswith("image/")))
    new_ids = {j[0] for j in jobs}
    scanned = {x["sp"]: x["path"] for x in photo_all}
    for r in rows:  # photos already in the DB whose previews were never (fully) built
        if r["mime_type"].startswith("image/") and r.get("source_path") in scanned and r["id"] not in new_ids:
            jobs.append((r["id"], scanned[r["source_path"]], True))
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
    if any(r["gig"] != FOLDERS[f] for r, f, p in plan_update) or plan_insert or photo_new:
        print("Gig labels changed — mint bandmate links after this run.")


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
                sys.exit("Drive API: " + j["error"].get("message", str(j["error"])) + " (the folder must be shared as 'anyone with the link')"
                         + ("" if a.folder_id else ". Name queries with an API key are refused by Google: pass --folder-id <id of the previews folder>"))
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
