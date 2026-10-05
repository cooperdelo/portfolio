"""Pure-helper tests for scripts/finish-band-review.py. Run: py scripts/admin-tests/test_band_finish.py"""
import importlib.util, unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("finish", Path(__file__).resolve().parents[1] / "finish-band-review.py")
f = importlib.util.module_from_spec(spec)
spec.loader.exec_module(f)
bspec = importlib.util.spec_from_file_location("build", Path(__file__).resolve().parents[1] / "build-band-previews.py")
b = importlib.util.module_from_spec(bspec)
bspec.loader.exec_module(b)


class Counter(unittest.TestCase):
    def test_real_names(self):
        names = ["houseshow_lowangle_band_blue_104.mp4", "gig2_wide_crowd_096.mov", "houseshow_static_crowd_29_13s_HERO.mp4",
                 "maw_wide_band_007_00090000.mp4", "patio_wide_band_05_13s.mp4", "Timeline 1", "chiphi_lowangle_me_038_HERO.mov", "campus_selfie_me_049.mov"]
        self.assertEqual(f.broll_counter(names), 104)

    def test_ignores_frame_stamps_durations_and_underscore_files(self):
        self.assertEqual(f.broll_counter(["maw_wide_crowd_006_00090617.mp4", "x_29_13s.mp4", "_rename_map3.csv", "b_12.mp4"]), 6)
        self.assertEqual(f.broll_counter([]), 0)
        self.assertEqual(f.broll_counter(["_hidden_500.mp4"]), 0)

    def test_hero_suffix(self):
        self.assertEqual(f.broll_counter(["a_wide_band_105_HERO.mp4"]), 105)


class Naming(unittest.TestCase):
    def test_broll_name(self):
        self.assertEqual(f.broll_name("chiphi", "lowangle", "singer", 106, True), "chiphi_lowangle_singer_106_HERO.mp4")
        self.assertEqual(f.broll_name("maw", None, "", 7, False), "maw_wide_band_007.mp4")
        self.assertEqual(f.broll_name("axo", "Close Up!", "Lead-Singer", 12, False), "axo_closeup_leadsinger_012.mp4")

    def test_band_name(self):
        self.assertEqual(f.band_name("V1-0001_C0309", 12.5), "V1-0001_C0309_12.5s.mp4")
        self.assertEqual(f.band_name("santeria", 0), "santeria_0s.mp4")
        self.assertEqual(f.band_name("santeria", 30.0), "santeria_30s.mp4")

    def test_map_source_matches_existing_style(self):
        self.assertEqual(f.map_source("poolhouse_solo", 7.28, 12.811), "poolhouse_solo-00.00.07.280-00.00.12.811.mp4")
        self.assertEqual(f.tc(3725.5), "01.02.05.500")


class Undo(unittest.TestCase):
    def test_dest_keeps_relative_path(self):
        sp = "Videos/03_GIGS/chiphi_9-12-26/V1-0002_C0309.mp4"
        self.assertEqual(f.undo_dest(sp, "2026-10-04").as_posix(), "G:/Videos/_to_delete/band-review-2026-10-04/" + sp)

    def test_row_uses_backslashes_like_existing_undo_csvs(self):
        self.assertEqual(f.undo_row(Path("G:/a/b.mp4"), Path("G:/Videos/_to_delete/x/b.mp4")), [r"G:\a\b.mp4", r"G:\Videos\_to_delete\x\b.mp4"])

    def test_gig_folder(self):
        self.assertEqual(f.gig_folder("Videos/03_GIGS/maw_9-11-26/a.mp4"), "maw_9-11-26")
        self.assertIsNone(f.gig_folder("drive:My Drive/x.jpg"))


class Safety(unittest.TestCase):
    def test_unique_and_safe_move_never_overwrite(self):
        import csv, tempfile
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            (td / "a.jpg").write_text("A"); (td / "b.jpg").write_text("B"); (td / "c.jpg").write_text("C")
            (td / "dst").mkdir(); (td / "dst" / "x.jpg").write_text("OLD")
            ulog = td / "_UNDO.csv"
            d1 = f.safe_move(td / "a.jpg", td / "dst" / "x.jpg", ulog)
            d2 = f.safe_move(td / "b.jpg", td / "dst" / "x.jpg", ulog)
            d3 = f.safe_copy(td / "c.jpg", td / "dst" / "x.jpg")
            self.assertEqual([d1.name, d2.name, d3.name], ["x_2.jpg", "x_3.jpg", "x_4.jpg"])
            self.assertEqual((td / "dst" / "x.jpg").read_text(), "OLD")
            rows = list(csv.reader(ulog.read_text().splitlines()))
            self.assertEqual(rows[0], ["from", "to"])
            self.assertTrue(rows[1][1].endswith("x_2.jpg") and rows[2][1].endswith("x_3.jpg"))  # actual destinations recorded

    def test_unique_respects_planned_names(self):
        self.assertEqual(f.unique(Path("G:/no/such/a.mp4"), {str(Path("G:/no/such/a.mp4"))}).name, "a_2.mp4")

    def test_path_guards(self):
        for bad in ("../x", "Videos/../x", "/abs", "C:/x", "a\\b", "", "a//b", "Videos/./x"):
            self.assertFalse(f.safe_rel(bad), bad)
        self.assertTrue(f.safe_rel("Videos/03_GIGS/maw_9-11-26/a b.mp4"))
        self.assertFalse(f.safe_name("..")); self.assertFalse(f.safe_name("a/b.mp4")); self.assertTrue(f.safe_name("V1-0001_C0309.mp4"))
        self.assertTrue(f.inside("G:/Videos/03_GIGS/x/a.mp4", f.GIGS))
        self.assertFalse(f.inside("G:/Videos/03_GIGS/../01_BROLL/a.mp4", f.GIGS))

    def test_needs_trim(self):
        self.assertTrue(f.needs_trim(1792, 0, None, 60))
        self.assertFalse(f.needs_trim(1792, 12, 40, 60))
        self.assertFalse(f.needs_trim(1792, 0, 30, 60))
        self.assertFalse(f.needs_trim(45, 0, None, 60))
        self.assertTrue(f.needs_trim(1792, 0, 1792, 600))  # "trimmed" to the whole clip is still untrimmed
        self.assertFalse(f.needs_trim(None, 0, None, 60))

    def test_map_upsert_renames_row_instead_of_duplicating(self):
        rows = [["source", "newname"], ["a.mp4", "x_wide_band_101.mp4"], ["b.mp4", "x_wide_band_102.mp4"]]
        out = f.upsert_map([r[:] for r in rows], "x_wide_band_102.mp4", "x_wide_band_102_HERO.mp4", "b2.mp4")
        self.assertEqual(out[2], ["b2.mp4", "x_wide_band_102_HERO.mp4"]); self.assertEqual(len(out), 3)
        self.assertEqual(len(f.upsert_map([r[:] for r in rows], None, "x_wide_band_103.mp4", "c.mp4")), 4)
        self.assertEqual(len(f.upsert_map([r[:] for r in rows], None, "x_wide_band_101.mp4", "a2.mp4")), 3)

    def test_map_file_keeps_bom_and_crlf(self):
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "m.csv"
            p.write_bytes(b"\xef\xbb\xbfsource,newname\r\na.mp4,n_101.mp4\r\n")
            f.update_map_file(p, "n_101.mp4", "n_101_HERO.mp4", "a.mp4")
            f.update_map_file(p, None, "n_102.mp4", "b.mp4")
            self.assertEqual(p.read_bytes(), b"\xef\xbb\xbfsource,newname\r\na.mp4,n_101_HERO.mp4\r\nb.mp4,n_102.mp4\r\n")

    def test_archive_dest_same_tree(self):
        d = f.archive_dest("G:/Videos/03_GIGS/axo_bid_8-25-26/_band/s_0s.mp4", "2026-10-04")
        self.assertEqual(d.as_posix(), "G:/Videos/_to_delete/band-review-2026-10-04/Videos/03_GIGS/axo_bid_8-25-26/_band/s_0s.mp4")


class Photos(unittest.TestCase):
    def test_date_to_label(self):
        import datetime as dt
        self.assertEqual(b.date_label(dt.date(2026, 8, 25)), "AXO bid · Aug 25")
        self.assertEqual(b.date_label(dt.date(2026, 8, 26)), "Pi Kapp · Aug 26")
        self.assertEqual(b.date_label(dt.date(2026, 9, 11)), "MAW · Sep 11")
        self.assertEqual(b.date_label(dt.date(2026, 9, 12)), "Chi Phi · Sep 12")
        self.assertEqual(b.date_label(dt.date(2026, 9, 26)), "Phi Mu · Sep 26")
        self.assertEqual(b.date_label(dt.date(2026, 10, 2)), "DZ State · Oct 2")
        self.assertEqual(b.date_label(dt.date(2026, 10, 3)), "Photos · Oct 3")  # no leading zero
        self.assertEqual(b.date_label(dt.date(2026, 9, 9)), "Photos · Sep 9")

    def test_exif_date_parse(self):
        import datetime as dt
        self.assertEqual(b.parse_exif_date("2026:09:26 16:56:44"), dt.date(2026, 9, 26))
        self.assertIsNone(b.parse_exif_date("")); self.assertIsNone(b.parse_exif_date(None)); self.assertIsNone(b.parse_exif_date("0000:00:00 00:00:00"))

    def test_stem_pairing(self):
        paths = [Path(x) for x in ("DSC1.ARW", "DSC1.JPG", "DSC2.ARW", "DSC3.JPG", "._DSC4.ARW", "DSC5.ARW.partial", "notes.xml", "C0001.MP4", "dsc6.arw", "DSC6.jpeg")]
        got = b.pair_shots(paths)
        self.assertEqual([(o.name, j.name if j else None) for o, j in got],
                         [("DSC1.ARW", "DSC1.JPG"), ("DSC2.ARW", None), ("DSC3.JPG", None), ("dsc6.arw", "DSC6.jpeg")])

    def test_mime(self):
        self.assertEqual(b.photo_mime("a.ARW"), "image/x-sony-arw"); self.assertEqual(b.photo_mime("a.JPG"), "image/jpeg")

    def test_gig_slug(self):
        self.assertEqual(f.gig_slug("Chi Phi · Sep 12"), "chiphi-sep12")
        self.assertEqual(f.gig_slug("Photos · Sep 26"), "photos-sep26")
        self.assertEqual(f.gig_slug("AXO bid · Aug 25"), "axobid-aug25")
        self.assertEqual(f.gig_slug(""), "photos")

    def test_photo_files_finds_same_stem_jpg(self):
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            for n in ("A.ARW", "A.JPG", "B.ARW", "C.JPG", "A2.JPG"):
                (td / n).write_text("x")
            self.assertEqual([p.name for p in f.photo_files(td / "A.ARW")], ["A.ARW", "A.JPG"])
            self.assertEqual([p.name for p in f.photo_files(td / "B.ARW")], ["B.ARW"])
            self.assertEqual([p.name for p in f.photo_files(td / "C.JPG")], ["C.JPG"])
            self.assertEqual([p.name for p in f.photo_files(td / "gone.ARW")], ["gone.ARW"])

    def test_output_paths(self):
        a, j = Path("G:/Videos/00_INBOX/x/DSC1.ARW"), Path("G:/Videos/00_INBOX/x/DSC1.JPG")
        plan = f.photo_copy_plan([a, j], "Photos · Sep 26", False, False)
        self.assertEqual([(k, d.as_posix()) for k, s, d in plan],
                         [("select0", "G:/Photos/Gigs/photos-sep26/selects/DSC1.ARW"), ("select1", "G:/Photos/Gigs/photos-sep26/selects/DSC1.JPG")])
        fav = f.photo_copy_plan([a], "Chi Phi · Sep 12", True, False)
        self.assertEqual([d.as_posix() for k, s, d in fav], ["G:/Photos/Gigs/chiphi-sep12/selects/DSC1.ARW", "G:/Photos/Good Stills/band/DSC1.ARW"])
        self.assertEqual(len(f.photo_copy_plan([a], "MAW · Sep 11", False, True)), 2)  # use_broll = stills library
        self.assertEqual(f.photo_band_name(a), "DSC1.jpg")

    def test_reject_destination_keeps_relative_path(self):
        sp = "Videos/00_INBOX/2026-10-04_a7c2/DSC1.ARW"
        self.assertEqual(f.undo_dest(sp, "2026-10-04").as_posix(), "G:/Videos/_to_delete/band-review-2026-10-04/" + sp)
        self.assertEqual(f.rel_g(Path("G:/") / sp), sp)

    def test_photo_source_roots(self):
        self.assertTrue(f.safe_rel("Videos/00_INBOX/a/b.ARW") and "Videos/00_INBOX/a/b.ARW".startswith(f.PHOTO_ROOTS))
        self.assertFalse("Videos/03_GIGS/a.ARW".startswith(f.PHOTO_ROOTS))
        self.assertFalse(f.inside("G:/Photos/../Videos/03_GIGS/x.ARW", f.G / "Photos"))


if __name__ == "__main__":
    unittest.main()
