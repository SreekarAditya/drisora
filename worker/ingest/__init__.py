# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

"""Ingestion modules for Drisora surveys.

Each module reads raw user uploads (images, videos, sidecar or embedded GPS
telemetry) and produces a normalized list of "frames" with optional GPS
metadata that the downstream detection / scoring pipeline consumes.
"""

__all__ = [
    "extract_gps_from_image",
    "load_gps_telemetry",
    "parse_srt",
    "extract_frames",
    "attach_gps_to_frames",
    "process_image_batch",
]


def __getattr__(name: str):
    """Load mode-specific dependencies only when that ingest path is used."""
    if name == "extract_gps_from_image":
        from .exif_reader import extract_gps_from_image

        return extract_gps_from_image
    if name == "load_gps_telemetry":
        from .gps_telemetry import load_gps_telemetry

        return load_gps_telemetry
    if name == "parse_srt":
        from .srt_parser import parse_srt

        return parse_srt
    if name in {"extract_frames", "attach_gps_to_frames"}:
        from .video_handler import attach_gps_to_frames, extract_frames

        return {"extract_frames": extract_frames, "attach_gps_to_frames": attach_gps_to_frames}[name]
    if name == "process_image_batch":
        from .image_batch import process_image_batch

        return process_image_batch
    raise AttributeError(name)
