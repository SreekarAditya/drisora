# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

from __future__ import annotations

import os
import urllib.request
from pathlib import Path
from typing import Any

import numpy as np

_PREDICTOR: Any | None = None
_LOAD_FAILED = False

MODEL_URL = os.environ.get(
    "SAM2_MODEL_URL",
    "https://dl.fbaipublicfiles.com/segment_anything_v2/sam2.1_hiera_small.pt",
)
MODEL_PATH = Path(os.environ.get("SAM2_MODEL_PATH", "/tmp/models/sam2.1_hiera_small.pt"))
MODEL_CFG = os.environ.get("SAM2_MODEL_CFG", "configs/sam2.1/sam2.1_hiera_s.yaml")


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
        print(f"[SAM2] device={device} model_path={MODEL_PATH}")
        sam_model = build_sam2(MODEL_CFG, str(MODEL_PATH), device=device)
        _PREDICTOR = SAM2ImagePredictor(sam_model)
    except Exception as e:
        print(f"[SAM2] LOAD FAILED: {e}")
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


def _mask_area_for_detection(masks: Any, scores: Any, index: int) -> float | None:
    mask_array = np.asarray(masks)
    score_array = np.asarray(scores) if scores is not None else np.array([])

    try:
        if mask_array.ndim == 4:
            detection_masks = mask_array[index]
            detection_scores = score_array[index] if score_array.ndim >= 2 else score_array
        elif mask_array.ndim == 3:
            detection_masks = mask_array
            detection_scores = score_array
        elif mask_array.ndim == 2:
            return float(mask_array.astype(bool).sum())
        else:
            return None

        best_idx = int(np.argmax(detection_scores)) if detection_scores is not None and len(detection_scores) else 0
        return float(np.asarray(detection_masks[best_idx]).astype(bool).sum())
    except Exception:
        return None


def _run_one(image_path: str, detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not detections:
        return []
    try:
        from PIL import Image

        predictor = load_model()
        image = np.array(Image.open(image_path).convert("RGB"))
        predictor.set_image(image)

        boxed_items: list[tuple[int, dict[str, Any], list[Any]]] = []
        segmented: list[dict[str, Any] | None] = [None] * len(detections)
        for detection_index, detection in enumerate(detections):
            bbox = detection.get("bbox")
            if not bbox or len(bbox) != 4:
                segmented[detection_index] = _fallback_detection(detection)
                continue
            boxed_items.append((detection_index, detection, bbox))

        if not boxed_items:
            return [item for item in segmented if item is not None]

        try:
            boxes = np.array([bbox for _index, _detection, bbox in boxed_items], dtype=np.float32)
            masks, scores, _ = predictor.predict(
                box=boxes,
                multimask_output=True,
            )
            for batch_index, (original_index, detection, _bbox) in enumerate(boxed_items):
                mask_area_px = _mask_area_for_detection(masks, scores, batch_index)
                if mask_area_px is None:
                    segmented[original_index] = _fallback_detection(detection)
                    continue
                updated = dict(detection)
                updated["mask_area_px"] = mask_area_px
                updated["mask_area_m2"] = None
                segmented[original_index] = updated

            return [item if item is not None else _fallback_detection(detections[index]) for index, item in enumerate(segmented)]
        except Exception as batch_exc:
            print(f"[SAM2] batched box prediction failed for {image_path}: {batch_exc}; falling back to per-box")

        for original_index, detection, bbox in boxed_items:
            try:
                masks, scores, _ = predictor.predict(
                    box=np.array(bbox, dtype=np.float32),
                    multimask_output=True,
                )
                if masks is None or len(masks) == 0:
                    segmented[original_index] = _fallback_detection(detection)
                    continue
                best_idx = int(np.argmax(scores)) if scores is not None and len(scores) else 0
                mask_area_px = float(np.asarray(masks[best_idx]).astype(bool).sum())
                updated = dict(detection)
                updated["mask_area_px"] = mask_area_px
                updated["mask_area_m2"] = None
                segmented[original_index] = updated
            except Exception:
                segmented[original_index] = _fallback_detection(detection)
        return [item if item is not None else _fallback_detection(detections[index]) for index, item in enumerate(segmented)]
    except Exception as e:
        print(f"[SAM2] _run_one failed for {image_path}: {e}")
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
