from __future__ import annotations

import urllib.request
from pathlib import Path
from typing import Any

import numpy as np

_PREDICTOR: Any | None = None
_LOAD_FAILED = False

MODEL_URL = "https://dl.fbaipublicfiles.com/segment_anything_v2/sam2.1_hiera_small.pt"
MODEL_PATH = Path("/tmp/models/sam2.1_hiera_small.pt")
MODEL_CFG = "configs/sam2.1/sam2.1_hiera_s.yaml"


def _download(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.stat().st_size == 0:
        urllib.request.urlretrieve(url, path)


def load_model() -> Any:
    """Download, load, and cache the SAM2 image predictor."""
    global _PREDICTOR, _LOAD_FAILED
    if _PREDICTOR is not None:
        return _PREDICTOR
    if _LOAD_FAILED:
        raise RuntimeError("SAM2 model load previously failed")

    try:
        import torch
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor

        _download(MODEL_URL, MODEL_PATH)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        sam_model = build_sam2(MODEL_CFG, str(MODEL_PATH), device=device)
        _PREDICTOR = SAM2ImagePredictor(sam_model)
    except Exception:
        _LOAD_FAILED = True
        raise
    return _PREDICTOR


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


def _fallback_detection(detection: dict[str, Any]) -> dict[str, Any]:
    updated = dict(detection)
    updated["mask_area_px"] = float(updated.get("area_px") or 0.0)
    updated["mask_area_m2"] = None
    return updated


def _run_one(image_path: str, detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not detections:
        return []
    try:
        from PIL import Image

        predictor = load_model()
        image = np.array(Image.open(image_path).convert("RGB"))
        predictor.set_image(image)

        segmented: list[dict[str, Any]] = []
        for detection in detections:
            bbox = detection.get("bbox")
            if not bbox or len(bbox) != 4:
                segmented.append(_fallback_detection(detection))
                continue

            try:
                masks, scores, _ = predictor.predict(
                    box=np.array(bbox, dtype=np.float32),
                    multimask_output=True,
                )
                if masks is None or len(masks) == 0:
                    segmented.append(_fallback_detection(detection))
                    continue
                best_idx = int(np.argmax(scores)) if scores is not None and len(scores) else 0
                mask_area_px = float(np.asarray(masks[best_idx]).astype(bool).sum())
                updated = dict(detection)
                updated["mask_area_px"] = mask_area_px
                updated["mask_area_m2"] = None
                segmented.append(updated)
            except Exception:
                segmented.append(_fallback_detection(detection))
        return segmented
    except Exception:
        return [_fallback_detection(detection) for detection in detections]


def run(image_path: str | Path | list[Any], detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not detections:
        return []
    if isinstance(image_path, list):
        segmented: list[dict[str, Any]] = []
        for frame in image_path:
            idx = _frame_index(frame)
            segmented.extend(_run_one(_image_path(frame), _detections_for_frame(detections, idx)))
        return segmented
    return _run_one(_image_path(image_path), detections)


run_segment = run
run_segmentation = run
segment = run
