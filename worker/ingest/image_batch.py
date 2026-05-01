"""Image-batch ingestion.

Reads EXIF GPS from each input image and emits a normalized list of
records that mirror the `Frame` shape used by the video pipeline. GPS
fields are None when EXIF is missing or unreadable.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional, Sequence, TypedDict

from .exif_reader import extract_gps_from_image


class ImageRecord(TypedDict):
    index: int
    path: str
    lat: Optional[float]
    lon: Optional[float]
    alt: Optional[float]


def process_image_batch(image_paths: Sequence[str | Path]) -> List[ImageRecord]:
    """Read each image's EXIF GPS and return normalized records.

    Failures (missing file, no EXIF, malformed GPS) yield records with
    `lat`/`lon`/`alt` set to None — they are NOT dropped, so the caller can
    still process them through detection, just without georeferencing.
    """
    records: List[ImageRecord] = []
    for idx, p in enumerate(image_paths):
        gps = extract_gps_from_image(p)
        records.append(
            {
                "index": idx,
                "path": str(p),
                "lat": gps["lat"] if gps else None,
                "lon": gps["lon"] if gps else None,
                "alt": gps["alt"] if gps else None,
            }
        )
    return records
