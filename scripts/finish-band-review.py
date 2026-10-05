"""Band reviewer v2: turn the bandmates' marks into files. Dry run is the default and prints the plan; --apply executes.
Never hard-deletes and never overwrites: a taken destination gets a _2, _3 suffix, and a superseded output (a re-mark that renames it)
is moved into the same _to_delete tree with an UNDO row. Reads ONLY the shared band reviewer's marks. Needs 20261004-band-review-v2.sql applied.

    reject (video)  -> G:/Videos/_to_delete/band-review-<date>/<same path>   (+ _UNDO.csv, then asset.retired_at)
    reject (photo)  -> <Drive>/My Drive/Rubber Band Review/_to_delete/       (+ _UNDO.csv)
    reject (photo on G:) -> G:/Videos/_to_delete/band-review-<date>/<same path>: the ARW and any same-stem JPG (+ _UNDO.csv, then retired)
    keep/favorite photo on G: -> ARW (+ same-stem JPG) copied to G:/Photos/Gigs/<gig slug>/selects/; favorites and use_broll also get
        a copy in G:/Photos/Good Stills/band/; use_band also renders a full-size JPEG (q92) into <Drive>/.../For the band/<gig label>/
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
PHOTO_ROOTS = ("Videos/00_INBOX/", "Photos/")  # photo originals on G: may only live under these
GIG_PHOTOS = G / "Photos/Gigs"
STILLS = G / "Photos/Good Stills/band"
RAW = ".arw"
JPEGS = (".jpg", ".jpeg")
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


def gig_slug(label):
    """'Chi Phi \u00b7 Sep 12' -> 'chiphi-sep12'; 'Photos \u00b7 Sep 26' -> 'photos-sep26'."""
    parts = [re.sub(r"[^a-z0-9]", "", p.lower()) for p in re.split(r"[\u00b7|]", label or "")]
    return "-".join(p for p in parts if p) or "photos"


def photo_files(src):
    """The shot's files: the original plus any same-stem JPG next to a RAW. A JPG original has no siblings. The original comes first
    even when it is already gone (a re-run after a partial move)."""
    src = Path(src)
    out = [src]
    if src.suffix.lower() == RAW and src.parent.is_dir():
        out += sorted(q for q in src.parent.iterdir() if q.is_file() and q.stem == src.stem and q.suffix.lower() in JPEGS)
    return out


def photo_copy_plan(files, label, favorite, use_broll):
    """[(step kind, source, destination)] for a kept G: photo: selects always; the stills library for favorites and use_broll."""
    plan = [(f"select{i}", f, GIG_PHOTOS / gig_slug(label) / "selects" / f.name) for i, f in enumerate(files)]
    if favorite or use_broll:
        plan += [(f"still{i}", f, STILLS / f.name) for i, f in enumerate(files)]
    return plan


def photo_band_name(src):
    return Path(src).stem + ".jpg"


def render_photo(src, out):
    """Full-resolution JPEG for the band (magick decodes ARW). Never overwrites; written under .part so Drive never syncs half a file."""
    out = Path(out)
    if out.exists():
        return "refusing to overwrite " + str(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    part = out.with_name(out.stem + ".part.jpg")
    r = subprocess.run(["magick", str(src), "-auto-orient", "-quality", "92", str(part)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if r.returncode or not part.exists():
        part.unlink(missing_ok=True)
        return "magick: " + r.stderr[-300:]
    os.replace(part, out)
    return None


def rel_g(p):
    return Path(p).relative_to(G).as_posix()


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
    if out.exists():
        return "refusing to overwrite " + str(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", *cmd], cwd=cube_dir, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    part = Path(str(out) + ".part.mp4")
    if r.returncode:
        part.unlink(missing_ok=True)
        return r.stderr[-300:]
    os.replace(part, out)
    return None


def safe_rel(s):
    """A DB-supplied relative path: no '..', no absolute path, no drive letter, no backslashes, no empty parts."""
    return isinstance(s, str) and bool(s) and "\\" not in s and ":" not in s and not s.startswith("/") and all(p not in ("", ".", "..") for p in s.split("/"))


def safe_name(s):
    return isinstance(s, str) and bool(s) and s not in (".", "..") and not any(c in s for c in '/\\:*?"<>|')


def inside(path, base):
    p, b = os.path.normcase(os.path.realpath(path)), os.path.normcase(os.path.realpath(base))
    return p == b or p.startswith(b.rstrip("\\/") + os.sep)


def unique(path, taken=()):
    """First free name: path, then name_2, name_3 ... (never an existing file, never one already planned in this run)."""
    path = Path(path)
    cand, i = path, 2
    while cand.exists() or str(cand) in taken:
        cand = path.with_name(f"{path.stem}_{i}{path.suffix}")
        i += 1
    return cand


def needs_trim(duration, start, end, limit):
    """True when the clip is longer than `limit` seconds and no trim was set (so the output would be the whole clip)."""
    if duration is None or duration <= limit:
        return False
    trimmed = bool(start) or (end is not None and end < duration - 0.5)
    return not trimmed


def archive_dest(path, date, drive_root=None):
    """Where a superseded output goes: the same band-review-<date> tree. G: files keep their relative path; Drive files live under _drive/."""
    path = Path(path)
    tree = G / "Videos/_to_delete" / f"band-review-{date}"
    if inside(path, G):
        return tree / Path(os.path.realpath(path)).relative_to(os.path.realpath(G))
    if drive_root and inside(path, drive_root):
        return tree / "_drive" / Path(os.path.realpath(path)).relative_to(os.path.realpath(drive_root))
    return tree / "_other" / path.name


def safe_move(src, dst, undo_csv, taken=()):
    """Move without ever overwriting: a taken name gets _2, _3 ...; the UNDO row records the ACTUAL destination. Returns it."""
    dst = unique(dst, taken)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dst))
    append_undo(undo_csv, [undo_row(src, dst)])
    return dst


def safe_copy(src, dst, taken=()):
    dst = unique(dst, taken)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return dst


def upsert_map(rows, old, new, source):
    """_gig_subclips_map.csv rows (header first). Replace the row whose newname is `old` (a renamed output), else the row already
    named `new`, else append. Never a duplicate."""
    for r in rows[1:]:
        if len(r) > 1 and r[1] in (old, new):
            r[0], r[1] = source, new
            return rows
    return rows + [[source, new]]


def update_map_file(path, old, new, source):
    raw = path.read_bytes() if path.exists() else b""
    text = raw.decode("utf-8-sig")
    eol = "\r\n" if "\r\n" in text or not text else "\n"
    rows = [r for r in csv.reader(io.StringIO(text))] or [["source", "newname"]]
    rows = upsert_map(rows, old, new, source)
    buf = io.StringIO()
    csv.writer(buf, lineterminator=eol).writerows(rows)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes((BOM if (raw.startswith(BOM) or not raw) else b"") + buf.getvalue().encode("utf-8"))
    os.replace(tmp, path)


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

    def save_log():
        if a.apply:
            tmp = LOG.with_name(LOG.name + ".tmp")
            tmp.write_text(json.dumps(log, indent=1), encoding="utf-8")
            os.replace(tmp, LOG)

    existing = [p.name for p in BROLL.rglob("*") if p.is_file()] if BROLL.exists() else []
    mapf = BROLL / "_gig_subclips_map.csv"
    if mapf.exists():
        existing += [row[1] for row in csv.reader(io.StringIO(mapf.read_text(encoding="utf-8-sig"))) if len(row) > 1]
    counter = max([broll_counter(existing)] + [e.get("counter", 0) for e in log.values()])
    top_before = counter

    stats = {"reject": 0, "cut_broll": 0, "cut_band": 0, "photo_copy": 0, "archived": 0, "done_already": 0}
    pending, errors, needs_tick, needs_trim_l, ungraded = [], [], [], [], set()
    taken = set()  # destinations planned or used in this run, so two assets never aim at one name
    unreviewed = len(assets) - len({m["asset_id"] for m in marks if m["verdict"] != "unreviewed"})
    ulog_tree = G / "Videos/_to_delete" / f"band-review-{today}" / "_UNDO.csv"
    print(f"{'APPLY' if a.apply else 'DRY RUN'} | assets {len(assets)} | band marks {len(marks)} | Drive mount: {root or 'NOT FOUND'}")

    def resolve(asset):
        """(src, error). Guards every path built from DB values."""
        sp, name = asset["source_path"], asset["name"]
        if not safe_name(name):
            return None, "unsafe asset name"
        if sp.startswith("drive:"):
            rel = sp[len("drive:"):]
            if not is_photo(asset):
                return None, "video source in Drive is not supported"
            if not safe_rel(rel):
                return None, "unsafe source_path"
            if not root:
                return None, "needs the Drive mount"
            src = root / rel
            return (src, None) if inside(src, root) else (None, "source_path escapes the Drive mount")
        if is_photo(asset):
            if not (safe_rel(sp) and sp.startswith(PHOTO_ROOTS)):
                return None, "photo source must be under G:/Videos/00_INBOX/ or G:/Photos/ (or in Drive)"
            src = G / sp
            if not any(inside(src, G / r) for r in PHOTO_ROOTS):
                return None, "source_path escapes the photo folders"
            return src, None
        if not (safe_rel(sp) and sp.startswith("Videos/03_GIGS/") and gig_folder(sp)):
            return None, "unsafe source_path"
        src = G / sp
        return (src, None) if inside(src, GIGS) else (None, "source_path escapes G:/Videos/03_GIGS")

    for m in sorted(marks, key=lambda m: assets[m["asset_id"]]["source_path"]):
        asset = assets[m["asset_id"]]
        v = m["verdict"]
        if v == "unreviewed":
            continue
        prior = log.get(asset["id"]) or {}
        if prior.get("revision") == m["revision"] and prior.get("done"):
            stats["done_already"] += 1
            continue
        name = asset["name"]
        try:
            src, err = resolve(asset)
            if err:
                pending.append(f"{name}: {err}"); continue
            photo, folder = is_photo(asset), gig_folder(asset["source_path"])
            gphoto = photo and not asset["source_path"].startswith("drive:")
            label = LABEL.get(folder, asset["gig"])
            same = prior.get("revision") == m["revision"]
            cur = prior if same else {"revision": m["revision"], "verdict": v, "steps": {}, "counter": prior.get("counter")}
            old_steps = prior.get("steps", {}) if not same else {}  # outputs of an earlier revision, to supersede
            cur["verdict"] = v
            before = len(pending) + len(errors) + len(needs_trim_l)
            n_planned = n_ok = 0  # outputs intended vs outputs that exist when we finish

            def step(kind, base, make, how, post=None):
                """One output. Skip if this revision already produced it; archive the previous revision's file; never overwrite."""
                nonlocal n_planned, n_ok
                n_planned += 1
                done = cur["steps"].get(kind)
                if done and Path(done["dst"]).exists():
                    n_ok += 1
                    if post and not done.get("post"):
                        post(done, old_steps.get(kind))
                        done["post"] = True; save_log()
                    return
                prev = (old_steps.get(kind) or {}).get("dst")
                dst = unique(base, taken)
                taken.add(str(dst))
                print(f"  {how:7} {name}  ->  {dst}" + (f"   (supersedes {prev})" if prev and Path(prev).exists() else ""))
                if not a.apply:
                    return
                if prev and Path(prev).exists():
                    ad = safe_move(prev, archive_dest(prev, today, root), ulog_tree)
                    stats["archived"] += 1
                    print(f"          archived previous output -> {ad}")
                    dst = unique(base)  # the archive freed the old name; re-pick against the disk
                err2 = make(dst)
                if err2:
                    errors.append(f"{name}: {kind}: {err2}"); return
                rec = {"dst": str(dst)}
                cur["steps"][kind] = rec
                log[asset["id"]] = cur; save_log()  # progress is persisted right after each successful step
                n_ok += 1
                if post:
                    post(rec, old_steps.get(kind)); rec["post"] = True; save_log()

            if v == "reject":
                stats["reject"] += 1
                if gphoto:  # the RAW and its same-stem JPG travel together
                    moves = [("move" if i == 0 else f"move{i}", q, undo_dest(rel_g(q), today), ulog_tree) for i, q in enumerate(photo_files(src))]
                elif photo:
                    if not root:
                        pending.append(f"{name}: rejected photo needs the Drive mount"); continue
                    moves = [("move", src, root / DRIVE_SUB / "_to_delete" / src.name, root / DRIVE_SUB / "_to_delete" / "_UNDO.csv")]
                else:
                    moves = [("move", src, undo_dest(asset["source_path"], today), ulog_tree)]
                for mkey, msrc, base, ulog in moves:
                    rec = cur["steps"].get(mkey)
                    n_planned += 1
                    if not msrc.exists():  # already moved (earlier run died before the retire): trust the recorded or default destination
                        gone = Path(rec["dst"]) if rec else base
                        if not gone.exists():
                            pending.append(f"{name}: original missing and no moved copy found"); continue
                        print(f"  REJECT  {msrc.name}  already moved -> {gone}")
                        n_ok += 1
                    else:
                        dst = unique(base, taken); taken.add(str(dst))
                        print(f"  REJECT  {msrc.name}  ->  {dst}")
                        if a.apply:
                            dst = safe_move(msrc, dst, ulog)
                            cur["steps"][mkey] = {"dst": str(dst)}; log[asset["id"]] = cur; save_log()
                            n_ok += 1
                if a.apply and n_ok == n_planned:
                    requests.patch(f"{BASE}/rest/v1/band_media_assets?id=eq.{asset['id']}", headers={**Hd, "Prefer": "return=minimal"},
                                   json={"retired_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}, timeout=30).raise_for_status()
            else:
                if not gphoto and not (m.get("use_band") or m.get("use_broll")):  # a kept G: photo always goes to selects
                    needs_tick.append(f"{name} ({v})"); continue
                hero = v == "favorite"
                start, end = m.get("trim_start") or 0, m.get("trim_end")
                if gphoto:
                    label = asset["gig"]
                    files = [q for q in photo_files(src) if q.exists()]
                    if not files:
                        pending.append(f"{name}: original missing"); continue
                    for kind, fsrc, fdst in photo_copy_plan(files, label, hero, m.get("use_broll")):
                        stats["photo_copy"] += 1
                        step(kind, fdst, lambda d, fsrc=fsrc: safe_copy(fsrc, d) and None, "PHOTO")
                    if m.get("use_band"):
                        if root:
                            stats["photo_copy"] += 1
                            step("photo_band", root / DRIVE_SUB / "For the band" / label / photo_band_name(src), lambda d: render_photo(src, d), "RENDER")
                        else:
                            pending.append(f"{name}: band photo render needs the Drive mount")
                elif photo:
                    if m.get("use_broll"):
                        stats["photo_copy"] += 1
                        step("photo_broll", G / "Photos/Good Stills/band" / src.name, lambda d: safe_copy(src, d) and None, "PHOTO")
                    if m.get("use_band"):
                        if root:
                            stats["photo_copy"] += 1
                            step("photo_band", root / DRIVE_SUB / "For the band/Band photos" / src.name, lambda d: safe_copy(src, d) and None, "PHOTO")
                        else:
                            pending.append(f"{name}: band photo copy needs the Drive mount")
                else:
                    cube_dir = GIGS / folder
                    if not (cube_dir / "_grade.cube").exists():
                        ungraded.add(folder)
                    stem, dur = Path(name).stem, asset.get("duration")
                    if m.get("use_broll"):
                        if needs_trim(dur, start, end, 60):
                            needs_trim_l.append(f"{name} (B-roll, {dur:.0f}s)")
                        else:
                            if cur.get("counter") is None:  # reserve the number now and persist it, so a retry reuses it
                                counter += 1
                                cur["counter"] = counter
                                log[asset["id"]] = cur; save_log()
                            bname = broll_name(PREFIX.get(folder, slug(folder, "gig")), m.get("shot"), m.get("subject"), cur["counter"], hero)
                            end_tc = end if end is not None else dur
                            stats["cut_broll"] += 1

                            def post_map(rec, prev, stem=stem, start=start, end_tc=end_tc):
                                old = Path(prev["dst"]).name if prev else None
                                update_map_file(mapf, old, Path(rec["dst"]).name, map_source(stem, start, end_tc))
                            step("broll", BROLL / bname, lambda d: render(src, d, start, end, 16, "slow", "320k", cube_dir), "B-ROLL", post_map)
                    if m.get("use_band"):
                        if needs_trim(dur, start, end, 600):
                            needs_trim_l.append(f"{name} (band, {dur:.0f}s)")
                        else:
                            bn = band_name(stem, start)
                            stats["cut_band"] += 1
                            step("band", GIGS / folder / "_band" / bn, lambda d: render(src, d, start, end, 18, "slow", "192k", cube_dir, 1080), "BAND")
                            if not root:
                                pending.append(f"{name}: band copy to Drive needs the Drive mount")
                            elif a.apply and "band" not in cur["steps"]:
                                pending.append(f"{name}: Drive copy waits for the local band cut")
                            else:
                                lb = Path(cur["steps"]["band"]["dst"]).name if "band" in cur["steps"] else bn  # copy keeps the local file's real name
                                step("band_drive", root / DRIVE_SUB / "For the band" / label / lb,
                                     lambda d: safe_copy(Path(cur["steps"]["band"]["dst"]), d) and None, "COPY")

            clean = len(pending) + len(errors) + len(needs_trim_l) == before
            if a.apply and n_planned and n_ok == n_planned and clean:
                cur["done"] = True
                cur["at"] = datetime.datetime.now().isoformat(timespec="seconds")
                log[asset["id"]] = cur; save_log()
            elif n_planned and n_ok < n_planned and a.apply:
                pending.append(f"{name}: {n_planned - n_ok} output(s) not written yet")
        except Exception as e:  # PermissionError (file open in Resolve), network, etc.: note it and carry on with the next asset
            errors.append(f"{name}: {type(e).__name__}: {e}")
            print("  ERROR  ", name, type(e).__name__, e)

    print("\n== Summary ==")
    print(f"rejects {stats['reject']} | B-roll cuts {stats['cut_broll']} | band cuts {stats['cut_band']} | photo copies {stats['photo_copy']} | "
          f"superseded outputs archived {stats['archived']} | already done (same revision) {stats['done_already']} | not yet reviewed {unreviewed}")
    print(f"next B-roll number: {counter + 1:03d} (highest used so far {top_before:03d})")
    print("ungraded gigs (no _grade.cube):", ", ".join(sorted(ungraded)) or "none")
    for title, items in (("needs a 'used for' tick", needs_tick), ("needs a trim (B-roll over 60s, band over 600s)", needs_trim_l)):
        if items:
            print(f"{title} ({len(items)}):", "; ".join(items))
    for s in pending:
        print("pending:", s)
    for s in errors:
        print("ERROR:", s)
    if not a.apply:
        print("Dry run only. Add --apply to execute.")


if __name__ == "__main__":
    main()
