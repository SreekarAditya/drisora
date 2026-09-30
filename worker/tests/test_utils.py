# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

"""Unit tests for worker utility modules.

Run from the worker/ directory:
    python -m unittest tests.test_utils -v
"""

from __future__ import annotations

import math
import os
import sys
import tempfile
import unittest
import unittest.mock

# Ensure worker/ is on sys.path so imports like `from utils.X import Y` work.
_WORKER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _WORKER_DIR not in sys.path:
    sys.path.insert(0, _WORKER_DIR)

# ---------------------------------------------------------------------------
# Mock heavy third-party dependencies that aren't available in test context.
# We must do this BEFORE any module that transitively imports them is loaded.
# ---------------------------------------------------------------------------

# Mock `piexif` so ingest/__init__.py → ingest/exif_reader.py can be imported.
sys.modules.setdefault("piexif", unittest.mock.MagicMock())

# Mock other likely-missing ingest/pipeline deps so the __init__.py chain
# doesn't blow up. We only need ingest.srt_parser to function correctly.
for _mod in (
    "cv2",
    "PIL",
    "PIL.Image",
    "PIL.ExifTags",
    "numpy",
    "torch",
    "torchvision",
):
    sys.modules.setdefault(_mod, unittest.mock.MagicMock())


# ---------------------------------------------------------------------------
# Helpers for building temp SRT files
# ---------------------------------------------------------------------------

def _make_srt_block(
    idx: int,
    ts_start: str,
    ts_end: str,
    lat: float,
    lon: float,
    alt: float | None,
    yaw: float | None = None,
) -> str:
    """Return one SRT block as a string."""
    alt_part = f"[rel_alt: {alt:.3f} abs_alt: {alt:.3f}]" if alt is not None else ""
    yaw_part = f"[gimbal_yaw: {yaw} gimbal_pitch: -90.0 gimbal_roll: 0.0]" if yaw is not None else ""
    return (
        f"{idx}\n"
        f"{ts_start} --> {ts_end}\n"
        f"<font size=\"28\">FrameCnt: {idx}, DiffTime: 33ms\n"
        f"[latitude: {lat}] [longitude: {lon}] {alt_part}\n"
        f"{yaw_part}\n"
        f"</font>"
    )


# ---------------------------------------------------------------------------
# Tests for utils.srt_parser.parse_dji_srt
# ---------------------------------------------------------------------------

class TestParseDjiSrt(unittest.TestCase):
    """Tests for utils.srt_parser.parse_dji_srt."""

    def setUp(self):
        self._tmp_files: list[str] = []

    def tearDown(self):
        for p in self._tmp_files:
            try:
                os.unlink(p)
            except OSError:
                pass

    def _write_srt(self, content: str) -> str:
        """Write content to a temp .srt file and return its path."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".srt", delete=False, encoding="utf-8"
        ) as f:
            f.write(content)
            path = f.name
        self._tmp_files.append(path)
        return path

    def test_valid_srt_with_gps(self):
        """Valid SRT with GPS returns list of dicts with expected keys."""
        from utils.srt_parser import parse_dji_srt

        block1 = _make_srt_block(1, "00:00:00,000", "00:00:00,033",
                                  lat=18.5412, lon=73.9011, alt=30.0, yaw=-91.4)
        block2 = _make_srt_block(2, "00:00:00,033", "00:00:00,066",
                                  lat=18.5413, lon=73.9012, alt=31.0, yaw=-90.0)
        content = block1 + "\n\n" + block2
        path = self._write_srt(content)

        result = parse_dji_srt(path)

        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 2)
        for i, frame in enumerate(result):
            self.assertIn("frame_index", frame)
            self.assertIn("lat", frame)
            self.assertIn("lon", frame)
            self.assertIn("altitude_m", frame)
            self.assertIn("fov_deg", frame)
            self.assertEqual(frame["frame_index"], i)

    def test_relative_altitude_preferred_for_agl_gsd(self):
        """Relative altitude is AGL and wins over absolute MSL altitude."""
        from utils.srt_parser import parse_dji_srt

        block = (
            "1\n"
            "00:00:00,000 --> 00:00:00,033\n"
            "[latitude: 18.5412] [longitude: 73.9011]\n"
            "[rel_alt: 12.300 abs_alt: 564.230] [gps_level: 5]\n"
        )
        path = self._write_srt(block)

        result = parse_dji_srt(path)

        self.assertAlmostEqual(result[0]["altitude_m"], 12.3, places=3)
        self.assertEqual(result[0]["gps_signal_quality"], "5")

    def test_missing_fov_defaults_to_737(self):
        """When fov is not in SRT, fov_deg defaults to 73.7."""
        from utils.srt_parser import parse_dji_srt

        block = _make_srt_block(1, "00:00:00,000", "00:00:00,033",
                                 lat=18.5412, lon=73.9011, alt=30.0)
        path = self._write_srt(block)

        result = parse_dji_srt(path)

        self.assertEqual(len(result), 1)
        self.assertAlmostEqual(result[0]["fov_deg"], 73.7, places=1)

    def test_malformed_blocks_skipped_valid_returned(self):
        """Blocks without lat/lon are skipped; valid blocks are still returned."""
        from utils.srt_parser import parse_dji_srt

        # Malformed block: no GPS at all, just a timecode line.
        malformed_block = (
            "1\n"
            "00:00:00,000 --> 00:00:00,033\n"
            "<font size=\"28\">No GPS data here</font>"
        )
        valid_block = _make_srt_block(2, "00:00:00,033", "00:00:00,066",
                                      lat=18.5412, lon=73.9011, alt=30.0)
        content = malformed_block + "\n\n" + valid_block
        path = self._write_srt(content)

        result = parse_dji_srt(path)

        self.assertEqual(len(result), 1)
        self.assertAlmostEqual(result[0]["lat"], 18.5412, places=4)

    def test_none_path_raises_value_error(self):
        """Passing None as path raises ValueError."""
        from utils.srt_parser import parse_dji_srt

        with self.assertRaises(ValueError):
            parse_dji_srt(None)

    def test_srt_with_no_altitude_raises_value_error(self):
        """SRT with GPS but no altitude in any entry raises ValueError."""
        from utils.srt_parser import parse_dji_srt

        # Build a block where alt is omitted entirely so alt_m will be None.
        block = (
            "1\n"
            "00:00:00,000 --> 00:00:00,033\n"
            "<font size=\"28\">FrameCnt: 1, DiffTime: 33ms\n"
            "[latitude: 18.5412] [longitude: 73.9011]\n"
            "</font>"
        )
        path = self._write_srt(block)

        with self.assertRaises(ValueError):
            parse_dji_srt(path)


# ---------------------------------------------------------------------------
# Tests for utils.gps_dedup.compute_circle_overlap_ratio
# ---------------------------------------------------------------------------

class TestComputeCircleOverlapRatio(unittest.TestCase):
    """Tests for compute_circle_overlap_ratio."""

    def setUp(self):
        from utils.gps_dedup import compute_circle_overlap_ratio
        self.overlap = compute_circle_overlap_ratio

    def test_fully_contained_dist_zero(self):
        """dist=0, r1=10, r2=20 → circle 1 fully inside circle 2, ratio=1.0."""
        ratio = self.overlap(dist_m=0.0, r1_m=10.0, r2_m=20.0)
        self.assertAlmostEqual(ratio, 1.0, places=9)

    def test_partial_overlap(self):
        """Circles partially overlapping → ratio in (0, 1)."""
        # Two equal circles with centres 10 m apart, each radius 10 m.
        ratio = self.overlap(dist_m=10.0, r1_m=10.0, r2_m=10.0)
        self.assertGreater(ratio, 0.0)
        self.assertLess(ratio, 1.0)

    def test_no_overlap(self):
        """dist=100, r1=r2=5 → circles completely disjoint, ratio=0.0."""
        ratio = self.overlap(dist_m=100.0, r1_m=5.0, r2_m=5.0)
        self.assertAlmostEqual(ratio, 0.0, places=9)

    def test_same_circle_dist_zero(self):
        """Identical circles (dist=0, r1=r2=10) → ratio=1.0."""
        ratio = self.overlap(dist_m=0.0, r1_m=10.0, r2_m=10.0)
        self.assertAlmostEqual(ratio, 1.0, places=9)


# ---------------------------------------------------------------------------
# Tests for utils.gps_dedup.is_duplicate_frame
# ---------------------------------------------------------------------------

class TestIsDuplicateFrame(unittest.TestCase):
    """Tests for is_duplicate_frame."""

    def setUp(self):
        from utils.gps_dedup import is_duplicate_frame, compute_footprint_radius
        self.is_dup = is_duplicate_frame
        self.footprint_radius = compute_footprint_radius

    def test_frame_clearly_inside_zone(self):
        """Frame at same coords with large zone → True."""
        frame = {"lat": 0.0, "lon": 0.0, "altitude_m": 30.0, "fov_deg": 73.7}
        # Zone at same location with a huge radius.
        zone = {"lat": 0.0, "lon": 0.0, "footprint_radius_m": 1000.0}
        self.assertTrue(self.is_dup(frame, [zone]))

    def test_frame_far_from_all_zones(self):
        """Frame far from every zone → False."""
        frame = {"lat": 0.0, "lon": 0.0, "altitude_m": 30.0, "fov_deg": 73.7}
        # Zone 10 km away (≈0.09° in latitude).
        zone = {"lat": 9.0, "lon": 9.0, "footprint_radius_m": 10.0}
        self.assertFalse(self.is_dup(frame, [zone]))

    def test_threshold_exactly_at_060(self):
        """Frame that produces an overlap >= 0.60 → True (duplicate)."""
        # Two circles at same point: overlap = 1.0 ≥ 0.60.
        frame = {"lat": 0.0, "lon": 0.0, "altitude_m": 30.0, "fov_deg": 73.7}
        r = self.footprint_radius(30.0, 73.7)
        zone = {"lat": 0.0, "lon": 0.0, "footprint_radius_m": r}
        self.assertTrue(self.is_dup(frame, [zone], overlap_threshold=0.60))

    def test_empty_processed_zones(self):
        """No zones → always False."""
        frame = {"lat": 0.0, "lon": 0.0, "altitude_m": 30.0, "fov_deg": 73.7}
        self.assertFalse(self.is_dup(frame, []))


# ---------------------------------------------------------------------------
# Tests for utils.pci_segmentation — mocked pipeline import
# ---------------------------------------------------------------------------

# We patch pipeline.pci_scorer before importing pci_segmentation so that the
# module-level `from pipeline.pci_scorer import score as pci_score_frame`
# succeeds without needing PyTorch / model weights.

_mock_pci_scorer_module = unittest.mock.MagicMock()
_mock_pci_scorer_module.score = unittest.mock.MagicMock(
    return_value={"pci": 50.0, "individual_scores": {}}
)

@unittest.mock.patch.dict(
    "sys.modules",
    {
        "pipeline.pci_scorer": _mock_pci_scorer_module,
        "pipeline": unittest.mock.MagicMock(),
    },
)
class TestComputeCumulativeDistances(unittest.TestCase):
    """Tests for compute_cumulative_distances."""

    def _get_fn(self):
        # Import inside test so the mock is active.
        import importlib
        import utils.pci_segmentation as mod
        importlib.reload(mod)
        return mod.compute_cumulative_distances

    def test_empty_list(self):
        """Empty input → empty list."""
        fn = self._get_fn()
        self.assertEqual(fn([]), [])

    def test_single_frame(self):
        """Single frame → [0.0]."""
        fn = self._get_fn()
        result = fn([{"lat": 17.0, "lon": 78.0}])
        self.assertEqual(result, [0.0])

    def test_two_frames_known_distance(self):
        """Two frames → [0.0, haversine_m(lat1, lon1, lat2, lon2)]."""
        from utils.gps_dedup import haversine_m
        fn = self._get_fn()
        frames = [
            {"lat": 17.0, "lon": 78.0},
            {"lat": 17.0, "lon": 78.0001},
        ]
        result = fn(frames)
        expected = haversine_m(17.0, 78.0, 17.0, 78.0001)
        self.assertAlmostEqual(result[1], expected, places=3)

    def test_two_frames_approx_11m(self):
        """Frames at 0.0001° longitude apart are counted below the gap threshold."""
        fn = self._get_fn()
        frames = [
            {"lat": 0.0, "lon": 10.0},
            {"lat": 0.0, "lon": 10.0001},
        ]
        result = fn(frames)
        self.assertAlmostEqual(result[1], 11.132, delta=0.2)

    def test_invalid_gps_inherits_distance(self):
        """A 0,0 GPS fix is invalid and inherits prior chainage."""
        fn = self._get_fn()
        frames = [
            {"lat": 0.0, "lon": 10.0},
            {"lat": 0.0, "lon": 10.0001},
            {"lat": 0.0, "lon": 0.0},
        ]
        result = fn(frames)
        self.assertAlmostEqual(result[2], result[1], places=6)

    def test_gps_jump_over_50m_is_not_counted(self):
        """Telemetry jumps over 50 m are flagged and skipped in chainage."""
        import importlib
        import utils.pci_segmentation as mod
        importlib.reload(mod)

        frames = mod.attach_chainage_to_frames([
            {"lat": 0.0, "lon": 10.0},
            {"lat": 0.0, "lon": 10.001},
        ])

        self.assertTrue(frames[1]["telemetry_gap"])
        self.assertAlmostEqual(frames[1]["cumulative_distance_m"], 0.0, places=6)


@unittest.mock.patch.dict(
    "sys.modules",
    {
        "pipeline.pci_scorer": _mock_pci_scorer_module,
        "pipeline": unittest.mock.MagicMock(),
    },
)
class TestAssignFramesToSegments(unittest.TestCase):
    """Tests for assign_frames_to_segments."""

    def _get_fn(self):
        import importlib
        import utils.pci_segmentation as mod
        importlib.reload(mod)
        return mod.assign_frames_to_segments

    def test_frames_spanning_250m(self):
        """Frames at 0, 100, 200m use 100 m section indexes."""
        fn = self._get_fn()
        frames = [
            {"cumulative_distance_m": 0.0},
            {"cumulative_distance_m": 99.0},
            {"cumulative_distance_m": 100.0},
            {"cumulative_distance_m": 199.0},
            {"cumulative_distance_m": 200.0},
            {"cumulative_distance_m": 230.0},
        ]
        result = fn(frames)
        self.assertIn(0, result)
        self.assertIn(1, result)
        self.assertIn(2, result)
        self.assertEqual(len(result), 3)

    def test_frame_at_exactly_100m(self):
        """Frame at exactly 100 m maps to 100 m section index 1."""
        fn = self._get_fn()
        frames = [{"cumulative_distance_m": 100.0}]
        result = fn(frames)
        self.assertIn(1, result)
        self.assertEqual(len(result[1]), 1)

    def test_final_section_shorter_than_20m_merges_into_previous(self):
        """A final 15 m tail is merged into the previous 100 m section."""
        fn = self._get_fn()
        frames = [
            {"cumulative_distance_m": 0.0},
            {"cumulative_distance_m": 100.0},
            {"cumulative_distance_m": 195.0},
            {"cumulative_distance_m": 205.0},
            {"cumulative_distance_m": 215.0},
        ]
        result = fn(frames)
        self.assertEqual(sorted(result), [0, 1])
        self.assertEqual(len(result[1]), 4)

    def test_empty_input(self):
        """Empty input → empty dict."""
        fn = self._get_fn()
        result = fn([])
        self.assertEqual(result, {})


@unittest.mock.patch.dict(
    "sys.modules",
    {
        "pipeline.pci_scorer": _mock_pci_scorer_module,
        "pipeline": unittest.mock.MagicMock(),
    },
)
class TestBuildSurveyPciSummary(unittest.TestCase):
    """Tests for build_survey_pci_summary."""

    def _get_fn(self):
        import importlib
        import utils.pci_segmentation as mod
        importlib.reload(mod)
        return mod.build_survey_pci_summary

    def test_weighted_average_correctness(self):
        """Weighted PCI: seg1(pci=80, len=100), seg2(pci=60, len=50) → ≈73.33."""
        fn = self._get_fn()
        segments = [
            {
                "segment_index": 0,
                "pci_score": 80.0,
                "total_length_m": 100.0,
                "is_relative": False,
            },
            {
                "segment_index": 1,
                "pci_score": 60.0,
                "total_length_m": 50.0,
                "is_relative": False,
            },
        ]
        result = fn(segments)
        expected = (80.0 * 100.0 + 60.0 * 50.0) / 150.0  # ≈ 73.333...
        self.assertAlmostEqual(result["weighted_pci"], expected, places=3)
        self.assertEqual(result["segment_count"], 2)
        self.assertAlmostEqual(result["total_length_m"], 150.0, places=4)

    def test_empty_input(self):
        """Empty input → weighted_pci=0.0, segment_count=0."""
        fn = self._get_fn()
        result = fn([])
        self.assertAlmostEqual(result["weighted_pci"], 0.0, places=9)
        self.assertEqual(result["segment_count"], 0)

    def test_rpci_segment_count(self):
        """Segments with is_relative=True are counted in rpci_segment_count."""
        fn = self._get_fn()
        segments = [
            {
                "segment_index": 0,
                "pci_score": 70.0,
                "total_length_m": 100.0,
                "is_relative": False,
            },
            {
                "segment_index": 1,
                "pci_score": 55.0,
                "total_length_m": 40.0,
                "is_relative": True,
            },
        ]
        result = fn(segments)
        self.assertEqual(result["rpci_segment_count"], 1)
        self.assertEqual(result["segment_count"], 2)


@unittest.mock.patch.dict(
    "sys.modules",
    {
        "pipeline.pci_scorer": _mock_pci_scorer_module,
        "pipeline": unittest.mock.MagicMock(),
    },
)
class TestComputeSegmentPciMetadata(unittest.TestCase):
    """Tests for 100 m section metadata and section GSD."""

    def _get_mod(self):
        import importlib
        import utils.pci_segmentation as mod
        importlib.reload(mod)
        return mod

    def test_section_metadata_uses_mean_altitude_and_low_confidence(self):
        mod = self._get_mod()
        frames = [
            {
                "section_index": 0,
                "cumulative_distance_m": 0.0,
                "lat": 17.0,
                "lon": 78.0,
                "alt_m": 10.0,
                "pci_score": 80.0,
                "detections": [{"bbox": [0, 0, 10, 100], "mask_area_px": 200.0}],
            },
            {
                "section_index": 0,
                "cumulative_distance_m": 80.0,
                "lat": 17.0001,
                "lon": 78.0001,
                "alt_m": 12.0,
                "pci_score": 70.0,
                "detections": [],
            },
        ]

        result = mod.compute_segment_pci(frames, survey_end_distance_m=80.0)

        expected_gsd = (9.6 * 11.0 * 1000.0) / (4.49 * 4000.0)
        self.assertEqual(result["section_id"], "S-01")
        self.assertAlmostEqual(result["mean_altitude_m"], 11.0, places=4)
        self.assertAlmostEqual(result["gsd_mm_per_px"], expected_gsd, places=6)
        self.assertTrue(result["low_confidence"])
        self.assertAlmostEqual(result["detections"][0]["crack_width_mm"], 2.0 * expected_gsd, places=6)


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main()
