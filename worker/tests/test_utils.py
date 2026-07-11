from __future__ import annotations

import os
import sys
import tempfile
import unittest


WORKER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if WORKER_ROOT not in sys.path:
    sys.path.insert(0, WORKER_ROOT)


class TestIngestSrtParser(unittest.TestCase):
    def write_srt(self, body: str) -> str:
        handle = tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".srt",
            delete=False,
            encoding="utf-8",
        )
        handle.write(body)
        handle.close()
        self.addCleanup(lambda: os.path.exists(handle.name) and os.unlink(handle.name))
        return handle.name

    def test_relative_altitude_is_explicit_agl_source(self) -> None:
        from ingest.srt_parser import parse_srt

        path = self.write_srt(
            "1\n00:00:00,000 --> 00:00:00,033\n"
            "[latitude: 17.0] [longitude: 78.0] "
            "[rel_alt: 12.3 abs_alt: 564.2] "
            "[gimbal_yaw: 10 gimbal_pitch: -90 gimbal_roll: 0]\n"
        )
        entry = parse_srt(path)[0]
        self.assertEqual(entry["altitude_source"], "relative_agl")
        self.assertEqual(entry["alt_m"], 12.3)
        self.assertEqual(entry["relative_altitude_m"], 12.3)
        self.assertEqual(entry["absolute_altitude_m"], 564.2)
        self.assertEqual(entry["gimbal_pitch"], -90.0)

    def test_absolute_only_altitude_is_not_mislabeled_as_agl(self) -> None:
        from ingest.srt_parser import parse_srt

        path = self.write_srt(
            "1\n00:00:00,000 --> 00:00:00,033\n"
            "[latitude: 17.0] [longitude: 78.0] [abs_alt: 564.2]\n"
        )
        entry = parse_srt(path)[0]
        self.assertEqual(entry["altitude_source"], "absolute_msl_only")
        self.assertIsNone(entry["relative_altitude_m"])


class TestGsdCalibration(unittest.TestCase):
    def test_fov_gsd_uses_relative_agl_and_squared_area_error(self) -> None:
        from utils.gsd_calibration import attach_gsd, calibration_from_options

        calibration = calibration_from_options(
            {
                "camera_horizontal_fov_deg": 90.0,
                "camera_calibration_source": "manufacturer_spec",
                "gsd_relative_error_pct": 10.0,
            }
        )
        frame = attach_gsd(
            {
                "altitude_source": "relative_agl",
                "relative_altitude_m": 50.0,
            },
            1000,
            calibration,
        )
        self.assertAlmostEqual(frame["gsd_m_per_px"], 0.1, places=8)
        self.assertTrue(frame["gsd_estimated"])
        self.assertAlmostEqual(frame["area_scale_lower"], 0.81, places=8)
        self.assertAlmostEqual(frame["area_scale_upper"], 1.21, places=8)

    def test_absolute_altitude_is_rejected_for_gsd(self) -> None:
        from utils.gsd_calibration import attach_gsd, calibration_from_options

        calibration = calibration_from_options(
            {
                "camera_horizontal_fov_deg": 73.7,
                "camera_calibration_source": "manufacturer_spec",
                "gsd_relative_error_pct": 5.0,
            }
        )
        with self.assertRaisesRegex(ValueError, "relative AGL altitude"):
            attach_gsd(
                {
                    "altitude_source": "absolute_msl_only",
                    "absolute_altitude_m": 500.0,
                },
                4000,
                calibration,
            )

    def test_missing_camera_geometry_fails(self) -> None:
        from utils.gsd_calibration import calibration_from_options

        with self.assertRaisesRegex(ValueError, "camera geometry"):
            calibration_from_options(
                {
                    "camera_calibration_source": "operator_estimate",
                    "gsd_relative_error_pct": 10.0,
                }
            )


def spatial_frame(
    *,
    index: int,
    lat: float = 17.0,
    lon: float = 78.0,
    detections: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    return {
        "index": index,
        "lat": lat,
        "lon": lon,
        "gimbal_yaw": 0.0,
        "gimbal_pitch": -90.0,
        "image_width_px": 1000,
        "image_height_px": 1000,
        "gsd_m_per_px": 0.01,
        "gsd_relative_error_pct": 5.0,
        "area_scale_lower": 0.9025,
        "area_scale_upper": 1.1025,
        "detector_status": "success",
        "segmentation_status": "success",
        "detections": detections or [],
    }


class TestSpatialDedup(unittest.TestCase):
    DETECTION = {
        "class": "D20",
        "bbox": [400.0, 400.0, 600.0, 600.0],
        "mask_area_px": 100.0,
    }

    def test_same_ground_crack_across_frames_counts_once(self) -> None:
        from pipeline.spatial_dedup import deduplicate_section_distresses

        result = deduplicate_section_distresses(
            [
                spatial_frame(index=0, detections=[self.DETECTION]),
                spatial_frame(index=1, detections=[self.DETECTION]),
            ]
        )
        self.assertEqual(result["raw_detection_count"], 2)
        self.assertEqual(result["unique_detection_count"], 1)
        self.assertAlmostEqual(result["cracking_area_m2"], 0.01, places=8)
        self.assertEqual(result["unique_detections"][0]["dedup_instance_count"], 2)

    def test_separated_ground_cracks_remain_distinct(self) -> None:
        from pipeline.spatial_dedup import deduplicate_section_distresses

        result = deduplicate_section_distresses(
            [
                spatial_frame(index=0, detections=[self.DETECTION]),
                spatial_frame(index=1, lat=17.0001, detections=[self.DETECTION]),
            ]
        )
        self.assertEqual(result["unique_detection_count"], 2)
        self.assertAlmostEqual(result["cracking_area_m2"], 0.02, places=8)

    def test_missing_nadir_geometry_hard_fails(self) -> None:
        from pipeline.spatial_dedup import SpatialDeduplicationError, deduplicate_section_distresses

        frame = spatial_frame(index=0, detections=[self.DETECTION])
        frame["gimbal_pitch"] = None
        with self.assertRaises(SpatialDeduplicationError):
            deduplicate_section_distresses([frame])


class TestSectioning(unittest.TestCase):
    def test_chainage_assigns_fixed_100m_sections(self) -> None:
        from utils.pci_segmentation import attach_chainage_to_frames

        frames = attach_chainage_to_frames(
            [
                {"index": 0, "lat": 17.0, "lon": 78.0},
                {"index": 1, "lat": 17.0, "lon": 78.0005},
                {"index": 2, "lat": 17.0, "lon": 78.0010},
            ]
        )
        self.assertEqual(frames[0]["section_index"], 0)
        self.assertGreater(frames[-1]["cumulative_distance_m"], 100.0)
        self.assertEqual(frames[-1]["section_index"], 1)

    def test_invalid_gps_fails_instead_of_inheriting_a_score(self) -> None:
        from utils.pci_segmentation import SectioningError, attach_chainage_to_frames

        with self.assertRaises(SectioningError):
            attach_chainage_to_frames([{"lat": 0.0, "lon": 0.0}])

    def test_full_section_pipeline_emits_bounds_only(self) -> None:
        from utils.gsd_calibration import calibration_from_options
        from utils.pci_segmentation import build_pci_sections

        calibration = calibration_from_options(
            {
                "camera_horizontal_fov_deg": 90.0,
                "camera_calibration_source": "manufacturer_spec",
                "gsd_relative_error_pct": 5.0,
            }
        )
        base = {
            "gimbal_yaw": 0.0,
            "gimbal_pitch": -90.0,
            "relative_altitude_m": 50.0,
            "absolute_altitude_m": 550.0,
            "altitude_source": "relative_agl",
            "image_width_px": 1000,
            "image_height_px": 1000,
            "detector_status": "success",
            "segmentation_status": "success",
        }
        frames = [
            {
                **base,
                "index": 0,
                "lat": 17.0,
                "lon": 78.0,
                "detections": [
                    {
                        "class": "D40",
                        "bbox": [450.0, 450.0, 550.0, 550.0],
                        "mask_area_px": 10.0,
                    }
                ],
            },
            {
                **base,
                "index": 1,
                "lat": 17.0,
                "lon": 78.0001,
                "detections": [],
            },
        ]
        sections, summary, _annotated = build_pci_sections(
            frames,
            road_class="URBAN",
            surface_type=None,
            carriageway_width_m=7.0,
            camera_calibration=calibration,
            provenance={
                "models": {"yolo": {"sha256": "1" * 64}, "sam2": {"sha256": "2" * 64}},
                "seed": 1337,
                "code_commit": "test-commit",
            },
        )
        self.assertEqual(len(sections), 1)
        self.assertIsNone(sections[0]["pci_complete"])
        self.assertAlmostEqual(sections[0]["pci_bounds"]["width"], 72.0)
        self.assertAlmostEqual(
            sections[0]["section_area_m2"],
            sections[0]["section_length_m"] * 7.0,
        )
        self.assertIsNone(summary["pci_complete"])
        self.assertAlmostEqual(summary["pci_bounds"]["width"], 72.0)


class TestGpsGeometry(unittest.TestCase):
    def test_haversine_and_circle_overlap(self) -> None:
        from utils.gps_dedup import compute_circle_overlap_ratio, haversine_m

        self.assertAlmostEqual(haversine_m(0.0, 10.0, 0.0, 10.0001), 11.12, delta=0.2)
        self.assertEqual(compute_circle_overlap_ratio(100.0, 5.0, 5.0), 0.0)
        self.assertEqual(compute_circle_overlap_ratio(0.0, 5.0, 5.0), 1.0)


if __name__ == "__main__":
    unittest.main()
