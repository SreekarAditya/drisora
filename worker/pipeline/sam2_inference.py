# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

from __future__ import annotations

import os
import hashlib
import urllib.request
from pathlib import Path
from typing import Any

import numpy as np


_PREDICTOR: Any | None = None
_LOAD_FAILED = False

MODEL_URL = os.environ.get(
    "SAM2_MODEL_URL",
    "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_small.pt",
)
MODEL_PATH = Path(os.environ.get("SAM2_MODEL_PATH", "/tmp/models/sam2.1_hiera_small.pt"))
MODEL_CFG = os.environ.get("SAM2_MODEL_CFG", "configs/sam2.1/sam2.1_hiera_s.yaml")
MODEL_SHA256 = os.environ.get(
    "SAM2_MODEL_SHA256",
    "6d1aa6f30de5c92224f8172114de081d104bbd23dd9dc5c58996f0cad5dc4d38",
).lower()


class SegmentationError(RuntimeError):
    pass


def _download(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.stat().st_size == 0:
        request = urllib.request.Request(url, headers={"User-Agent": "Drisora/0.1 checkpoint fetch"})
        with urllib.request.urlopen(request) as response, path.open("wb") as destination:
            destination.write(response.read())
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != MODEL_SHA256:
        raise SegmentationError(
            f"SAM2 checkpoint SHA256 mismatch: expected {MODEL_SHA256}, got {actual}"
        )


def load_model() -> Any:
    """Download, load, and cache the SAM2 image predictor."""
    global _PREDICTOR, _LOAD_FAILED
    if _PREDICTOR is not None:
        return _PREDICTOR
    if _LOAD_FAILED:
        raise SegmentationError("SAM2 model load previously failed")
    try:
        import torch
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor

        _download(MODEL_URL, MODEL_PATH)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[SAM2] device={device} model_path={MODEL_PATH}")
        sam_model = build_sam2(MODEL_CFG, str(MODEL_PATH), device=device)
        _PREDICTOR = SAM2ImagePredictor(sam_model)
    except Exception as exc:
        print(f"[SAM2] LOAD FAILED: {exc}")
        _LOAD_FAILED = True
        raise SegmentationError(f"SAM2 model load failed: {exc}") from exc
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
    return [detection for detection in detections if detection.get("frame_index") == frame_index]


def _mask_area_for_detection(masks: Any, scores: Any, index: int) -> float:
    mask_array = np.asarray(masks)
    score_array = np.asarray(scores) if scores is not None else np.array([])
    if mask_array.ndim == 4:
        detection_masks = mask_array[index]
        detection_scores = score_array[index] if score_array.ndim >= 2 else score_array
    elif mask_array.ndim == 3:
        detection_masks = mask_array
        detection_scores = score_array
    elif mask_array.ndim == 2:
        area = float(mask_array.astype(bool).sum())
        if area <= 0.0:
            raise SegmentationError("SAM2 returned an empty mask")
        return area
    else:
        raise SegmentationError(f"SAM2 returned an unsupported mask rank: {mask_array.ndim}")
    best_index = int(np.argmax(detection_scores)) if len(detection_scores) else 0
    area = float(np.asarray(detection_masks[best_index]).astype(bool).sum())
    if area <= 0.0:
        raise SegmentationError("SAM2 returned an empty mask")
    return area


def _segment_per_box(
    predictor: Any,
    boxed_items: list[tuple[int, dict[str, Any], list[Any]]],
) -> list[dict[str, Any]]:
    segmented: list[dict[str, Any]] = []
    for _original_index, detection, bbox in boxed_items:
        try:
            masks, scores, _ = predictor.predict(
                box=np.array(bbox, dtype=np.float32),
                multimask_output=True,
            )
            area = _mask_area_for_detection(masks, scores, 0)
        except Exception as exc:
            if isinstance(exc, SegmentationError):
                raise
            raise SegmentationError(f"SAM2 per-box prediction failed: {exc}") from exc
        segmented.append({**detection, "mask_area_px": area, "area_source": "sam2_mask"})
    return segmented


def _run_one(image_path: str, detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not detections:
        return []
    if not image_path:
        raise SegmentationError("segmentation input image path is empty")
    from PIL import Image

    predictor = load_model()
    try:
        image = np.array(Image.open(image_path).convert("RGB"))
        predictor.set_image(image)
    except Exception as exc:
        raise SegmentationError(f"SAM2 could not prepare {image_path}: {exc}") from exc

    boxed_items: list[tuple[int, dict[str, Any], list[Any]]] = []
    for detection_index, detection in enumerate(detections):
        bbox = detection.get("bbox")
        if not bbox or len(bbox) != 4:
            raise SegmentationError("YOLO detection is missing a valid bbox")
        boxed_items.append((detection_index, detection, bbox))

    try:
        boxes = np.array([bbox for _index, _detection, bbox in boxed_items], dtype=np.float32)
        masks, scores, _ = predictor.predict(box=boxes, multimask_output=True)
        segmented: list[dict[str, Any]] = []
        for batch_index, (_original_index, detection, _bbox) in enumerate(boxed_items):
            area = _mask_area_for_detection(masks, scores, batch_index)
            segmented.append({**detection, "mask_area_px": area, "area_source": "sam2_mask"})
        return segmented
    except Exception as batch_exc:
        print(f"[SAM2] batched prediction failed for {image_path}: {batch_exc}; retrying per box")
        return _segment_per_box(predictor, boxed_items)


def run(image_path: str | Path | list[Any], detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not detections:
        return []
    if isinstance(image_path, list):
        segmented: list[dict[str, Any]] = []
        for frame in image_path:
            index = _frame_index(frame)
            segmented.extend(_run_one(_image_path(frame), _detections_for_frame(detections, index)))
        return segmented
    return _run_one(_image_path(image_path), detections)


run_segment = run
run_segmentation = run
segment = run
