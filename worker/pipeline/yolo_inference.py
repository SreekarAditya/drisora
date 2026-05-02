from __future__ import annotations

from pathlib import Path
from typing import Any

_MODEL: Any | None = None
_DEVICE: str | None = None
_LOAD_FAILED = False

WEIGHTS_PATH = Path(__file__).resolve().parents[1] / "weights" / "yolov12s_rdd2022.pt"
CLASS_NAMES = ("D00", "D10", "D20", "D40")
CONFIDENCE = 0.25
IOU = 0.45


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

        boxes = getattr(results[0], "boxes", None)
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
    except Exception as e:
        print(f"[YOLO] frame {frame_index} inference failed: {e}")
        return []


def run(image_path: str | Path | list[Any]) -> list[dict[str, Any]]:
    if isinstance(image_path, list):
        detections: list[dict[str, Any]] = []
        for frame in image_path:
            detections.extend(_run_one(_image_path(frame), _frame_index(frame)))
        return detections
    return _run_one(_image_path(image_path))


run_detect = run
run_inference = run
