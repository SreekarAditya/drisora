from __future__ import annotations

import math
import urllib.request
from pathlib import Path
from typing import Any

import numpy as np

_MODEL_AND_TRANSFORM: tuple[Any, Any, str] | None = None

MODEL_URL = "https://ml-site.cdn-apple.com/models/depth-pro/depth_pro.pt"
MODEL_PATH = Path("/tmp/models/depth_pro.pt")
DEFAULT_DEPTH_M = 1.0
FALLBACK_AREA_SCALE_M2_PER_PX = 0.0001
FOV_RADIANS = 1.0


def _download(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.stat().st_size == 0:
        urllib.request.urlretrieve(url, path)


def load_model() -> tuple[Any, Any, str]:
    """Download, load, and cache Depth Pro model/transforms."""
    global _MODEL_AND_TRANSFORM
    if _MODEL_AND_TRANSFORM is not None:
        return _MODEL_AND_TRANSFORM

    import torch
    import depth_pro

    _download(MODEL_URL, MODEL_PATH)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    try:
        model, transform = depth_pro.create_model_and_transforms(
            device=device,
            precision=torch.float16 if device == "cuda" else torch.float32,
        )
    except TypeError:
        model, transform = depth_pro.create_model_and_transforms()
        model = model.to(device)
    try:
        model.load_state_dict(torch.load(str(MODEL_PATH), map_location=device), strict=False)
    except Exception:
        pass
    model.eval()
    _MODEL_AND_TRANSFORM = (model, transform, device)
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
        area_px = float(item.get("mask_area_px") or item.get("area_px") or 0.0)
        item["depth_m"] = DEFAULT_DEPTH_M
        item["mask_area_m2"] = area_px * FALLBACK_AREA_SCALE_M2_PER_PX
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


def _infer_depth_map(image_path: str) -> np.ndarray:
    import torch
    from PIL import Image

    model, transform, device = load_model()
    image = Image.open(image_path).convert("RGB")
    tensor = transform(image)
    if hasattr(tensor, "unsqueeze"):
        tensor = tensor.unsqueeze(0).to(device)
    with torch.no_grad():
        prediction = model.infer(tensor)
    depth = prediction.get("depth") if isinstance(prediction, dict) else prediction
    if hasattr(depth, "squeeze"):
        depth = depth.squeeze().detach().cpu().numpy()
    return np.asarray(depth, dtype=np.float32)


def _run_one(image_path: str, detections: list[dict[str, Any]]) -> dict[str, Any]:
    try:
        depth_map = _infer_depth_map(image_path)
        width = int(depth_map.shape[1]) if depth_map.ndim >= 2 else 1
        focal_length_px = _focal_length_px(width)

        updated: list[dict[str, Any]] = []
        for detection in detections or []:
            item = dict(detection)
            depth_m = _center_depth(depth_map, item.get("bbox"))
            area_px = float(item.get("mask_area_px") or item.get("area_px") or 0.0)
            pixel_size_m = depth_m / focal_length_px if focal_length_px > 0 else 0.01
            item["depth_m"] = depth_m
            item["mask_area_m2"] = area_px * pixel_size_m * pixel_size_m
            updated.append(item)
        return {"depth_map": depth_map, "detections": updated}
    except Exception:
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
