# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

"""Ground-sample-distance calibration with explicit uncertainty.

Metric area is computed from SRT relative altitude (AGL), never absolute MSL
altitude.  Camera geometry must be supplied by the job; there is no hidden
camera preset.  When the geometry is a manufacturer specification or operator
estimate, provenance marks it as estimated and carries squared area-error
bounds because area scales with GSD squared.
"""

from __future__ import annotations

import math
from typing import Any, Mapping


CALIBRATED_SOURCES = {"field_calibrated", "laboratory_calibrated"}


def _positive(value: Any, name: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be a finite number greater than zero") from exc
    if not math.isfinite(number) or number <= 0.0:
        raise ValueError(f"{name} must be a finite number greater than zero")
    return number


def calibration_from_options(options: Mapping[str, Any]) -> dict[str, Any]:
    """Validate an explicit camera/GSD calibration payload."""
    if not isinstance(options, Mapping):
        raise ValueError("camera calibration options are required")

    relative_error_pct = _positive(
        options.get("gsd_relative_error_pct"),
        "gsd_relative_error_pct",
    )
    if relative_error_pct >= 100.0:
        raise ValueError("gsd_relative_error_pct must be less than 100")

    source = str(options.get("camera_calibration_source") or "").strip().lower()
    if not source:
        raise ValueError("camera_calibration_source is required")

    horizontal_fov = options.get("camera_horizontal_fov_deg")
    sensor_width = options.get("camera_sensor_width_mm")
    focal_length = options.get("camera_focal_length_mm")
    explicit_gsd = options.get("estimated_gsd_m_per_px")

    if horizontal_fov is not None:
        fov = _positive(horizontal_fov, "camera_horizontal_fov_deg")
        if fov >= 180.0:
            raise ValueError("camera_horizontal_fov_deg must be less than 180")
        method = "relative_agl_plus_horizontal_fov"
        geometry = {"horizontal_fov_deg": fov}
    elif sensor_width is not None or focal_length is not None:
        geometry = {
            "sensor_width_mm": _positive(sensor_width, "camera_sensor_width_mm"),
            "focal_length_mm": _positive(focal_length, "camera_focal_length_mm"),
        }
        method = "relative_agl_plus_sensor_focal_length"
    elif explicit_gsd is not None:
        geometry = {"estimated_gsd_m_per_px": _positive(explicit_gsd, "estimated_gsd_m_per_px")}
        method = "operator_gsd_estimate"
    else:
        raise ValueError(
            "camera geometry is required: provide horizontal FOV, sensor width and focal length, "
            "or an explicit estimated GSD"
        )

    error_fraction = relative_error_pct / 100.0
    return {
        "method": method,
        "source": source,
        "estimated": source not in CALIBRATED_SOURCES,
        "relative_error_pct": relative_error_pct,
        "area_scale_lower": (1.0 - error_fraction) ** 2,
        "area_scale_upper": (1.0 + error_fraction) ** 2,
        **geometry,
    }


def compute_gsd(
    relative_altitude_m: float,
    image_width_px: int,
    calibration: Mapping[str, Any],
) -> float:
    """Compute GSD in metres/pixel from AGL and explicit camera geometry."""
    altitude = _positive(relative_altitude_m, "relative_altitude_m")
    width = int(_positive(image_width_px, "image_width_px"))
    method = calibration.get("method")

    if method == "relative_agl_plus_horizontal_fov":
        fov_deg = _positive(calibration.get("horizontal_fov_deg"), "horizontal_fov_deg")
        ground_width_m = 2.0 * altitude * math.tan(math.radians(fov_deg) / 2.0)
        gsd = ground_width_m / width
    elif method == "relative_agl_plus_sensor_focal_length":
        sensor_width_mm = _positive(calibration.get("sensor_width_mm"), "sensor_width_mm")
        focal_length_mm = _positive(calibration.get("focal_length_mm"), "focal_length_mm")
        gsd = sensor_width_mm * altitude / (focal_length_mm * width)
    elif method == "operator_gsd_estimate":
        gsd = _positive(calibration.get("estimated_gsd_m_per_px"), "estimated_gsd_m_per_px")
    else:
        raise ValueError("unsupported GSD calibration method")

    if not math.isfinite(gsd) or gsd <= 0.0:
        raise ArithmeticError("GSD calculation returned a non-positive value")
    return gsd


def area_uncertainty_bounds(
    area_m2: float,
    calibration: Mapping[str, Any],
) -> dict[str, float]:
    """Propagate GSD error through area = pixels * GSD squared."""
    area = max(0.0, float(area_m2))
    lower_scale = float(calibration["area_scale_lower"])
    upper_scale = float(calibration["area_scale_upper"])
    return {
        "lower_m2": area * lower_scale,
        "upper_m2": area * upper_scale,
        "lower_scale": lower_scale,
        "upper_scale": upper_scale,
    }


def attach_gsd(
    frame: Mapping[str, Any],
    image_width_px: int,
    calibration: Mapping[str, Any],
) -> dict[str, Any]:
    """Return a frame with GSD derived only from relative AGL altitude."""
    altitude_source = frame.get("altitude_source")
    relative_altitude = frame.get("relative_altitude_m")
    if altitude_source != "relative_agl" or relative_altitude is None:
        raise ValueError(
            "relative AGL altitude is required for GSD; absolute MSL or unknown altitude is not accepted"
        )

    gsd = compute_gsd(float(relative_altitude), image_width_px, calibration)
    return {
        **dict(frame),
        "gsd_m_per_px": gsd,
        "gsd_mm_per_px": gsd * 1000.0,
        "gsd_source": calibration["method"],
        "gsd_estimated": bool(calibration["estimated"]),
        "gsd_relative_error_pct": float(calibration["relative_error_pct"]),
        "area_scale_lower": float(calibration["area_scale_lower"]),
        "area_scale_upper": float(calibration["area_scale_upper"]),
        "camera_calibration_source": calibration["source"],
    }
