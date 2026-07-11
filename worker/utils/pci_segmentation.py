# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

"""100 m GPS-chainage section aggregation for partial IRC PCI bounds."""

from __future__ import annotations

import math
from typing import Any, Mapping

from pipeline.pci_scorer import score as score_partial_pci
from pipeline.spatial_dedup import (
    DEFAULT_OVERLAP_THRESHOLD,
    deduplicate_section_distresses,
)
from utils.gps_dedup import haversine_m
from utils.gsd_calibration import attach_gsd


# IRC:82-2023 Section 5.2 / Table 5.3 note permits 100-1000 m sections.
# Pass 2 fixes Drisora's production section length at the lower bound, 100 m.
SEGMENT_LENGTH_M = 100.0


class SectioningError(RuntimeError):
    pass


def _section_id(section_index: int) -> str:
    return f"S-{section_index + 1:03d}"


def _finite(value: Any, name: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise SectioningError(f"{name} must be finite") from exc
    if not math.isfinite(number):
        raise SectioningError(f"{name} must be finite")
    return number


def _coordinate(frame: Mapping[str, Any]) -> tuple[float, float]:
    lat = _finite(frame.get("lat"), "frame latitude")
    lon = _finite(frame.get("lon"), "frame longitude")
    if lat == 0.0 and lon == 0.0:
        raise SectioningError("0,0 is not a usable GPS coordinate")
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        raise SectioningError("frame GPS coordinate is outside valid latitude/longitude bounds")
    return lat, lon


def _frame_index(frame: Mapping[str, Any], fallback: int) -> int:
    try:
        return int(frame.get("frame_index", frame.get("index", fallback)))
    except (TypeError, ValueError):
        return fallback


def attach_chainage_to_frames(
    frames_list: list[dict[str, Any]],
    *,
    section_length_m: float = SEGMENT_LENGTH_M,
) -> list[dict[str, Any]]:
    """Attach cumulative GPS chainage; invalid or discontinuous tracks fail."""
    if not frames_list:
        return []
    if section_length_m <= 0.0:
        raise ValueError("section_length_m must be greater than zero")

    cumulative = 0.0
    previous: tuple[float, float] | None = None
    out: list[dict[str, Any]] = []
    for fallback_index, frame in enumerate(frames_list):
        coordinate = _coordinate(frame)
        step_m = 0.0
        if previous is not None:
            step_m = haversine_m(previous[0], previous[1], coordinate[0], coordinate[1])
            if not math.isfinite(step_m):
                raise SectioningError("GPS chainage step is non-finite")
            # One frame-to-frame gap cannot silently skip an entire fixed section.
            if step_m > section_length_m:
                raise SectioningError(
                    f"GPS telemetry gap {step_m:.2f} m exceeds the {section_length_m:.0f} m section length"
                )
            cumulative += step_m
        previous = coordinate

        # An exact boundary fix closes the preceding section rather than
        # creating a zero-length next section.
        boundary_adjusted = max(0.0, cumulative - 1e-9) if cumulative > 0.0 else 0.0
        section_index = int(boundary_adjusted // section_length_m)
        out.append(
            {
                **frame,
                "frame_index": _frame_index(frame, fallback_index),
                "gps_valid": True,
                "gps_step_m": step_m,
                "cumulative_distance_m": cumulative,
                "section_index": section_index,
                "section_id": _section_id(section_index),
            }
        )
    return out


def build_gps_track(
    frames_list: list[dict[str, Any]],
) -> list[tuple[int, float, float, float]]:
    return [
        (
            int(frame["frame_index"]),
            float(frame["lat"]),
            float(frame["lon"]),
            float(frame["cumulative_distance_m"]),
        )
        for frame in attach_chainage_to_frames(frames_list)
    ]


def compute_cumulative_distances(frames_list: list[dict[str, Any]]) -> list[float]:
    return [
        float(frame["cumulative_distance_m"])
        for frame in attach_chainage_to_frames(frames_list)
    ]


def assign_frames_to_segments(
    frames_with_distances: list[dict[str, Any]],
) -> dict[int, list[dict[str, Any]]]:
    segments: dict[int, list[dict[str, Any]]] = {}
    for frame in frames_with_distances:
        section_index = int(frame["section_index"])
        segments.setdefault(section_index, []).append(frame)
    return segments


def _section_length(
    section_index: int,
    survey_length_m: float,
    section_length_m: float,
) -> float:
    start_m = section_index * section_length_m
    return max(0.0, min(section_length_m, survey_length_m - start_m))


def _section_coordinates(
    frames: list[dict[str, Any]],
) -> tuple[tuple[float, float], tuple[float, float]]:
    first = _coordinate(frames[0])
    last = _coordinate(frames[-1])
    return first, last


def _calibrate_frames(
    frames: list[dict[str, Any]],
    calibration: Mapping[str, Any],
) -> list[dict[str, Any]]:
    calibrated: list[dict[str, Any]] = []
    for frame in frames:
        width = int(_finite(frame.get("image_width_px"), "image_width_px"))
        calibrated.append(attach_gsd(frame, width, calibration))
    return calibrated


def compute_segment_pci(
    segment_frames: list[dict[str, Any]],
    *,
    section_index: int,
    survey_length_m: float,
    road_class: str,
    surface_type: str | None,
    carriageway_width_m: float,
    camera_calibration: Mapping[str, Any],
    provenance: Mapping[str, Any],
    overlap_threshold: float = DEFAULT_OVERLAP_THRESHOLD,
) -> dict[str, Any]:
    """Compute one section from unique physical distress area, never frame PCI."""
    if not segment_frames:
        raise SectioningError("cannot score an empty pavement section")
    length_m = _section_length(section_index, survey_length_m, SEGMENT_LENGTH_M)
    if length_m <= 0.0:
        raise SectioningError("pavement section has zero chainage length")
    calibrated_frames = _calibrate_frames(segment_frames, camera_calibration)
    deduplicated = deduplicate_section_distresses(
        calibrated_frames,
        overlap_threshold=overlap_threshold,
    )
    section_id = _section_id(section_index)
    measurements = {
        **deduplicated,
        "section_id": section_id,
    }
    gsd_provenance = {
        "source": camera_calibration["method"],
        "camera_calibration_source": camera_calibration["source"],
        "estimated": bool(camera_calibration["estimated"]),
        "relative_error_pct": float(camera_calibration["relative_error_pct"]),
        "area_scale_lower": float(camera_calibration["area_scale_lower"]),
        "area_scale_upper": float(camera_calibration["area_scale_upper"]),
        "altitude_source": "relative_agl",
    }
    section_provenance = {
        **dict(provenance),
        "gsd": gsd_provenance,
        "spatial_dedup": deduplicated["dedup_provenance"],
    }
    assessment = score_partial_pci(
        measurements,
        road_class=road_class,
        surface_type=surface_type,
        section_length_m=length_m,
        carriageway_width_m=carriageway_width_m,
        provenance=section_provenance,
    )
    start_coordinate, end_coordinate = _section_coordinates(segment_frames)
    return {
        "segment_index": section_index,
        "section_id": section_id,
        "start_distance_m": section_index * SEGMENT_LENGTH_M,
        "end_distance_m": section_index * SEGMENT_LENGTH_M + length_m,
        "section_length_m": length_m,
        "section_area_m2": length_m * carriageway_width_m,
        "start_lat": start_coordinate[0],
        "start_lon": start_coordinate[1],
        "end_lat": end_coordinate[0],
        "end_lon": end_coordinate[1],
        "frame_count": len(segment_frames),
        "is_relative": length_m < SEGMENT_LENGTH_M,
        "raw_detection_count": deduplicated["raw_detection_count"],
        "unique_detection_count": deduplicated["unique_detection_count"],
        "unique_detections": deduplicated["unique_detections"],
        "area_uncertainty_m2": deduplicated["area_uncertainty_m2"],
        "assessment": assessment,
        "pci_complete": None,
        "pci_bounds": assessment["pci_bounds"],
    }


def build_pci_sections(
    frames_list: list[dict[str, Any]],
    *,
    road_class: str,
    surface_type: str | None,
    carriageway_width_m: float,
    camera_calibration: Mapping[str, Any],
    provenance: Mapping[str, Any],
    overlap_threshold: float = DEFAULT_OVERLAP_THRESHOLD,
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """Build 100 m sections and a survey-level interval summary."""
    carriageway_width = _finite(carriageway_width_m, "carriageway_width_m")
    if carriageway_width <= 0.0:
        raise ValueError("carriageway_width_m must be greater than zero")
    chainage_frames = attach_chainage_to_frames(frames_list)
    if not chainage_frames:
        raise SectioningError("no frames are available for sectioning")
    survey_length_m = float(chainage_frames[-1]["cumulative_distance_m"])
    if survey_length_m <= 0.0:
        raise SectioningError("GPS track has zero chainage length")
    segment_map = assign_frames_to_segments(chainage_frames)
    sections = [
        compute_segment_pci(
            segment_frames,
            section_index=section_index,
            survey_length_m=survey_length_m,
            road_class=road_class,
            surface_type=surface_type,
            carriageway_width_m=carriageway_width,
            camera_calibration=camera_calibration,
            provenance=provenance,
            overlap_threshold=overlap_threshold,
        )
        for section_index, segment_frames in sorted(segment_map.items())
    ]
    return sections, build_survey_pci_summary(sections), chainage_frames


def build_survey_pci_summary(all_segments: list[dict[str, Any]]) -> dict[str, Any]:
    """Length-weight section bounds; never invent a survey point PCI."""
    if not all_segments:
        return {
            "pci_complete": None,
            "pci_bounds": None,
            "total_length_m": 0.0,
            "segment_count": 0,
            "relative_segment_count": 0,
        }
    total_length = sum(float(segment["section_length_m"]) for segment in all_segments)
    if total_length <= 0.0:
        raise SectioningError("section summary has zero total length")
    lower = sum(
        float(segment["pci_bounds"]["lower"]) * float(segment["section_length_m"])
        for segment in all_segments
    ) / total_length
    upper = sum(
        float(segment["pci_bounds"]["upper"]) * float(segment["section_length_m"])
        for segment in all_segments
    ) / total_length
    return {
        "pci_complete": None,
        "pci_bounds": {"lower": lower, "upper": upper, "width": upper - lower},
        "measured_weight_fraction": 0.28,
        "unmeasured_weight_fraction": 0.72,
        "total_length_m": total_length,
        "segment_count": len(all_segments),
        "relative_segment_count": sum(1 for segment in all_segments if segment["is_relative"]),
        "assessment_scope": "partial_irc82_2023_bounds",
    }
