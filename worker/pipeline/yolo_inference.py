# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

from __future__ import annotations

import os
import urllib.request
from pathlib import Path
from typing import Any

_MODEL: Any | None = None
_DEVICE: str | None = None
_LOAD_FAILED = False

WEIGHTS_PATH = Path(
    os.environ.get(
        "DRISORA_YOLO_WEIGHTS_PATH",
        str(Path(__file__).resolve().parents[1] / "weights" / "yolov12s_rdd2022.pt"),
    )
)
WEIGHTS_URL = os.environ.get("DRISORA_YOLO_WEIGHTS_URL", "")
CLASS_NAMES = ("D00", "D10", "D20", "D40")
CONFIDENCE = 0.25
IOU = 0.45


def _ensure_weights() -> None:
    if WEIGHTS_PATH.exists() and WEIGHTS_PATH.stat().st_size > 0:
        return
    if not WEIGHTS_URL:
        raise FileNotFoundError(
            f"YOLOv12s weights not found at {WEIGHTS_PATH}. "
            "Set DRISORA_YOLO_WEIGHTS_URL or place the checkpoint at DRISORA_YOLO_WEIGHTS_PATH."
        )
    WEIGHTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(WEIGHTS_URL, WEIGHTS_PATH)


def load_model() -> Any:
    """Load and cache the YOLOv12s RDD2022 model."""
    global _MODEL, _DEVICE, _LOAD_FAILED
    if _MODEL is not None:
        return _MODEL
    if _LOAD_FAILED:
        raise RuntimeError("YOLO model load previously failed")

    try:
        import torch
        from ultralytics import YOLO
    except Exception as e:
        print(f"[YOLO] LOAD FAILED: {e}")
        _LOAD_FAILED = True
        raise

    _DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    _ensure_weights()
    print(f"[YOLO] device={_DEVICE} weights={WEIGHTS_PATH}")
    try:
        model = YOLO(str(WEIGHTS_PATH))
    except Exception as e:
        print(f"[YOLO] LOAD FAILED: {e}")
        _LOAD_FAILED = True
        raise

    try:
        model.to(_DEVICE)
    except Exception:
        # Ultralytics can still accept device=... at inference time.
        pass
    _MODEL = model
    return _MODEL


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


def _class_name(model: Any, cls_id: int) -> str:
    names = getattr(model, "names", None) or {}
    raw_name = names.get(cls_id) if isinstance(names, dict) else None
    if isinstance(raw_name, str) and raw_name in CLASS_NAMES:
        return raw_name
    if 0 <= cls_id < len(CLASS_NAMES):
        return CLASS_NAMES[cls_id]
    return str(raw_name or cls_id)


def _detections_from_result(model: Any, result: Any, frame_index: Any = None) -> list[dict[str, Any]]:
    boxes = getattr(result, "boxes", None)
    if boxes is None or len(boxes) == 0:
        return []

    detections: list[dict[str, Any]] = []
    xyxy = boxes.xyxy.detach().cpu().numpy()
    confs = boxes.conf.detach().cpu().numpy()
    classes = boxes.cls.detach().cpu().numpy()
    for bbox_arr, conf, cls in zip(xyxy, confs, classes):
        x1, y1, x2, y2 = [float(v) for v in bbox_arr]
        area_px = max(0.0, x2 - x1) * max(0.0, y2 - y1)
        detection: dict[str, Any] = {
            "class": _class_name(model, int(cls)),
            "confidence": float(conf),
            "bbox": [x1, y1, x2, y2],
            "area_px": float(area_px),
        }
        if frame_index is not None:
            detection["frame_index"] = frame_index
        detections.append(detection)
    return detections


def _run_one(image_path: str, frame_index: Any = None) -> list[dict[str, Any]]:
    if not image_path:
        return []
    try:
        model = load_model()
        results = model.predict(
            source=image_path,
            conf=CONFIDENCE,
            iou=IOU,
            device=_DEVICE or "cpu",
            verbose=False,
        )
        if not results:
            return []
        return _detections_from_result(model, results[0], frame_index)
    except Exception as e:
        print(f"[YOLO] frame {frame_index} inference failed: {e}")
        return []


def _run_batch(frames: list[Any], batch_size: int = 64) -> list[dict[str, Any]]:
    items = [(_image_path(frame), _frame_index(frame)) for frame in frames]
    items = [(path, frame_index) for path, frame_index in items if path]
    if not items:
        return []

    try:
        model = load_model()
        results = model.predict(
            source=[path for path, _frame_index in items],
            conf=CONFIDENCE,
            iou=IOU,
            device=_DEVICE or "cpu",
            verbose=False,
            batch=max(1, int(batch_size)),
        )

        detections: list[dict[str, Any]] = []
        for (_path, frame_index), result in zip(items, results or []):
            detections.extend(_detections_from_result(model, result, frame_index))
        return detections
    except Exception as e:
        print(f"[YOLO] batch inference failed: {e}; falling back to per-frame inference")
        detections: list[dict[str, Any]] = []
        for path, frame_index in items:
            detections.extend(_run_one(path, frame_index))
        return detections


def run(image_path: str | Path | list[Any], batch_size: int | None = None) -> list[dict[str, Any]]:
    if isinstance(image_path, list):
        return _run_batch(image_path, batch_size=batch_size or 64)
    return _run_one(_image_path(image_path))


run_detect = run
run_inference = run
