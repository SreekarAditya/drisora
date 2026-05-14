from __future__ import annotations

import io
import logging
import math
import os
import sys
import urllib.request
from dataclasses import replace
from pathlib import Path
from typing import Any

import numpy as np

_MODEL_AND_TRANSFORM: tuple[Any, Any, str] | None = None
_LOAD_FAILED = False

MODEL_URL = os.environ.get("DEPTHPRO_MODEL_URL", "https://ml-site.cdn-apple.com/models/depth-pro/depth_pro.pt")
MODEL_PATH = Path(os.environ.get("DEPTHPRO_MODEL_PATH", "/tmp/models/depth_pro.pt"))
DEFAULT_DEPTH_M = 1.0
FOV_RADIANS = 1.0


def _download(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.stat().st_size == 0:
        urllib.request.urlretrieve(url, path)


def load_model() -> tuple[Any, Any, str]:
    """Download, load, and cache Depth Pro model/transforms."""
    global _MODEL_AND_TRANSFORM, _LOAD_FAILED
    if _MODEL_AND_TRANSFORM is not None:
        return _MODEL_AND_TRANSFORM
    if _LOAD_FAILED:
        raise RuntimeError("DepthPro model load previously failed")

    try:
        import torch
        import depth_pro

        _download(MODEL_URL, MODEL_PATH)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        precision = torch.float16 if device == "cuda" else torch.float32
        print(f"[DepthPro] device={device} precision={precision} model_path={MODEL_PATH}")
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        previous_logging_disable = logging.root.manager.disable
        sys.stdout = io.StringIO()
        sys.stderr = io.StringIO()
        logging.disable(logging.CRITICAL)
        try:
            from depth_pro.depth_pro import DEFAULT_MONODEPTH_CONFIG_DICT

            config = replace(DEFAULT_MONODEPTH_CONFIG_DICT, checkpoint_uri=str(MODEL_PATH))
            model, transform = depth_pro.create_model_and_transforms(
                config=config,
                device=device,
                precision=precision,
            )
        except TypeError:
            model, transform = depth_pro.create_model_and_transforms()
            model = model.to(device)
            try:
                model.load_state_dict(torch.load(str(MODEL_PATH), map_location=device), strict=False)
            except Exception as e:
                print(f"[DepthPro] checkpoint load failed: {e}", file=old_stdout)
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr
            logging.disable(previous_logging_disable)
        model.eval()
        _MODEL_AND_TRANSFORM = (model, transform, device)
    except Exception as e:
        print(f"[DepthPro] LOAD FAILED: {e}")
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
        item["metric_error"] = "depthpro_unavailable"
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
            item["camera_surface_distance_m"] = depth_m
            item["pixel_size_m"] = pixel_size_m
            item["mask_area_m2"] = area_px * pixel_size_m * pixel_size_m
            crack_width_mm = _crack_width_mm(item, pixel_size_m)
            if crack_width_mm is not None:
                item["crack_width_mm"] = crack_width_mm
            updated.append(item)
        return {"depth_map": depth_map, "detections": updated}
    except Exception as e:
        print(f"[DepthPro] frame inference failed: {e}")
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
