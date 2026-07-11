from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path


WORKER_ROOT = Path(__file__).resolve().parents[1]
if str(WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKER_ROOT))

from pipeline import pci_scorer


PROVENANCE = {
    "models": {
        "yolo": {"sha256": "1" * 64},
        "sam2": {"sha256": "2" * 64},
    },
    "seed": 1337,
    "gsd": {
        "source": "relative_agl_plus_explicit_camera_fov",
        "relative_error_pct": 5.0,
        "area_relative_error_pct": 10.0,
    },
    "code_commit": "fixture-commit",
}


def complete_inputs(
    ce: float,
    re: float,
    pn: float,
    pe: float,
    rd: float,
    iri: float,
) -> dict[str, float]:
    return {
        "cracking_extent_pct": ce,
        "ravelling_extent_pct": re,
        "pothole_number": pn,
        "patching_extent_pct": pe,
        "rut_depth_mm": rd,
        "iri_m_per_km": iri,
    }


class TestAppendixTwoEquationFixtures(unittest.TestCase):
    """Nine source examples recomputed from the printed equation tables.

    IRC:82-2023's worked-example totals are internally inconsistent with its
    own equations and weights.  These expected values are the deterministic
    outputs of Tables A2.1-A2.3.  MDR rows use SD explicitly because the
    printed examples omit the mandatory surface type.
    """

    FIXTURES = (
        ("highway excellent", "HIGHWAY", None, (0.5, 0.3, 0, 0.05, 0.10, 2.4), 93.883540),
        ("highway fair", "HIGHWAY", None, (5, 3, 2, 2.6, 10, 4.5), 40.839631),
        ("highway poor", "HIGHWAY", None, (14, 12, 4, 15, 14, 8), 20.560098),
        ("mdr rural excellent", "MDR_RURAL", "SD", (0.6, 0.1, 1, 0.5, 1, 2.8), 97.245466),
        ("mdr rural fair", "MDR_RURAL", "SD", (6.5, 4.7, 6, 6, 8, 9.2), 47.411127),
        ("mdr rural poor", "MDR_RURAL", "SD", (20, 16, 10, 12, 22, 12), 22.411018),
        ("urban excellent", "URBAN", None, (0.5, 0.2, 0, 0.1, 0, 2.4), 94.497500),
        ("urban fair", "URBAN", None, (5, 2, 3, 3.5, 4, 6), 46.835660),
        ("urban poor", "URBAN", None, (12, 8, 4, 10, 12, 7), 27.652728),
    )

    def test_all_nine_recomputed_fixtures(self) -> None:
        for name, road_class, surface_type, values, expected in self.FIXTURES:
            with self.subTest(name=name):
                result = pci_scorer.evaluate_complete_pci(
                    complete_inputs(*values),
                    road_class=road_class,
                    surface_type=surface_type,
                )
                self.assertAlmostEqual(result["pci_complete"], expected, places=5)

    def test_road_class_dispatch_changes_equation(self) -> None:
        highway = pci_scorer.equation_set("HIGHWAY")["cracking"](5.0)
        urban = pci_scorer.equation_set("URBAN")["cracking"](5.0)
        self.assertNotAlmostEqual(highway, urban)

    def test_mdr_rural_requires_surface_type(self) -> None:
        with self.assertRaisesRegex(ValueError, "surface_type is required"):
            pci_scorer.equation_set("MDR_RURAL")

    def test_all_five_mdr_surface_curves_are_available(self) -> None:
        self.assertEqual(
            set(pci_scorer.MDR_ROUGHNESS_FUNCTIONS),
            set(pci_scorer.SurfaceType),
        )
        for surface_type in pci_scorer.SurfaceType:
            value = pci_scorer.equation_set("MDR_RURAL", surface_type)["roughness"](9.2)
            self.assertTrue(math.isfinite(value))
            self.assertGreaterEqual(value, 0.0)
            self.assertLessEqual(value, 100.0)


class TestPartialPciContract(unittest.TestCase):
    def score(self, **distress_overrides: object) -> dict[str, object]:
        distresses: dict[str, object] = {
            "section_id": "S-01",
            "detector_status": "success",
            "segmentation_status": "success",
            "spatial_dedup_applied": True,
            "usable_frame_count": 12,
            "cracking_area_m2": 2.8,
            "pothole_area_m2": 0.5,
            "area_uncertainty_m2": {
                "cracking": {"lower": 2.527, "upper": 3.087},
                "pothole": {"lower": 0.45125, "upper": 0.55125},
            },
        }
        distresses.update(distress_overrides)
        return pci_scorer.score(
            distresses,
            road_class="URBAN",
            section_length_m=100.0,
            carriageway_width_m=7.0,
            provenance=PROVENANCE,
        )

    def test_unmeasured_parameters_remain_null(self) -> None:
        result = self.score()
        self.assertEqual(
            result["unmeasured"],
            {"ravelling": None, "patching": None, "rut": None, "roughness": None},
        )
        self.assertIsNone(result["pci_complete"])
        self.assertEqual(result["measured_weight_fraction"], 0.28)
        self.assertEqual(result["unmeasured_weight_fraction"], 0.72)
        self.assertAlmostEqual(result["pci_bounds"]["width"], 72.0)

    def test_pothole_area_converts_to_clause_unit_number(self) -> None:
        result = self.score(pothole_area_m2=0.5)
        self.assertAlmostEqual(result["measured"]["pothole"]["number"], 5.0)
        self.assertEqual(
            result["measured"]["pothole"]["pothole_unit_area_m2"],
            0.1,
        )

    def test_zero_detections_is_not_pci_100(self) -> None:
        result = self.score(
            cracking_area_m2=0.0,
            pothole_area_m2=0.0,
            area_uncertainty_m2={
                "cracking": {"lower": 0.0, "upper": 0.0},
                "pothole": {"lower": 0.0, "upper": 0.0},
            },
        )
        self.assertEqual(result["detection_state"], "no_distress_found")
        self.assertIsNone(result["pci_complete"])
        self.assertLess(result["pci_bounds"]["lower"], 100.0)

    def test_detector_failure_raises(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "detector did not complete"):
            self.score(detector_status="failed")

    def test_unusable_section_raises(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "no usable frames"):
            self.score(usable_frame_count=0)

    def test_spatial_dedup_is_mandatory(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "spatial deduplication"):
            self.score(spatial_dedup_applied=False)

    def test_road_class_has_no_default(self) -> None:
        with self.assertRaises(TypeError):
            pci_scorer.score(
                {
                    "detector_status": "success",
                    "segmentation_status": "success",
                    "spatial_dedup_applied": True,
                    "usable_frame_count": 1,
                    "cracking_area_m2": 0.0,
                    "pothole_area_m2": 0.0,
                    "area_uncertainty_m2": {
                        "cracking": {"lower": 0.0, "upper": 0.0},
                        "pothole": {"lower": 0.0, "upper": 0.0},
                    },
                },
                section_length_m=100.0,
                carriageway_width_m=7.0,
                provenance=PROVENANCE,
            )


if __name__ == "__main__":
    unittest.main()
