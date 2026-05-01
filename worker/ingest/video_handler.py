"""Video frame extraction (OpenCV) and GPS attachment from SRT data."""

from __future__ import annotations

import bisect
import os
import tempfile
from pathlib import Path
from typing import List, Optional, Sequence, TypedDict

import cv2  # type: ignore[import-untyped]

from .srt_parser import SrtEntry


class Frame(TypedDict):
    index: int
    timestamp_ms: int
    path: str
    lat: Optional[float]
    lon: Optional[float]
    alt_m: Optional[float]
    gimbal_yaw: Optional[float]


def extract_frames(
    video_path: str | Path,
    interval_seconds: float,
    output_dir: Optional[str | Path] = None,
    image_format: str = "jpg",
    jpeg_quality: int = 92,
) -> List[Frame]:
    """Sample frames from a video at a fixed time interval.

    Saves frames to `output_dir` (a fresh tempdir if omitted) and returns
    a list of Frame dicts. GPS fields default to None — call
    `attach_gps_to_frames()` afterwards to populate them from SRT data.
    """
    if interval_seconds <= 0:
        raise ValueError("interval_seconds must be > 0")

    path = str(video_path)
    if not os.path.isfile(path):
        raise FileNotFoundError(path)

    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise RuntimeError(f"OpenCV could not open video: {path}")

    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        # Frames per sample step — at least 1 to avoid div-by-zero on short clips.
        step = max(1, int(round(fps * interval_seconds)))

        out_dir = Path(output_dir) if output_dir else Path(tempfile.mkdtemp(prefix="drisora_frames_"))
        out_dir.mkdir(parents=True, exist_ok=True)

        frames: List[Frame] = []
        sampled_idx = 0

        # Iterate by seeking to each target frame index. This is much faster
        # than reading every frame, especially for long clips.
        for src_idx in range(0, max(total_frames, 1), step):
            cap.set(cv2.CAP_PROP_POS_FRAMES, src_idx)
            ok, frame = cap.read()
            if not ok or frame is None:
                continue

            # Use the source frame's wall-clock position (ms) as the timestamp,
            # which is what the SRT entries are indexed by.
            timestamp_ms = int(round((src_idx / fps) * 1000.0))
            filename = f"frame_{sampled_idx:06d}.{image_format}"
            out_path = out_dir / filename

            if image_format.lower() in ("jpg", "jpeg"):
                cv2.imwrite(
                    str(out_path),
                    frame,
                    [int(cv2.IMWRITE_JPEG_QUALITY), int(jpeg_quality)],
                )
            else:
                cv2.imwrite(str(out_path), frame)

            frames.append(
                {
                    "index": sampled_idx,
                    "timestamp_ms": timestamp_ms,
                    "path": str(out_path),
                    "lat": None,
                    "lon": None,
                    "alt_m": None,
                    "gimbal_yaw": None,
                }
            )
            sampled_idx += 1

        return frames
    finally:
        cap.release()


def attach_gps_to_frames(
    frames: Sequence[Frame],
    srt_data: Sequence[SrtEntry],
) -> List[Frame]:
    """Match each frame to the nearest SRT entry by timestamp_ms.

    Returns a new list (the input frames are not mutated). When `srt_data`
    is empty, frames are returned unchanged.
    """
    if not srt_data:
        return list(frames)

    # Build a sorted timestamp index for fast nearest-neighbor lookup.
    sorted_srt = sorted(srt_data, key=lambda e: e["timestamp_ms"])
    timestamps = [e["timestamp_ms"] for e in sorted_srt]

    out: List[Frame] = []
    for frame in frames:
        ts = frame["timestamp_ms"]
        # bisect to find insertion point, then compare neighbors for true nearest.
        i = bisect.bisect_left(timestamps, ts)
        candidates = []
        if i < len(timestamps):
            candidates.append(sorted_srt[i])
        if i > 0:
            candidates.append(sorted_srt[i - 1])

        nearest = min(candidates, key=lambda e: abs(e["timestamp_ms"] - ts))

        merged: Frame = {
            **frame,
            "lat": nearest["lat"],
            "lon": nearest["lon"],
            "alt_m": nearest.get("alt_m"),
            "gimbal_yaw": nearest.get("gimbal_yaw"),
        }
        out.append(merged)

    return out
