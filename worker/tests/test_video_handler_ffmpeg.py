"""Regression tests for ffmpeg frame-extraction command construction."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
import unittest.mock

_WORKER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _WORKER_DIR not in sys.path:
    sys.path.insert(0, _WORKER_DIR)

sys.modules.setdefault("cv2", unittest.mock.MagicMock())


class TestFfmpegExtractionCommand(unittest.TestCase):
    def test_all_frames_uses_ffmpeg4_compatible_vsync_not_fps_mode(self):
        from ingest import video_handler

        with tempfile.TemporaryDirectory() as tmp_dir:
            video_path = os.path.join(tmp_dir, "video.mp4")
            output_dir = os.path.join(tmp_dir, "frames")
            os.makedirs(output_dir, exist_ok=True)
            with open(video_path, "wb") as handle:
                handle.write(b"fake video")

            commands: list[list[str]] = []

            def fake_run(command: list[str]) -> None:
                commands.append(command)
                with open(os.path.join(output_dir, "frame_000000.jpg"), "wb") as handle:
                    handle.write(b"fake jpg")

            with unittest.mock.patch.object(video_handler.shutil, "which", return_value="/usr/bin/ffmpeg"), \
                 unittest.mock.patch.object(video_handler, "_probe_video", return_value={"fps": 30.0, "reported_frame_count": 1}), \
                 unittest.mock.patch.object(video_handler, "_run_ffmpeg", side_effect=fake_run):
                frames = video_handler._extract_frames_ffmpeg(
                    video_path,
                    interval_seconds=None,
                    output_dir=output_dir,
                    extraction_mode="all_frames",
                )

        self.assertEqual(len(frames), 1)
        command = commands[0]
        self.assertNotIn("-fps_mode", command)
        self.assertNotIn("passthrough", command)
        self.assertIn("-vsync", command)
        self.assertEqual(command[command.index("-vsync") + 1], "0")

    def test_ffmpeg_failure_message_includes_command(self):
        from ingest import video_handler

        result = unittest.mock.Mock(returncode=1, stderr="Unrecognized option 'fps_mode'", stdout="")

        with unittest.mock.patch.object(video_handler.subprocess, "run", return_value=result):
            with self.assertRaisesRegex(RuntimeError, "ffmpeg command:"):
                video_handler._run_ffmpeg(["ffmpeg", "-fps_mode", "passthrough", "out.jpg"])


if __name__ == "__main__":
    unittest.main()
