"""Ingestion modules for Drisora surveys.

Each module reads raw user uploads (images, videos, SRT logs) and produces
a normalized list of "frames" with optional GPS metadata that the downstream
detection / scoring pipeline consumes.
"""

from .exif_reader import extract_gps_from_image
from .srt_parser import parse_srt
from .video_handler import extract_frames, attach_gps_to_frames
from .image_batch import process_image_batch

__all__ = [
    "extract_gps_from_image",
    "parse_srt",
    "extract_frames",
    "attach_gps_to_frames",
    "process_image_batch",
]
