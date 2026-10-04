"""Band reviewer v2: turn the bandmates' marks into files. Dry run is the default and prints the plan; --apply executes.
Never hard-deletes. Reads ONLY the shared band reviewer's marks. Needs 20261004-band-review-v2.sql applied.

    reject (video)  -> G:/Videos/_to_delete/band-review-<date>/<same path>   (+ _UNDO.csv, then asset.retired_at)
    reject (photo)  -> <Drive>/My Drive/Rubber Band Review/_to_delete/       (+ _UNDO.csv)
    keep/favorite   -> cut [trim_start, trim_end] from the ORIGINAL, per the "used for" ticks:
        use_broll   -> G:/Videos/01_BROLL/<prefix>_<shot|wide>_<subject|band>_<NNN>[_HERO].mp4  (+ _gig_subclips_map.csv)
        use_band    -> G:/Videos/03_GIGS/<gig>/_band/<stem>_<start>s.mp4 and <Drive>/.../For the band/<gig label>/
    keep/favorite photo: use_broll -> G:/Photos/Good Stills/band/, use_band -> <Drive>/.../For the band/Band photos/

    py scripts/finish-band-review.py                 # plan
    py scripts/finish-band-review.py --apply         # do it (idempotent: log keyed by asset id + revision)
    py scripts/finish-band-review.py --grade-check   # render one 3 s sample per gig into a temp folder
"""
import argparse, csv, datetime, io, json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
import requests

G = Path("G:/")
GIGS = G / "Videos/03_GIGS"
BROLL = G / "Videos/01_BROLL"
LOG = GIGS / "_review_finish_log.json"
BASE = "https://eibtnkaoqsgwiqttiwjo.supabase.co"
BAND = "00000000-0000-4000-8000-0000000b0a4d"  # the bandmates' shared reviewer
PREFIX = {"chiphi_9-12-26": "chiphi", "maw_9-11-26": "maw", "pikapp_8-26-26": "pikapp", "axo_bid_8-25-26": "axo"}
LABEL = {"pikapp_8-26-26": "Pi Kapp \u00b7 Aug 26", "axo_bid_8-25-26": "AXO bid \u00b7 Aug 25", "maw_9-11-26": "MAW \u00b7 Sep 11", "chiphi_9-12-26": "Chi Phi \u00b7 Sep 12"}
DRIVE_SUB = "My Drive/Rubber Band Review"
MIGRATION = "apply 20261004-band-review-v2.sql first"
BOM = b"\xef\xbb\xbf"
H264 = ["-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p"]


# ---- pure helpers (unit-tested in scripts/admin-tests/test_band_finish.py) -----------------------------------------------
def broll_counter(names):
    """Highest NNN already used in 01_BROLL. The counter is the 3-digit '_NNN_' token of the name, with an optional
    _HERO after it. Other digit runs are ignored on purpose: 'crowd_29_13s' (29 is a clip number, 13s a duration),
    'maw_wide_band_007_00090000' (007 is the counter, 00090000 an 8-digit frame stamp), 'Timeline 1'."""
    best = 0
    for n in names:
        stem = re.sub(r"\.[^.]+$", "", n)
        if stem.startswith("_"):
            continue
        for t in stem.split("_"):
            if re.fullmatch(r"\d{3}", t):
                best = max(best, int(t))
    return best


def slug(s, default):
    s = re.sub(r"[^a-z]", "", (s or "").lower())
    return s or default


def broll_name(prefix, shot, subject, n, hero):
    return f"{prefix}_{slug(shot, 'wide')}_{slug(subject, 'band')}_{n:03d}{'_HERO' if hero else ''}.mp4"


def num(x):
    return f"{x:.1f}".rstrip("0").rstrip(".") if x else "0"


def rng(start, end):
    return f"{num(start)}s-{num(end)}s" if end is not None else f"{num(start)}s-end"


def band_name(stem, start):
    return f"{stem}_{num(start)}s.mp4"


def tc(sec):
    ms = int(round(sec * 1000))
    return f"{ms // 3600000:02d}.{ms // 60000 % 60:02d}.{ms // 1000 % 60:02d}.{ms % 1000:03d}"


def map_source(stem, start, end):
    """Matches the existing _gig_subclips_map.csv sources: '<clip>-<HH.MM.SS.mmm>-<HH.MM.SS.mmm>.mp4'."""
    return f"{stem}-{tc(start or 0)}-{tc(end)}.mp4" if end is not None else f"{stem}-{tc(start or 0)}.mp4"


def undo_dest(source_path, date, root=G):
    """G:-relative path -> its place under _to_delete (same relative path, so undoing is a straight move back)."""
    return Path(root) / "Videos/_to_delete" / f"band-review-{date}" / source_path


def undo_row(src, dst):
    return [str(src).replace("/", "\\"), str(dst).replace("/", "\\")]  # existing G:/Videos/_UNDO_*.csv: "from","to", backslashes


def gig_folder(source_path):
    parts = source_path.split("/")
    return parts[2] if len(parts) > 3 and parts[:2] == ["Videos", "03_GIGS"] else None


def is_photo(asset):
    return asset["mime_type"].startswith("image/")


def find_drive_root(given=None):
    if given:
        return Path(given)
    for L in "HIJKLMNOPQRSTUVWXYZFED":
        if Path(f"{L}:/My Drive").is_dir():
            return Path(f"{L}:/")
    return None


def append_csv(path, rows, header=None):
    """Append rows keeping the file's existing BOM/CRLF; a new file gets a BOM and the header."""
    raw = path.read_bytes() if path.exists() else b""
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\r\n")
    if not raw and header:
        w.writerow(header)
    w.writerows(rows)
    lead = BOM if not raw else (b"" if raw.endswith(b"\n") else b"\r\n")
    path.write_bytes(raw + lead + buf.getvalue().encode("utf-8"))


def append_undo(path, rows):
    raw = path.read_bytes() if path.exists() else b""
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\r\n", quoting=csv.QUOTE_ALL)
    if not raw:
        w.writerow(["from", "to"])
    w.writerows(rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw + buf.getvalue().encode("utf-8"))


def ff(cmd):
    return subprocess.run(["ffmpeg", "-v", "error", "-y", *cmd], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)


def render(src, out, start, end, crf, preset, abr, cube_dir, max_h=None):
    """Accurate cut from the original: -ss before -i (frame accurate when re-encoding), then re-encode."""
    vf = []
    if cube_dir and (cube_dir / "_grade.cube").exists():
        vf.append("lut3d=_grade.cube")  # relative: ffmpeg runs in the gig folder, so no Windows drive-letter escaping
    if max_h:
        vf.append(f"scale=-2:'min({max_h},ih)'")
    cmd = []
    if start:
        cmd += ["-ss", str(start)]
    cmd += ["-i", str(src)]
    if end is not None:
        cmd += ["-t", str(max(0.1, end - (start or 0)))]
    if vf:
        cmd += ["-vf", ",".join(vf)]
    cmd += [*H264, "-crf", str(crf), "-preset", preset, "-c:a", "aac", "-b:a", abr, "-movflags", "+faststart", str(out) + ".part.mp4"]
    out.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", *cmd], cwd=cube_dir, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    part = Path(str(out) + ".part.mp4")
    if r.returncode:
        part.unlink(missing_ok=True)
        return r.stderr[-300:]
    os.replace(part, out)
    return None


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true"); ap.add_argument("--grade-check", action="store_true"); ap.add_argument("--drive-root"); ap.add_argument("--fixture")
    a = ap.parse_args()
    env = Path("C:/Users/coope/Desktop/Claude/Projects/personal-brand/factory/.env").read_text()
    key = re.search(r"^SUPABASE_SERVICE_KEY\s*=\s*(.+?)\s*$", env, re.M).group(1).strip("\"'")
    Hd = {"apikey": key, "Authorization": "Bearer " + key}
    root = find_drive_root(a.drive_root)
    today = datetime.date.today().isoformat()

    if a.grade_check:
        td = Path(tempfile.mkdtemp(prefix="band-grade-check-"))
        for folder in PREFIX:
            d = GIGS / folder
            clips = [p for p in sorted(d.iterdir()) if p.is_file() and not p.name.startswith("._") and p.suffix.lower() in (".mov", ".mp4")] if d.is_dir() else []
            if not clips:
                continue
            graded = (d / "_grade.cube").exists()
            err = render(clips[0], td / f"{folder}{'' if graded else '_UNGRADED'}.mp4", 0, 3, 18, "veryfast", "128k", d, 720)
            print(("ok  " if not err else "FAIL ") + folder, "graded" if graded else "no _grade.cube (ungraded)", err or "")
        print("Samples in", td)
        return

    def get(path):
        return requests.get(BASE + "/rest/v1/" + path, headers=Hd, timeout=30)

    if a.fixture:  # offline plan check: {"assets": [...], "marks": [...]} in the DB shapes
        fx = json.loads(Path(a.fixture).read_text(encoding="utf-8"))
        assets, marks = {x["id"]: x for x in fx["assets"]}, fx["marks"]
    else:
        r = get("band_media_assets?select=id,name,gig,mime_type,duration,source_path&retired_at=is.null&source_path=not.is.null&limit=2000")
        r2 = get(f"band_media_reviews?select=asset_id,revision,verdict,note,trim_start,trim_end,use_band,use_broll,shot,subject&reviewer=eq.{BAND}&limit=5000") if r.ok else None
        if not r.ok or not r2.ok:
            msg = f"band review columns missing -- {MIGRATION}"
            if a.apply:
                sys.exit("Refusing to write: " + msg)
            names = [p.name for p in BROLL.rglob("*") if p.is_file()] if BROLL.exists() else []
            print(f"DRY RUN | NOTE: {msg}. Nothing to plan yet.")
            print(f"Drive mount: {root or 'NOT FOUND'} | next B-roll number would be {broll_counter(names) + 1:03d} | gigs without _grade.cube: "
                  + (", ".join(f for f in PREFIX if not (GIGS / f / "_grade.cube").exists()) or "none"))
            return
        assets = {x["id"]: x for x in r.json()}
        marks = r2.json()
    marks = [m for m in marks if m["asset_id"] in assets]
    log = json.loads(LOG.read_text(encoding="utf-8")) if LOG.exists() else {}

    existing = [p.name for p in BROLL.rglob("*") if p.is_file()] if BROLL.exists() else []
    mapf = BROLL / "_gig_subclips_map.csv"
    if mapf.exists():
        existing += [row[1] for row in csv.reader(io.StringIO(mapf.read_text(encoding="utf-8-sig"))) if len(row) > 1]
    existing += [n for v in log.values() for n in v.get("broll", [])]
    counter = broll_counter(existing)

    stats = {"reject": 0, "cut_broll": 0, "cut_band": 0, "photo_copy": 0, "done_already": 0}
    skips, ungraded, outputs, needs_tick = [], set(), [], []
    unreviewed = len(assets) - len({m["asset_id"] for m in marks if m["verdict"] != "unreviewed"})
    undo_rows = {}  # undo csv path -> rows

    print(f"{'APPLY' if a.apply else 'DRY RUN'} | assets {len(assets)} | band marks {len(marks)} | Drive mount: {root or 'NOT FOUND'}")
    for m in sorted(marks, key=lambda m: assets[m["asset_id"]]["source_path"]):
        asset = assets[m["asset_id"]]
        sp, v = asset["source_path"], m["verdict"]
        if v == "unreviewed":
            continue
        prior = log.get(asset["id"])
        if prior and prior.get("revision") == m["revision"]:
            stats["done_already"] += 1
            continue
        photo, folder = is_photo(asset), gig_folder(sp)
        label = LABEL.get(folder, asset["gig"])
        src = (root / sp[len("drive:"):] if root else None) if sp.startswith("drive:") else G / sp
        if src is None:
            skips.append(f"{asset['name']}: needs the Drive mount"); continue
        if not src.exists():
            skips.append(f"{asset['name']}: original not found ({src})"); continue
        entry = {"revision": m["revision"], "verdict": v, "at": datetime.datetime.now().isoformat(timespec="seconds"), "broll": [], "outputs": []}
        steps = []  # (description, callable returning error|None)

        if v == "reject":
            if photo:
                dst = root / DRIVE_SUB / "_to_delete" / src.name if root else None
                ulog = root / DRIVE_SUB / "_to_delete" / "_UNDO.csv" if root else None
            else:
                dst = undo_dest(sp, today)
                ulog = G / "Videos/_to_delete" / f"band-review-{today}" / "_UNDO.csv"
            if dst is None:
                skips.append(f"{asset['name']}: rejected photo needs the Drive mount"); continue
            print(f"  REJECT  {asset['name']}  ->  {dst}")
            stats["reject"] += 1

            def do_move(src=src, dst=dst, ulog=ulog, photo=photo, aid=asset["id"]):
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(src), str(dst))
                append_undo(ulog, [undo_row(src, dst)])
                if not photo:
                    requests.patch(f"{BASE}/rest/v1/band_media_assets?id=eq.{aid}", headers={**Hd, "Prefer": "return=minimal"},
                                   json={"retired_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}, timeout=30).raise_for_status()
                return None
            steps.append(do_move)
        else:  # keep / favorite
            hero = v == "favorite"
            if not (m["use_band"] or m["use_broll"]):
                needs_tick.append(f"{asset['name']} ({v})"); continue
            start, end = m["trim_start"] or 0, m["trim_end"]
            if photo:
                if m["use_broll"]:
                    dst = G / "Photos/Good Stills/band" / src.name
                    print(f"  PHOTO   {asset['name']}  ->  {dst}"); stats["photo_copy"] += 1
                    steps.append(lambda s=src, d=dst: (d.parent.mkdir(parents=True, exist_ok=True), shutil.copy2(s, d), None)[2])
                if m["use_band"]:
                    dst = root / DRIVE_SUB / "For the band" / "Band photos" / src.name if root else Path("<DRIVE>") / "For the band/Band photos" / src.name
                    print(f"  PHOTO   {asset['name']}  ->  {dst}"); stats["photo_copy"] += 1
                    if root:
                        steps.append(lambda s=src, d=dst: (d.parent.mkdir(parents=True, exist_ok=True), shutil.copy2(s, d), None)[2])
                    else:
                        skips.append(f"{asset['name']}: band copy needs the Drive mount")
            else:
                cube_dir = GIGS / folder if folder else None
                if not (cube_dir and (cube_dir / "_grade.cube").exists()):
                    ungraded.add(folder or "?")
                stem = Path(asset["name"]).stem
                if m["use_broll"]:
                    n = None
                    if prior and prior.get("broll"):  # re-render of a newer revision keeps its counter
                        mm = re.search(r"_(\d{3})(?:_HERO)?\.mp4$", prior["broll"][0])
                        n = int(mm.group(1)) if mm else None
                    if n is None:
                        counter += 1
                        n = counter
                    name = broll_name(PREFIX.get(folder, slug(folder, "gig")), m["shot"], m["subject"], n, hero)
                    dst = BROLL / name
                    entry["broll"].append(name)
                    print(f"  B-ROLL  {asset['name']} [{rng(start, end)}]  ->  {name}"); stats["cut_broll"] += 1
                    end_tc = end if end is not None else asset["duration"]

                    def do_broll(src=src, dst=dst, start=start, end=end, cube_dir=cube_dir, stem=stem, end_tc=end_tc, prior=prior, name=name):
                        if prior and prior.get("broll") and prior["broll"][0] != name and (BROLL / prior["broll"][0]).exists():
                            os.replace(BROLL / prior["broll"][0], dst)  # favorite flipped: rename, then re-render over it
                        err = render(src, dst, start, end, 16, "slow", "320k", cube_dir)
                        if not err and not (prior and prior.get("broll") and prior["broll"][0] == name):
                            append_csv(mapf, [[map_source(stem, start, end_tc), name]], header=["source", "newname"])
                        return err
                    steps.append(do_broll)
                    outputs.append(str(dst))
                if m["use_band"]:
                    bn = band_name(stem, start)
                    dst = GIGS / folder / "_band" / bn
                    dd = root / DRIVE_SUB / "For the band" / label / bn if root else Path("<DRIVE>") / "For the band" / label / bn
                    print(f"  BAND    {asset['name']} [{rng(start, end)}]  ->  {dst}  +  {dd}"); stats["cut_band"] += 1
                    if not root:
                        skips.append(f"{asset['name']}: band copy to Drive needs the Drive mount")

                    def do_band(src=src, dst=dst, dd=dd, start=start, end=end, cube_dir=cube_dir):
                        err = render(src, dst, start, end, 18, "slow", "192k", cube_dir, 1080)
                        if not err and root:
                            dd.parent.mkdir(parents=True, exist_ok=True)
                            shutil.copy2(dst, dd)
                        return err
                    steps.append(do_band)
                    outputs.append(str(dst))

        if a.apply:
            errs = [e for e in (s() for s in steps) if e]
            if errs:
                skips.append(f"{asset['name']}: {errs[0]}"); print("  FAIL", asset["name"], errs[0]); continue
            log[asset["id"]] = entry
            LOG.write_text(json.dumps(log, indent=1), encoding="utf-8")

    print("\n== Summary ==")
    print(f"rejects {stats['reject']} | B-roll cuts {stats['cut_broll']} | band cuts {stats['cut_band']} | photo copies {stats['photo_copy']} | already done (same revision) {stats['done_already']} | not yet reviewed {unreviewed}")
    print(f"next B-roll number: {counter + 1:03d} (highest used so far {broll_counter(existing):03d})")
    print("ungraded gigs (no _grade.cube):", ", ".join(sorted(ungraded)) or "none")
    if needs_tick:
        print(f"needs a 'used for' tick ({len(needs_tick)}):", "; ".join(needs_tick))
    for s in skips:
        print("skip:", s)
    if not a.apply:
        print("Dry run only. Add --apply to execute.")


if __name__ == "__main__":
    main()
