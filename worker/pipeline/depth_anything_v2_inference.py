# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details

"""Optional relative-depth diagnostics, excluded from physical PCI inputs.

Depth Anything V2 output from a monocular frame is not used as rut depth,
roughness, GSD, crack width, or metric mask area. This module intentionally
exposes depth arrays only and raises on model/inference failure.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

import numpy as np

_MODEL_AND_TRANSFORM: tuple[Any, Any, str] | None = None
MODEL_PATH = Path(os.environ.get("DEPTH_ANYTHING_V2_MODEL_PATH", ""))
MODEL_REPO = os.environ.get("DEPTH_ANYTHING_V2_REPO", "")
ENCODER = os.environ.get("DEPTH_ANYTHING_V2_ENCODER", "vitl")
INPUT_SIZE = int(os.environ.get("DEPTH_ANYTHING_V2_INPUT_SIZE", "518"))
_MODEL_CONFIGS: dict[str, dict[str, Any]] = {
    "vits": {"encoder": "vits", "features": 64, "out_channels": [48, 96, 192, 384]},
    "vitb": {"encoder": "vitb", "features": 128, "out_channels": [96, 192, 384, 768]},
    "vitl": {"encoder": "vitl", "features": 256, "out_channels": [256, 512, 1024, 1024]},
}


class RelativeDepthError(RuntimeError):
    pass


def load_model() -> tuple[Any, Any, str]:
    global _MODEL_AND_TRANSFORM
    if _MODEL_AND_TRANSFORM is not None:
        return _MODEL_AND_TRANSFORM
    if not MODEL_REPO or not Path(MODEL_REPO).is_dir():
        raise RelativeDepthError("DEPTH_ANYTHING_V2_REPO must name a pinned local checkout")
    if not MODEL_PATH.is_file():
        raise RelativeDepthError("DEPTH_ANYTHING_V2_MODEL_PATH must name a pinned local checkpoint")
    if ENCODER not in _MODEL_CONFIGS:
        raise RelativeDepthError(f"unsupported encoder {ENCODER!r}")
    for candidate in (Path(MODEL_REPO), Path(MODEL_REPO) / "metric_depth"):
        if str(candidate) not in sys.path:
            sys.path.insert(0, str(candidate))
    try:
        import torch
        from depth_anything_v2.dpt import DepthAnythingV2

        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = DepthAnythingV2(**_MODEL_CONFIGS[ENCODER])
        model.load_state_dict(torch.load(str(MODEL_PATH), map_location="cpu"))
        _MODEL_AND_TRANSFORM = (model.to(device).eval(), None, device)
        return _MODEL_AND_TRANSFORM
    except Exception as exc:
        raise RelativeDepthError(f"relative-depth model load failed: {exc}") from exc


def _infer_official(model: Any, image_path: str) -> np.ndarray:
    import cv2

    image = cv2.imread(image_path)
    if image is None:
        raise RelativeDepthError(f"OpenCV could not read image: {image_path}")
    return np.asarray(model.infer_image(image, input_size=INPUT_SIZE), dtype=np.float32)


def _infer_batched(model: Any, transform: Any, device: str, paths: list[str]) -> list[np.ndarray]:
    import torch
    from PIL import Image

    batch = torch.stack([transform(Image.open(path).convert("RGB")) for path in paths], dim=0).to(device)
    with torch.no_grad():
        prediction = model.infer(batch)
    depth = prediction.get("depth") if isinstance(prediction, dict) else prediction
    values = np.asarray(depth.detach().cpu().numpy() if hasattr(depth, "detach") else depth, dtype=np.float32)
    if values.ndim == 4 and values.shape[1] == 1:
        values = values[:, 0]
    if values.ndim == 2 and len(paths) == 1:
        return [values]
    if values.ndim != 3 or values.shape[0] != len(paths):
        raise RelativeDepthError(f"unexpected batched depth shape {values.shape}")
    return [values[index] for index in range(len(paths))]


def infer_depth_maps(image_paths: list[str]) -> list[np.ndarray]:
    if not image_paths:
        return []
    model, transform, device = load_model()
    if transform is not None and hasattr(model, "infer"):
        return _infer_batched(model, transform, device, image_paths)
    if hasattr(model, "infer_image"):
        return [_infer_official(model, path) for path in image_paths]
    raise RelativeDepthError("relative-depth model has no supported inference API")


def run(image_path: str | Path | list[str]) -> np.ndarray | list[np.ndarray]:
    paths = [str(value) for value in image_path] if isinstance(image_path, list) else [str(image_path)]
    outputs = infer_depth_maps(paths)
    return outputs if isinstance(image_path, list) else outputs[0]
