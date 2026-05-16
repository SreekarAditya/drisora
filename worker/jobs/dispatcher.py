"""Job dispatcher — routes uploads to the correct ingest module.

Returns a uniform `FrameBatch` regardless of input mode, so the downstream
detection/scoring pipeline can be mode-agnostic.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, TypedDict

from ingest.image_batch import process_image_batch
from ingest.srt_parser import parse_srt
from ingest.video_handler import attach_gps_to_frames, extract_frames, last_extraction_metadata

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
    ingest_metadata: dict[str, Any]


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


def _frame_extraction_settings(files: Dict[str, Any]) -> tuple[str, float | None]:
    """Normalize frame extraction options from old and new job payloads."""
    raw_mode = files.get("frame_extraction_mode")
    interval_value = files.get("frame_interval_seconds")

    if isinstance(raw_mode, str) and raw_mode.strip():
        mode = raw_mode.strip().lower()
    elif interval_value is None:
        mode = "all_frames"
    else:
        mode = "interval"

    if mode not in {"interval", "all_frames"}:
        raise ValueError("frame_extraction_mode must be 'interval' or 'all_frames'")

    if mode == "all_frames":
        return mode, None

    return mode, float(interval_value if interval_value is not None else 1.0)


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
        "ingest_metadata": {"input_type": "image_batch"},
    }


def _dispatch_handheld_video(job_id: str, files: Dict[str, Any]) -> FrameBatch:
    video = files.get("video")
    if not video:
        raise ValueError("handheld_video requires 'video'")
    srt_path = files.get("srt")
    mode, interval = _frame_extraction_settings(files)

    raw_frames = extract_frames(video, interval_seconds=interval, extraction_mode=mode)
    ingest_metadata = last_extraction_metadata()
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
        "mode": "handheld_video",
        "gps_available": gps_available,
        "frame_count": len(frames),
        "frames": frames,
        "ingest_metadata": ingest_metadata,
    }


def _dispatch_drone_footage(job_id: str, files: Dict[str, Any]) -> FrameBatch:
    multi_video_entries = files.get("videos")
    if isinstance(multi_video_entries, list) and len(multi_video_entries) > 0:
        return _dispatch_multi_drone_footage(job_id, files)

    video = files.get("video")
    if not video:
        raise ValueError("drone_footage requires 'video'")
    srt_path = files.get("srt")
    mode, interval = _frame_extraction_settings(files)

    raw_frames = extract_frames(video, interval_seconds=interval, extraction_mode=mode)
    ingest_metadata = last_extraction_metadata()

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
        "ingest_metadata": ingest_metadata,
    }


def _dispatch_multi_drone_footage(job_id: str, files: Dict[str, Any]) -> FrameBatch:
    entries = files.get("videos")
    if not isinstance(entries, list) or len(entries) == 0:
        raise ValueError("multi-video drone_footage requires 'videos'")

    mode, interval = _frame_extraction_settings(files)
    frames: List[FrameBatchItem] = []
    extraction_runs: list[dict[str, Any]] = []

    for entry in entries:
        if not isinstance(entry, dict):
            continue

        video = entry.get("video")
        if not video:
            raise ValueError("multi-video drone_footage requires a video for each entry")

        srt_path = entry.get("srt")
        raw_frames = extract_frames(video, interval_seconds=interval, extraction_mode=mode)
        extraction_runs.append(last_extraction_metadata())
        srt_entries = parse_srt(srt_path) if srt_path else []
        enriched = attach_gps_to_frames(raw_frames, srt_entries) if srt_entries else raw_frames

        for frame in enriched:
            frames.append(
                {
                    "index": len(frames),
                    "path": frame["path"],
                    "timestamp_ms": frame["timestamp_ms"],
                    "lat": frame.get("lat"),
                    "lon": frame.get("lon"),
                    "alt_m": frame.get("alt_m"),
                    "gimbal_yaw": frame.get("gimbal_yaw"),
                }
            )

    gps_available = any(f["lat"] is not None and f["lon"] is not None for f in frames)

    return {
        "job_id": job_id,
        "mode": "drone_footage",
        "gps_available": gps_available,
        "frame_count": len(frames),
        "frames": frames,
        "ingest_metadata": {
            "input_type": "multi_video",
            "extraction_mode": mode,
            "frame_interval_seconds": interval,
            "videos": extraction_runs,
        },
    }
