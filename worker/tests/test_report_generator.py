from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


WORKER_ROOT = Path(__file__).resolve().parents[1]
if str(WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKER_ROOT))


@unittest.skipUnless(importlib.util.find_spec("reportlab"), "reportlab is not installed locally")
class TestPartialReportGenerator(unittest.TestCase):
    def test_generates_nonempty_bounds_pdf(self) -> None:
        from pipeline.report_generator import generate_irc82_pdf_report

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "partial.pdf"
            result = generate_irc82_pdf_report(
                output,
                job_id="test-job",
                summary={
                    "pci_complete": None,
                    "pci_bounds": {"lower": 24.0, "upper": 96.0, "width": 72.0},
                    "segment_count": 1,
                },
                sections=[{
                    "section_id": "S-001",
                    "start_distance_m": 0.0,
                    "end_distance_m": 100.0,
                    "section_length_m": 100.0,
                    "pci_bounds": {"lower": 24.0, "upper": 96.0, "width": 72.0},
                    "raw_detection_count": 2,
                    "unique_detection_count": 1,
                }],
                frame_count=3,
                detection_count=2,
            )
            self.assertEqual(result, output)
            self.assertGreater(output.stat().st_size, 500)


if __name__ == "__main__":
    unittest.main()
