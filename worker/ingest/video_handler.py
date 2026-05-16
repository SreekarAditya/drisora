"""Video frame extraction and GPS attachment from SRT data."""

from __future__ import annotations

import bisect
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, List, Optional, Sequence, TypedDict

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


_LAST_EXTRACTION_METADATA: dict[str, Any] = {}


def last_extraction_metadata() -> dict[str, Any]:
    return dict(_LAST_EXTRACTION_METADATA)


def extract_frames(
    video_path: str | Path,
    interval_seconds: float | None = 1.0,
    output_dir: Optional[str | Path] = None,
    image_format: str = "jpg",
    jpeg_quality: int = 92,
    extraction_mode: str | None = None,
) -> List[Frame]:
    """Extract frames from a video.

    `extraction_mode="all_frames"` preserves every decoded frame. Interval
    mode samples frames at a fixed time step. GPS fields default to None;
    call `attach_gps_to_frames()` afterwards to populate them from SRT data.
    """
    global _LAST_EXTRACTION_METADATA
    mode = (extraction_mode or ("all_frames" if interval_seconds is None else "interval")).strip().lower()
    if mode not in {"interval", "all_frames"}:
        raise ValueError("extraction_mode must be 'interval' or 'all_frames'")
    if mode == "interval" and (interval_seconds is None or interval_seconds <= 0):
        raise ValueError("interval_seconds must be > 0")

    path = str(video_path)
    if not os.path.isfile(path):
        raise FileNotFoundError(path)

    _LAST_EXTRACTION_METADATA = {
        "video_path": Path(path).name,
        "extraction_mode": mode,
        "frame_interval_seconds": interval_seconds if mode == "interval" else None,
        "image_format": image_format,
        "jpeg_quality": jpeg_quality,
    }

    if os.environ.get("DRISORA_USE_FFMPEG_EXTRACTOR", "1").strip().lower() in {"1", "true", "yes", "on"}:
        try:
            frames = _extract_frames_ffmpeg(
                path,
                interval_seconds=interval_seconds,
                output_dir=output_dir,
                image_format=image_format,
                jpeg_quality=jpeg_quality,
                extraction_mode=mode,
            )
            _LAST_EXTRACTION_METADATA["actual_frame_count"] = len(frames)
            return frames
        except Exception as exc:
            if mode == "all_frames":
                raise
            print(f"[FRAMES] ffmpeg extraction failed, falling back to OpenCV: {exc}", flush=True)

    frames = _extract_frames_opencv(
        path,
        interval_seconds=float(interval_seconds or 1.0),
        output_dir=output_dir,
        image_format=image_format,
        jpeg_quality=jpeg_quality,
    )
    _LAST_EXTRACTION_METADATA["extractor_backend"] = "opencv"
    _LAST_EXTRACTION_METADATA["actual_frame_count"] = len(frames)
    return frames


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


def _parse_rate(value: str | None) -> float | None:
    if not value or value in {"0/0", "N/A"}:
        return None
    try:
        if "/" in value:
            num, den = value.split("/", 1)
            den_value = float(den)
            return float(num) / den_value if den_value else None
        return float(value)
    except Exception:
        return None


def _parse_optional_int(value: Any) -> int | None:
    text = str(value or "")
    return int(text) if text.isdigit() else None


def _probe_video(path: str) -> dict[str, Any]:
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        return {}
    command = [
        ffprobe,
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=avg_frame_rate,r_frame_rate,nb_frames,duration,width,height,codec_name",
        "-of",
        "json",
        path,
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        return {}
    try:
        data = json.loads(result.stdout or "{}")
        stream = (data.get("streams") or [{}])[0]
        fps = _parse_rate(stream.get("avg_frame_rate")) or _parse_rate(stream.get("r_frame_rate"))
        duration = float(stream["duration"]) if stream.get("duration") not in {None, "N/A"} else None
        nb_frames = _parse_optional_int(stream.get("nb_frames"))
        codec_name = stream.get("codec_name")
        return {
            "fps": fps,
            "duration_seconds": duration,
            "reported_frame_count": nb_frames,
            "source_width": _parse_optional_int(stream.get("width")),
            "source_height": _parse_optional_int(stream.get("height")),
            "source_codec": codec_name if isinstance(codec_name, str) and codec_name else None,
        }
    except Exception:
        return {}


def _expected_count(metadata: dict[str, Any], interval_seconds: float | None, mode: str) -> int | None:
    if mode == "all_frames":
        if isinstance(metadata.get("reported_frame_count"), int):
            return int(metadata["reported_frame_count"])
        fps = metadata.get("fps")
        duration = metadata.get("duration_seconds")
        if isinstance(fps, (int, float)) and isinstance(duration, (int, float)):
            return max(1, int(round(float(fps) * float(duration))))
        return None
    duration = metadata.get("duration_seconds")
    if isinstance(duration, (int, float)) and interval_seconds:
        return max(1, int(float(duration) / float(interval_seconds)) + 1)
    return None


def _validate_extracted_count(actual: int, expected: int | None, mode: str) -> None:
    if expected is None or expected < 10:
        return
    tolerance = 0.90 if mode == "all_frames" else 0.80
    minimum = max(1, int(expected * tolerance))
    if actual < minimum:
        raise RuntimeError(
            f"Frame extraction produced {actual} frames, expected about {expected} "
            f"for mode={mode}. Refusing to score an under-sampled video."
        )


def _extract_frames_ffmpeg(
    path: str,
    interval_seconds: float | None,
    output_dir: Optional[str | Path] = None,
    image_format: str = "jpg",
    jpeg_quality: int = 92,
    extraction_mode: str = "interval",
) -> List[Frame]:
    global _LAST_EXTRACTION_METADATA
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg not found")

    mode = (extraction_mode or "interval").strip().lower()
    probe = _probe_video(path)
    expected = _expected_count(probe, interval_seconds, mode)
    _LAST_EXTRACTION_METADATA.update(
        {
            **probe,
            "expected_frame_count": expected,
        }
    )

    out_dir = Path(output_dir) if output_dir else Path(tempfile.mkdtemp(prefix="drisora_frames_"))
    out_dir.mkdir(parents=True, exist_ok=True)

    extension = "jpg" if image_format.lower() in {"jpg", "jpeg"} else image_format.lower()
    pattern = str(out_dir / f"frame_%06d.{extension}")
    base = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
    output_args: list[str] = []
    if mode == "interval":
        sample_fps = 1.0 / float(interval_seconds or 1.0)
        vf = f"fps={sample_fps:.6f}"
        output_args.extend(["-vf", vf])
    else:
        output_args.extend(["-vsync", "0"])
    output_args.extend(["-start_number", "0"])
    if extension in {"jpg", "jpeg"}:
        output_args.extend(["-q:v", str(_ffmpeg_quality(jpeg_quality))])
    output_args.append(pattern)

    cpu_command = base + ["-i", path] + output_args
    deterministic = os.environ.get("DRISORA_DETERMINISTIC_EXTRACTOR", "1").strip().lower() in {"1", "true", "yes", "on"}
    if deterministic or mode == "all_frames":
        _run_ffmpeg(cpu_command)
        _LAST_EXTRACTION_METADATA["extractor_backend"] = "ffmpeg_cpu"
        print("[FRAMES] extracted with deterministic ffmpeg cpu", flush=True)
    else:
        gpu_command = base + ["-hwaccel", "cuda", "-i", path] + output_args

        try:
            _run_ffmpeg(gpu_command)
            _LAST_EXTRACTION_METADATA["extractor_backend"] = "ffmpeg_cuda"
            print("[FRAMES] extracted with ffmpeg cuda hwaccel", flush=True)
        except Exception as exc:
            print(f"[FRAMES] ffmpeg cuda extraction unavailable: {exc}", flush=True)
            _run_ffmpeg(cpu_command)
            _LAST_EXTRACTION_METADATA["extractor_backend"] = "ffmpeg_cpu_fallback"
            print("[FRAMES] extracted with ffmpeg cpu fallback", flush=True)

    paths = sorted(out_dir.glob(f"frame_*.{extension}"))
    if not paths:
        raise RuntimeError("ffmpeg produced no frames")
    _validate_extracted_count(len(paths), expected, mode)
    print(f"[FRAMES] extracted {len(paths)} sampled frames", flush=True)
    fps = probe.get("fps")
    return [
        _frame_record(
            index,
            int(round((index / float(fps)) * 1000.0)) if mode == "all_frames" and isinstance(fps, (int, float)) and fps > 0 else int(round(index * float(interval_seconds or 1.0) * 1000.0)),
            frame_path,
        )
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
