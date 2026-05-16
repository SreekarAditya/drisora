"""Tests for batched SAM2 and DepthPro dispatch."""

from __future__ import annotations

import os
import sys
import unittest
import unittest.mock

try:
    import numpy as np
except ModuleNotFoundError:
    np = None

_WORKER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _WORKER_DIR not in sys.path:
    sys.path.insert(0, _WORKER_DIR)


@unittest.skipIf(np is None, "numpy is not installed in this local Python")
class TestSam2Batch(unittest.TestCase):
    def test_run_one_batches_boxes_for_one_frame(self):
        from pipeline import sam2_inference

        class FakeImage:
            def convert(self, _mode: str):
                return self

            def __array__(self, _dtype=None):
                return np.zeros((4, 4, 3), dtype=np.uint8)

        class FakePredictor:
            def __init__(self):
                self.predict_calls: list[np.ndarray] = []

            def set_image(self, _image):
                pass

            def predict(self, *, box, multimask_output):
                self.predict_calls.append(np.asarray(box))
                masks = np.zeros((2, 3, 4, 4), dtype=bool)
                masks[0, 1, :2, :2] = True
                masks[1, 2, :, :1] = True
                scores = np.array([[0.1, 0.9, 0.2], [0.1, 0.2, 0.8]])
                return masks, scores, None

        predictor = FakePredictor()
        detections = [
            {"bbox": [0, 0, 2, 2], "class": "D00"},
            {"bbox": [1, 1, 3, 3], "class": "D10"},
        ]

        with unittest.mock.patch.object(sam2_inference, "load_model", return_value=predictor), \
             unittest.mock.patch("PIL.Image.open", return_value=FakeImage()):
            result = sam2_inference.run("/tmp/frame.jpg", detections)

        self.assertEqual(len(predictor.predict_calls), 1)
        self.assertEqual(predictor.predict_calls[0].shape, (2, 4))
        self.assertEqual(result[0]["mask_area_px"], 4.0)
        self.assertEqual(result[1]["mask_area_px"], 4.0)


@unittest.skipIf(np is None, "numpy is not installed in this local Python")
class TestDepthProBatch(unittest.TestCase):
    def test_infer_depth_maps_batches_model_call(self):
        from pipeline import depthpro_inference

        class FakeTensor:
            def to(self, _device: str):
                return self

        class FakeDepth:
            def detach(self):
                return self

            def cpu(self):
                return self

            def numpy(self):
                return np.stack(
                    [
                        np.ones((3, 3), dtype=np.float32),
                        np.full((3, 3), 2.0, dtype=np.float32),
                    ],
                    axis=0,
                )

        class FakeModel:
            def __init__(self):
                self.calls = 0

            def infer(self, _batch):
                self.calls += 1
                return {"depth": FakeDepth()}

        class FakeTransform:
            def __call__(self, _image):
                return FakeTensor()

        class FakeTorch:
            @staticmethod
            def stack(_tensors, dim=0):
                return FakeTensor()

            @staticmethod
            def no_grad():
                class Context:
                    def __enter__(self):
                        return None

                    def __exit__(self, _exc_type, _exc, _tb):
                        return False

                return Context()

        class FakeImage:
            def convert(self, _mode: str):
                return self

        model = FakeModel()
        with unittest.mock.patch.dict(sys.modules, {"torch": FakeTorch}), \
             unittest.mock.patch.object(depthpro_inference, "load_model", return_value=(model, FakeTransform(), "cuda")), \
             unittest.mock.patch("PIL.Image.open", return_value=FakeImage()):
            depth_maps = depthpro_inference.infer_depth_maps(["/tmp/a.jpg", "/tmp/b.jpg"])

        self.assertEqual(model.calls, 1)
        self.assertEqual(len(depth_maps), 2)
        self.assertEqual(float(depth_maps[0].mean()), 1.0)
        self.assertEqual(float(depth_maps[1].mean()), 2.0)


if __name__ == "__main__":
    unittest.main()
