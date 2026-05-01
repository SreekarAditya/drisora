"""Job dispatcher — routes uploads to the correct ingest module.

Returns a uniform `FrameBatch` regardless of input mode, so the downstream
detection/scoring pipeline can be mode-agnostic.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, TypedDict

from worker.ingest.image_batch import process_image_batch
from worker.ingest.srt_parser import parse_srt
from worker.ingest.video_handler import attach_gps_to_frames, extract_frames

# --- Public types -----------------------------------------------------------


class FrameBatchItem(TypedDict):
    index: int
    path: str
    timestamp_ms: Optional[int]
    lat: Optional[float]
    lon: Optional[float]
    alt_m: Optional[float]
    gimbal_yaw: Optional[float]


class FrameBatch(TypedDict):
    job_id: str
    mode: str
    gps_available: bool
    frame_count: int
    frames: List[FrameBatchItem]


# --- Dispatch ---------------------------------------------------------------


def dispatch_job(job_id: str, mode: str, files: Dict[str, Any]) -> FrameBatch:
    """Run mode-specific ingestion and produce a uniform FrameBatch.

    Parameters
    ----------
    job_id: identifier for the survey job (echoed back into the result).
    mode:   "image_batch" | "handheld_video" | "drone_footage".
    files:  mode-dependent payload, e.g.:
        image_batch    -> {"images": [path, path, ...]}
        handheld_video -> {"video": path, "frame_interval_seconds": float}
        drone_footage  -> {"video": path, "srt": Optional[path],
                           "frame_interval_seconds": float}

    Returns a `FrameBatch` ready for the detection pipeline.
    """
    if mode == "image_batch":
        return _dispatch_image_batch(job_id, files)
    if mode == "handheld_video":
        return _dispatch_handheld_video(job_id, files)
    if mode == "drone_footage":
        return _dispatch_drone_footage(job_id, files)
    raise ValueError(f"Unknown job mode: {mode!r}")


# --- Per-mode handlers ------------------------------------------------------


def _dispatch_image_batch(job_id: str, files: Dict[str, Any]) -> FrameBatch:
    image_paths: Sequence[str] = files.get("images") or []
    if not image_paths:
        raise ValueError("image_batch requires 'images' (non-empty list)")

    records = process_image_batch(image_paths)

    frames: List[FrameBatchItem] = [
        {
            "index": r["index"],
            "path": r["path"],
            "timestamp_ms": None,  # No video timeline for batch
            "lat": r["lat"],
            "lon": r["lon"],
            "alt_m": r["alt"],
            "gimbal_yaw": None,
        }
        for r in records
    ]

    gps_available = any(f["lat"] is not None and f["lon"] is not None for f in frames)

    return {
        "job_id": job_id,
        "mode": "image_batch",
        "gps_available": gps_available,
        "frame_count": len(frames),
        "frames": frames,
    }


def _dispatch_handheld_video(job_id: str, files: Dict[str, Any]) -> FrameBatch:
    video = files.get("video")
    if not video:
        raise ValueError("handheld_video requires 'video'")
    interval = float(files.get("frame_interval_seconds", 1.0))

    raw_frames = extract_frames(video, interval_seconds=interval)

    frames: List[FrameBatchItem] = [
        {
            "index": f["index"],
            "path": f["path"],
            "timestamp_ms": f["timestamp_ms"],
            "lat": None,
            "lon": None,
            "alt_m": None,
            "gimbal_yaw": None,
        }
        for f in raw_frames
    ]

    return {
        "job_id": job_id,
        "mode": "handheld_video",
        "gps_available": False,
        "frame_count": len(frames),
        "frames": frames,
    }


def _dispatch_drone_footage(job_id: str, files: Dict[str, Any]) -> FrameBatch:
    video = files.get("video")
    if not video:
        raise ValueError("drone_footage requires 'video'")
    srt_path = files.get("srt")
    interval = float(files.get("frame_interval_seconds", 1.0))

    raw_frames = extract_frames(video, interval_seconds=interval)

    srt_entries = parse_srt(srt_path) if srt_path else []
    enriched = attach_gps_to_frames(raw_frames, srt_entries) if srt_entries else raw_frames

    frames: List[FrameBatchItem] = [
        {
            "index": f["index"],
            "path": f["path"],
            "timestamp_ms": f["timestamp_ms"],
            "lat": f.get("lat"),
            "lon": f.get("lon"),
            "alt_m": f.get("alt_m"),
            "gimbal_yaw": f.get("gimbal_yaw"),
        }
        for f in enriched
    ]

    gps_available = any(f["lat"] is not None and f["lon"] is not None for f in frames)

    return {
        "job_id": job_id,
        "mode": "drone_footage",
        "gps_available": gps_available,
        "frame_count": len(frames),
        "frames": frames,
    }
