# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

from __future__ import annotations

import math
import os
import sys
import urllib.request
from pathlib import Path
from typing import Any

import numpy as np

_MODEL_AND_TRANSFORM: tuple[Any, Any, str] | None = None
_LOAD_FAILED = False

MODEL_URL = os.environ.get(
    "DEPTH_ANYTHING_V2_MODEL_URL",
    "https://huggingface.co/depth-anything/Depth-Anything-V2-Metric-VKITTI-Large/resolve/main/depth_anything_v2_metric_vkitti_vitl.pth",
)
MODEL_PATH = Path(
    os.environ.get(
        "DEPTH_ANYTHING_V2_MODEL_PATH",
        "/tmp/models/depth_anything_v2_metric_vkitti_vitl.pth",
    )
)
MODEL_REPO = os.environ.get("DEPTH_ANYTHING_V2_REPO")
ENCODER = os.environ.get("DEPTH_ANYTHING_V2_ENCODER", "vitl")
INPUT_SIZE = int(os.environ.get("DEPTH_ANYTHING_V2_INPUT_SIZE", "518"))
MAX_DEPTH_M = float(os.environ.get("DEPTH_ANYTHING_V2_MAX_DEPTH_M", "80"))

DEFAULT_DEPTH_M = 1.0
FOV_RADIANS = 1.0

_MODEL_CONFIGS: dict[str, dict[str, Any]] = {
    "vits": {"encoder": "vits", "features": 64, "out_channels": [48, 96, 192, 384]},
    "vitb": {"encoder": "vitb", "features": 128, "out_channels": [96, 192, 384, 768]},
    "vitl": {"encoder": "vitl", "features": 256, "out_channels": [256, 512, 1024, 1024]},
}


def _download(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.stat().st_size == 0:
        urllib.request.urlretrieve(url, path)


def _add_depth_anything_repo_to_path() -> None:
    if not MODEL_REPO:
        return
    repo = Path(MODEL_REPO)
    candidates = [repo, repo / "metric_depth"]
    for candidate in candidates:
        text = str(candidate)
        if candidate.exists() and text not in sys.path:
            sys.path.insert(0, text)


def load_model() -> tuple[Any, Any, str]:
    """Download, load, and cache Depth Anything V2 metric depth model."""
    global _MODEL_AND_TRANSFORM, _LOAD_FAILED
    if _MODEL_AND_TRANSFORM is not None:
        return _MODEL_AND_TRANSFORM
    if _LOAD_FAILED:
        raise RuntimeError("Depth Anything V2 model load previously failed")

    try:
        import torch

        _add_depth_anything_repo_to_path()
        from depth_anything_v2.dpt import DepthAnythingV2

        if ENCODER not in _MODEL_CONFIGS:
            raise ValueError(f"Unsupported DEPTH_ANYTHING_V2_ENCODER={ENCODER!r}")

        _download(MODEL_URL, MODEL_PATH)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = DepthAnythingV2(**{**_MODEL_CONFIGS[ENCODER], "max_depth": MAX_DEPTH_M})
        state = torch.load(str(MODEL_PATH), map_location="cpu")
        model.load_state_dict(state)
        model = model.to(device).eval()
        print(
            f"[DepthAnythingV2] device={device} encoder={ENCODER} "
            f"max_depth_m={MAX_DEPTH_M} model_path={MODEL_PATH}",
            flush=True,
        )
        _MODEL_AND_TRANSFORM = (model, None, device)
    except Exception as exc:
        print(f"[DepthAnythingV2] LOAD FAILED: {exc}", flush=True)
        _LOAD_FAILED = True
        raise
    return _MODEL_AND_TRANSFORM


def _image_path(value: Any) -> str:
    if isinstance(value, (str, Path)):
        return str(value)
    if isinstance(value, dict):
        return str(value.get("image_path") or value.get("path") or "")
    return str(getattr(value, "image_path", getattr(value, "path", "")))


def _frame_index(value: Any) -> Any:
    if isinstance(value, dict):
        return value.get("frame_index", value.get("index"))
    return getattr(value, "frame_index", getattr(value, "index", None))


def _detections_for_frame(detections: list[dict[str, Any]], frame_index: Any) -> list[dict[str, Any]]:
    if frame_index is None:
        return detections
    return [d for d in detections if d.get("frame_index") == frame_index]


def _fallback(detections: list[dict[str, Any]]) -> dict[str, Any]:
    updated: list[dict[str, Any]] = []
    for detection in detections or []:
        item = dict(detection)
        item["depth_m"] = None
        item["camera_surface_distance_m"] = None
        item["pixel_size_m"] = None
        item["mask_area_m2"] = None
        item["metric_error"] = "depth_anything_v2_unavailable"
        updated.append(item)
    return {"depth_map": np.array([], dtype=np.float32), "detections": updated}


def _center_depth(depth_map: np.ndarray, bbox: Any) -> float:
    if depth_map.size == 0:
        return DEFAULT_DEPTH_M
    try:
        x1, y1, x2, y2 = [float(v) for v in bbox]
        cx = int(round((x1 + x2) / 2.0))
        cy = int(round((y1 + y2) / 2.0))
        cy = max(0, min(depth_map.shape[0] - 1, cy))
        cx = max(0, min(depth_map.shape[1] - 1, cx))
        value = float(depth_map[cy, cx])
        return value if math.isfinite(value) and value > 0 else DEFAULT_DEPTH_M
    except Exception:
        return DEFAULT_DEPTH_M


def _focal_length_px(width: int) -> float:
    return float(width) / (2.0 * math.tan(FOV_RADIANS / 2.0))


def _crack_width_mm(item: dict[str, Any], pixel_size_m: float) -> float | None:
    crack_class = str(item.get("class") or "").upper()
    if crack_class == "D40":
        return None
    try:
        x1, y1, x2, y2 = [float(v) for v in item.get("bbox") or []]
        length_px = max(abs(x2 - x1), abs(y2 - y1))
        area_px = float(item.get("mask_area_px") or item.get("area_px") or 0.0)
        if length_px <= 0 or area_px <= 0 or pixel_size_m <= 0:
            return None
        width_m = (area_px / length_px) * pixel_size_m
        return width_m * 1000.0 if math.isfinite(width_m) and width_m > 0 else None
    except Exception:
        return None


def _infer_with_official_api(model: Any, image_path: str) -> np.ndarray:
    import cv2

    raw_image = cv2.imread(image_path)
    if raw_image is None:
        raise RuntimeError(f"OpenCV could not read image: {image_path}")
    depth = model.infer_image(raw_image, input_size=INPUT_SIZE)
    return np.asarray(depth, dtype=np.float32)


def _infer_with_transform(model: Any, transform: Any, device: str, image_paths: list[str]) -> list[np.ndarray]:
    import torch
    from PIL import Image

    tensors = []
    for image_path in image_paths:
        image = Image.open(image_path).convert("RGB")
        tensor = transform(image)
        tensors.append(tensor)

    batch = torch.stack(tensors, dim=0).to(device)
    with torch.no_grad():
        prediction = model.infer(batch)
    depth = prediction.get("depth") if isinstance(prediction, dict) else prediction
    if hasattr(depth, "detach"):
        depth = depth.detach().cpu().numpy()
    depth_array = np.asarray(depth, dtype=np.float32)
    if depth_array.ndim == 4 and depth_array.shape[1] == 1:
        depth_array = depth_array[:, 0, :, :]
    if depth_array.ndim == 2 and len(image_paths) == 1:
        return [depth_array]
    if depth_array.ndim == 3 and depth_array.shape[0] == len(image_paths):
        return [np.asarray(depth_array[index], dtype=np.float32) for index in range(len(image_paths))]
    raise RuntimeError(f"unexpected batched depth shape {depth_array.shape}")


def _infer_depth_map(image_path: str) -> np.ndarray:
    model, transform, device = load_model()
    if transform is not None and hasattr(model, "infer"):
        return _infer_with_transform(model, transform, device, [image_path])[0]
    if hasattr(model, "infer_image"):
        return _infer_with_official_api(model, image_path)
    raise RuntimeError("Depth model does not expose infer_image() or infer()")


def infer_depth_maps(image_paths: list[str]) -> list[np.ndarray]:
    if not image_paths:
        return []

    try:
        model, transform, device = load_model()
        if transform is not None and hasattr(model, "infer"):
            return _infer_with_transform(model, transform, device, image_paths)
        return [_infer_with_official_api(model, image_path) for image_path in image_paths]
    except Exception as exc:
        print(f"[DepthAnythingV2] batched depth inference failed: {exc}; falling back to per-frame", flush=True)
        return [_infer_depth_map(image_path) for image_path in image_paths]


def enrich_detections(depth_map: np.ndarray, detections: list[dict[str, Any]]) -> dict[str, Any]:
    try:
        width = int(depth_map.shape[1]) if depth_map.ndim >= 2 else 1
        focal_length_px = _focal_length_px(width)

        updated: list[dict[str, Any]] = []
        for detection in detections or []:
            item = dict(detection)
            depth_m = _center_depth(depth_map, item.get("bbox"))
            area_px = float(item.get("mask_area_px") or item.get("area_px") or 0.0)
            pixel_size_m = depth_m / focal_length_px if focal_length_px > 0 else 0.01
            item["depth_m"] = depth_m
            item["camera_surface_distance_m"] = depth_m
            item["pixel_size_m"] = pixel_size_m
            item["mask_area_m2"] = area_px * pixel_size_m * pixel_size_m
            crack_width_mm = _crack_width_mm(item, pixel_size_m)
            if crack_width_mm is not None:
                item["crack_width_mm"] = crack_width_mm
            updated.append(item)
        return {"depth_map": depth_map, "detections": updated}
    except Exception as exc:
        print(f"[DepthAnythingV2] detection enrichment failed: {exc}", flush=True)
        return _fallback(detections)


def _run_one(image_path: str, detections: list[dict[str, Any]]) -> dict[str, Any]:
    try:
        depth_map = _infer_depth_map(image_path)
        return enrich_detections(depth_map, detections)
    except Exception as exc:
        print(f"[DepthAnythingV2] frame inference failed: {exc}", flush=True)
        return _fallback(detections)


def run(
    image_path: str | Path | list[Any],
    detections: list[dict[str, Any]],
) -> dict[str, Any] | list[dict[str, Any]]:
    detections = detections or []
    if isinstance(image_path, list):
        all_detections: list[dict[str, Any]] = []
        for frame in image_path:
            idx = _frame_index(frame)
            result = _run_one(_image_path(frame), _detections_for_frame(detections, idx))
            all_detections.extend(result["detections"])
        return all_detections
    return _run_one(_image_path(image_path), detections)


def run_depth(
    image_path: str | Path | list[Any],
    detections: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | list[dict[str, Any]] | np.ndarray:
    result = run(image_path, detections or [])
    if not detections and isinstance(result, dict):
        return result["depth_map"]
    return result


depth = run
