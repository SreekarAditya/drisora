"""Focused tests for multi-video drone ingestion dispatch.

Run from the worker/ directory:
    python -m unittest tests.test_multi_video_dispatch -v
"""

from __future__ import annotations

import os
import sys
import unittest
import unittest.mock

_WORKER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _WORKER_DIR not in sys.path:
    sys.path.insert(0, _WORKER_DIR)

sys.modules.setdefault("piexif", unittest.mock.MagicMock())
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


class TestMultiVideoDispatch(unittest.TestCase):
    def test_dispatch_multi_drone_footage_combines_all_video_entries(self):
        from jobs import dispatcher

        files = {
            "frame_interval_seconds": 1,
            "videos": [
                {"video": "/tmp/video-1.mp4", "srt": "/tmp/video-1.srt"},
                {"video": "/tmp/video-2.mp4", "srt": "/tmp/video-2.srt"},
            ],
        }

        def fake_extract(video: str, interval_seconds: float):
            if video.endswith("video-1.mp4"):
                return [
                    {"index": 0, "path": "/frames/v1-0.jpg", "timestamp_ms": 0},
                    {"index": 1, "path": "/frames/v1-1.jpg", "timestamp_ms": 1000},
                ]
            return [
                {"index": 0, "path": "/frames/v2-0.jpg", "timestamp_ms": 0},
            ]

        def fake_parse_srt(path: str):
            return [{"timestamp_ms": 0, "lat": 1.0, "lon": 2.0, "alt_m": 10.0, "gimbal_yaw": None}]

        def fake_attach(frames, _entries):
            enriched = []
            for frame in frames:
                enriched.append(
                    {
                        **frame,
                        "lat": 12.0,
                        "lon": 77.0,
                        "alt_m": 30.0,
                        "gimbal_yaw": 0.0,
                    }
                )
            return enriched

        with unittest.mock.patch.object(dispatcher, "extract_frames", side_effect=fake_extract), \
             unittest.mock.patch.object(dispatcher, "parse_srt", side_effect=fake_parse_srt), \
             unittest.mock.patch.object(dispatcher, "attach_gps_to_frames", side_effect=fake_attach):
            batch = dispatcher.dispatch_job("job-123", "drone_footage", files)

        self.assertEqual(batch["frame_count"], 3)
        self.assertTrue(batch["gps_available"])
        self.assertEqual([frame["index"] for frame in batch["frames"]], [0, 1, 2])
        self.assertEqual(
            [frame["path"] for frame in batch["frames"]],
            ["/frames/v1-0.jpg", "/frames/v1-1.jpg", "/frames/v2-0.jpg"],
        )


if __name__ == "__main__":
    unittest.main()
