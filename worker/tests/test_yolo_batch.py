# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

"""Tests for YOLO batch dispatch."""

from __future__ import annotations

import os
import sys
import unittest
import unittest.mock

_WORKER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _WORKER_DIR not in sys.path:
    sys.path.insert(0, _WORKER_DIR)


class TestYoloBatch(unittest.TestCase):
    def test_run_list_uses_single_batched_predict_call(self):
        from pipeline import yolo_inference

        class FakeModel:
            def __init__(self):
                self.calls: list[dict[str, object]] = []

            def predict(self, **kwargs):
                self.calls.append(kwargs)
                return ["result-a", "result-b"]

        fake_model = FakeModel()
        frames = [
            {"path": "/tmp/frame-a.jpg", "index": 10},
            {"path": "/tmp/frame-b.jpg", "index": 11},
        ]

        with unittest.mock.patch.object(yolo_inference, "load_model", return_value=fake_model), \
             unittest.mock.patch.object(
                 yolo_inference,
                 "_detections_from_result",
                 side_effect=lambda _model, result, frame_index: [{
                     "frame_index": frame_index,
                     "result": result,
                 }],
             ):
            detections = yolo_inference.run(frames, batch_size=64)

        self.assertEqual(len(fake_model.calls), 1)
        self.assertEqual(fake_model.calls[0]["source"], ["/tmp/frame-a.jpg", "/tmp/frame-b.jpg"])
        self.assertEqual(fake_model.calls[0]["batch"], 64)
        self.assertEqual(
            detections,
            [
                {"frame_index": 10, "result": "result-a"},
                {"frame_index": 11, "result": "result-b"},
            ],
        )


if __name__ == "__main__":
    unittest.main()
