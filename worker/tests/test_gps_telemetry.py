# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

"""Tests for sidecar and embedded drone GPS telemetry loading."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
import unittest.mock
from pathlib import Path

_WORKER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _WORKER_DIR not in sys.path:
    sys.path.insert(0, _WORKER_DIR)


SRT_TEXT = """1
00:00:00,000 --> 00:00:00,033
[latitude: 18.541234] [longitude: 73.901112] [rel_alt: 12.300 abs_alt: 564.230]
[gimbal_yaw: -91.4]
"""


class TestGpsTelemetry(unittest.TestCase):
    def test_sidecar_srt_is_preferred(self):
        from ingest.gps_telemetry import load_gps_telemetry

        with tempfile.TemporaryDirectory() as tmp:
            srt_path = Path(tmp) / "flight.srt"
            srt_path.write_text(SRT_TEXT, encoding="utf-8")

            with unittest.mock.patch("ingest.gps_telemetry._extract_embedded_srt") as embedded:
                result = load_gps_telemetry(Path(tmp) / "flight.mp4", srt_path)

        embedded.assert_not_called()
        self.assertEqual(result["source"], "srt")
        self.assertEqual(result["entry_count"], 1)
        self.assertEqual(result["entries"][0]["lat"], 18.541234)

    def test_embedded_subtitle_srt_is_used_without_sidecar(self):
        from ingest.gps_telemetry import load_gps_telemetry

        def fake_run(command, capture_output, text, check):
            output_path = Path(command[-1])
            output_path.write_text(SRT_TEXT, encoding="utf-8")
            return unittest.mock.Mock(returncode=0, stdout="", stderr="")

        with tempfile.TemporaryDirectory() as tmp, \
             unittest.mock.patch("ingest.gps_telemetry.shutil.which", return_value="/usr/bin/ffmpeg"), \
             unittest.mock.patch("ingest.gps_telemetry._subtitle_stream_indexes", return_value=[2]), \
             unittest.mock.patch("ingest.gps_telemetry.subprocess.run", side_effect=fake_run):
            result = load_gps_telemetry(Path(tmp) / "flight.mp4")

        self.assertEqual(result["source"], "embedded_srt")
        self.assertEqual(result["entry_count"], 1)
        self.assertEqual(result["entries"][0]["lon"], 73.901112)

    def test_missing_sidecar_and_no_subtitle_stream_is_unavailable(self):
        from ingest.gps_telemetry import load_gps_telemetry

        with unittest.mock.patch("ingest.gps_telemetry.shutil.which", return_value="/usr/bin/ffmpeg"), \
             unittest.mock.patch("ingest.gps_telemetry._subtitle_stream_indexes", return_value=[]):
            result = load_gps_telemetry("/tmp/flight.mp4")

        self.assertEqual(result["source"], "unavailable")
        self.assertEqual(result["entry_count"], 0)


if __name__ == "__main__":
    unittest.main()
