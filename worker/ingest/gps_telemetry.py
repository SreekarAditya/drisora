# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

"""GPS telemetry loading for drone videos.

GPS can arrive as a DJI sidecar SRT file or as an embedded subtitle track in
MP4/MOV containers. This module normalizes both into the same SrtEntry shape
used by the frame attachment code.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Optional, TypedDict

from .srt_parser import SrtEntry, parse_srt


class GpsTelemetry(TypedDict):
    entries: list[SrtEntry]
    source: str
    source_path: Optional[str]
    entry_count: int
    errors: list[str]


def load_gps_telemetry(video_path: str | Path, srt_path: str | Path | None = None) -> GpsTelemetry:
    """Load GPS telemetry from sidecar SRT, falling back to embedded subtitles."""
    errors: list[str] = []

    if srt_path:
        entries = parse_srt(srt_path)
        if entries:
            return _result(entries, "srt", srt_path, errors)
        errors.append(f"SRT contained no readable GPS entries: {Path(srt_path).name}")

    embedded = _extract_embedded_srt(video_path)
    if embedded["path"]:
        entries = parse_srt(embedded["path"])
        if entries:
            return _result(entries, "embedded_srt", embedded["path"], errors + embedded["errors"])
        errors.append(f"Embedded telemetry track contained no readable GPS entries: {Path(video_path).name}")

    return _result([], "unavailable", None, errors + embedded["errors"])


def _result(
    entries: list[SrtEntry],
    source: str,
    source_path: str | Path | None,
    errors: list[str],
) -> GpsTelemetry:
    return {
        "entries": entries,
        "source": source,
        "source_path": str(source_path) if source_path else None,
        "entry_count": len(entries),
        "errors": errors,
    }


def _extract_embedded_srt(video_path: str | Path) -> dict[str, Any]:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return {"path": None, "errors": ["ffmpeg unavailable for embedded telemetry extraction"]}

    streams = _subtitle_stream_indexes(video_path)
    if not streams:
        return {"path": None, "errors": []}

    errors: list[str] = []
    temp_dir = Path(tempfile.mkdtemp(prefix="drisora_embedded_gps_"))
    for ordinal, stream_index in enumerate(streams):
        output_path = temp_dir / f"embedded_{ordinal:02d}.srt"
        command = [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(video_path),
            "-map",
            f"0:{stream_index}",
            "-f",
            "srt",
            str(output_path),
        ]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode == 0 and output_path.exists() and output_path.stat().st_size > 0:
            return {"path": str(output_path), "errors": errors}
        message = (result.stderr or result.stdout or "").strip()
        if message:
            errors.append(message)

    return {"path": None, "errors": errors}


def _subtitle_stream_indexes(video_path: str | Path) -> list[int]:
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        return [0]

    command = [
        ffprobe,
        "-v",
        "error",
        "-select_streams",
        "s",
        "-show_entries",
        "stream=index,codec_type,codec_name:stream_tags=language,title,handler_name",
        "-of",
        "json",
        str(video_path),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        return []

    try:
        data = json.loads(result.stdout or "{}")
    except json.JSONDecodeError:
        return []

    streams = data.get("streams")
    if not isinstance(streams, list):
        return []

    indexes: list[int] = []
    for stream in streams:
        if not isinstance(stream, dict):
            continue
        index = stream.get("index")
        if isinstance(index, int):
            indexes.append(index)
    return indexes
