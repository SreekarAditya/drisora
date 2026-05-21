# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

from __future__ import annotations

import math
from typing import Any

DEFAULT_CAMERA_FOV_DEG = 73.7


def gsd_m_per_px(
    altitude_m: float | None,
    image_width_px: int,
    *,
    camera_fov_deg: float = DEFAULT_CAMERA_FOV_DEG,
) -> float | None:
    """Estimate ground sample distance from SRT altitude and camera FOV."""
    if altitude_m is None or altitude_m <= 0 or image_width_px <= 0:
        return None
    ground_width_m = 2.0 * float(altitude_m) * math.tan(math.radians(camera_fov_deg / 2.0))
    gsd = ground_width_m / float(image_width_px)
    return gsd if math.isfinite(gsd) and gsd > 0 else None


def attach_gsd(
    frame: dict[str, Any],
    image_width_px: int,
    *,
    camera_fov_deg: float = DEFAULT_CAMERA_FOV_DEG,
) -> dict[str, Any]:
    """Return a frame copy with SRT-altitude GSD calibration fields."""
    altitude_m = frame.get("alt_m", frame.get("altitude_m"))
    gsd = gsd_m_per_px(
        float(altitude_m) if altitude_m is not None else None,
        image_width_px,
        camera_fov_deg=camera_fov_deg,
    )
    return {
        **frame,
        "gsd_m_per_px": gsd,
        "gsd_cm_per_px": gsd * 100.0 if gsd is not None else None,
        "gsd_source": "srt_altitude" if gsd is not None else "unavailable",
        "camera_fov_deg": camera_fov_deg,
    }
