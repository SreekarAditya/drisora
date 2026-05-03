"""Video frame extraction (OpenCV) and GPS attachment from SRT data."""

from __future__ import annotations

import bisect
import os
import shutil
import subprocess
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

    if os.environ.get("DRISORA_USE_FFMPEG_EXTRACTOR", "1").strip().lower() in {"1", "true", "yes", "on"}:
        try:
            return _extract_frames_ffmpeg(
                path,
                interval_seconds=interval_seconds,
                output_dir=output_dir,
                image_format=image_format,
                jpeg_quality=jpeg_quality,
            )
        except Exception as exc:
            print(f"[FRAMES] ffmpeg extraction failed, falling back to OpenCV: {exc}", flush=True)

    return _extract_frames_opencv(
        path,
        interval_seconds=interval_seconds,
        output_dir=output_dir,
        image_format=image_format,
        jpeg_quality=jpeg_quality,
    )


def _frame_record(index: int, timestamp_ms: int, path: Path) -> Frame:
    return {
        "index": index,
        "timestamp_ms": timestamp_ms,
        "path": str(path),
        "lat": None,
        "lon": None,
        "alt_m": None,
        "gimbal_yaw": None,
    }


def _ffmpeg_quality(jpeg_quality: int) -> int:
    quality = max(1, min(100, int(jpeg_quality)))
    return max(2, min(31, round(31 - ((quality / 100.0) * 29))))


def _run_ffmpeg(command: list[str]) -> None:
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        stderr = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(stderr or f"ffmpeg exited with code {result.returncode}")


def _extract_frames_ffmpeg(
    path: str,
    interval_seconds: float,
    output_dir: Optional[str | Path] = None,
    image_format: str = "jpg",
    jpeg_quality: int = 92,
) -> List[Frame]:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg not found")

    out_dir = Path(output_dir) if output_dir else Path(tempfile.mkdtemp(prefix="drisora_frames_"))
    out_dir.mkdir(parents=True, exist_ok=True)

    extension = "jpg" if image_format.lower() in {"jpg", "jpeg"} else image_format.lower()
    pattern = str(out_dir / f"frame_%06d.{extension}")
    sample_fps = 1.0 / interval_seconds
    vf = f"fps={sample_fps:.6f}"
    base = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
    output_args = ["-vf", vf, "-start_number", "0"]
    if extension in {"jpg", "jpeg"}:
        output_args.extend(["-q:v", str(_ffmpeg_quality(jpeg_quality))])
    output_args.append(pattern)

    gpu_command = base + ["-hwaccel", "cuda", "-i", path] + output_args
    cpu_command = base + ["-i", path] + output_args

    try:
        _run_ffmpeg(gpu_command)
        print("[FRAMES] extracted with ffmpeg cuda hwaccel", flush=True)
    except Exception as exc:
        print(f"[FRAMES] ffmpeg cuda extraction unavailable: {exc}", flush=True)
        _run_ffmpeg(cpu_command)
        print("[FRAMES] extracted with ffmpeg cpu fallback", flush=True)

    paths = sorted(out_dir.glob(f"frame_*.{extension}"))
    if not paths:
        raise RuntimeError("ffmpeg produced no frames")
    print(f"[FRAMES] extracted {len(paths)} sampled frames", flush=True)
    return [
        _frame_record(index, int(round(index * interval_seconds * 1000.0)), frame_path)
        for index, frame_path in enumerate(paths)
    ]


def _extract_frames_opencv(
    path: str,
    interval_seconds: float,
    output_dir: Optional[str | Path] = None,
    image_format: str = "jpg",
    jpeg_quality: int = 92,
) -> List[Frame]:
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

            frames.append(_frame_record(sampled_idx, timestamp_ms, out_path))
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
