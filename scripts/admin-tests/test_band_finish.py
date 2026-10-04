"""Pure-helper tests for scripts/finish-band-review.py. Run: py scripts/admin-tests/test_band_finish.py"""
import importlib.util, unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("finish", Path(__file__).resolve().parents[1] / "finish-band-review.py")
f = importlib.util.module_from_spec(spec)
spec.loader.exec_module(f)


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


if __name__ == "__main__":
    unittest.main()
