# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

from __future__ import annotations

import math
from typing import Any

DJI_MINI_5_PRO_SENSOR_WIDTH_MM = 9.6
DJI_MINI_5_PRO_FOCAL_LENGTH_MM = 4.49
DJI_MINI_5_PRO_IMAGE_WIDTH_PX = 4000


def compute_gsd(mean_altitude_m: float) -> float:
    """Compute DJI Mini 5 Pro ground sample distance in mm per pixel."""
    return (
        DJI_MINI_5_PRO_SENSOR_WIDTH_MM
        * mean_altitude_m
        * 1000.0
        / (DJI_MINI_5_PRO_FOCAL_LENGTH_MM * DJI_MINI_5_PRO_IMAGE_WIDTH_PX)
    )


def gsd_m_per_px(
    altitude_m: float | None,
    image_width_px: int = DJI_MINI_5_PRO_IMAGE_WIDTH_PX,
) -> float | None:
    """Estimate GSD from SRT AGL altitude for the DJI Mini 5 Pro."""
    if altitude_m is None or altitude_m <= 0 or image_width_px <= 0:
        return None
    gsd_mm_px = compute_gsd(float(altitude_m))
    if image_width_px != DJI_MINI_5_PRO_IMAGE_WIDTH_PX:
        gsd_mm_px *= DJI_MINI_5_PRO_IMAGE_WIDTH_PX / float(image_width_px)
    gsd = gsd_mm_px / 1000.0
    return gsd if math.isfinite(gsd) and gsd > 0 else None


def attach_gsd(
    frame: dict[str, Any],
    image_width_px: int = DJI_MINI_5_PRO_IMAGE_WIDTH_PX,
) -> dict[str, Any]:
    """Return a frame copy with SRT-altitude GSD calibration fields."""
    altitude_m = frame.get("alt_m", frame.get("altitude_m"))
    gsd = gsd_m_per_px(
        float(altitude_m) if altitude_m is not None else None,
        image_width_px,
    )
    return {
        **frame,
        "gsd_m_per_px": gsd,
        "gsd_mm_per_px": gsd * 1000.0 if gsd is not None else None,
        "gsd_source": "srt_altitude" if gsd is not None else "unavailable",
        "camera_model": "DJI Mini 5 Pro",
        "sensor_width_mm": DJI_MINI_5_PRO_SENSOR_WIDTH_MM,
        "focal_length_mm": DJI_MINI_5_PRO_FOCAL_LENGTH_MM,
    }
