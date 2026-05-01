"""EXIF GPS extraction from JPEG/PNG images using Pillow + piexif."""

from __future__ import annotations

from pathlib import Path
from typing import Optional, TypedDict

import piexif
from PIL import Image


class GpsFix(TypedDict):
    lat: float
    lon: float
    alt: Optional[float]


def _rational_to_float(rational) -> float:
    """piexif returns rationals as (numerator, denominator) tuples."""
    num, den = rational
    return float(num) / float(den) if den else 0.0


def _dms_to_decimal(dms, ref: bytes) -> float:
    """Convert (deg, min, sec) rationals + N/S/E/W ref into a signed decimal."""
    deg = _rational_to_float(dms[0])
    minutes = _rational_to_float(dms[1])
    seconds = _rational_to_float(dms[2])
    decimal = deg + (minutes / 60.0) + (seconds / 3600.0)
    if ref in (b"S", b"W"):
        decimal = -decimal
    return decimal


def extract_gps_from_image(image_path: str | Path) -> Optional[GpsFix]:
    """Read GPS from an image file's EXIF.

    Returns {lat, lon, alt} or None if GPS is missing/unreadable. `alt` is
    None when the image has lat/lon but no altitude tag.
    """
    path = str(image_path)

    try:
        # Pillow first parses the file; piexif then dumps the EXIF dict.
        with Image.open(path) as img:
            exif_bytes = img.info.get("exif")
            if not exif_bytes:
                return None
            exif = piexif.load(exif_bytes)
    except (FileNotFoundError, OSError, ValueError):
        return None

    gps = exif.get("GPS") or {}
    if not gps:
        return None

    lat_dms = gps.get(piexif.GPSIFD.GPSLatitude)
    lat_ref = gps.get(piexif.GPSIFD.GPSLatitudeRef)
    lon_dms = gps.get(piexif.GPSIFD.GPSLongitude)
    lon_ref = gps.get(piexif.GPSIFD.GPSLongitudeRef)

    if not (lat_dms and lat_ref and lon_dms and lon_ref):
        return None

    try:
        lat = _dms_to_decimal(lat_dms, lat_ref)
        lon = _dms_to_decimal(lon_dms, lon_ref)
    except (TypeError, ZeroDivisionError):
        return None

    alt: Optional[float] = None
    alt_raw = gps.get(piexif.GPSIFD.GPSAltitude)
    alt_ref = gps.get(piexif.GPSIFD.GPSAltitudeRef, 0)
    if alt_raw:
        try:
            alt = _rational_to_float(alt_raw)
            # alt_ref == 1 means below sea level
            if alt_ref == 1:
                alt = -alt
        except (TypeError, ZeroDivisionError):
            alt = None

    return {"lat": lat, "lon": lon, "alt": alt}
