# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

"""IRC:82-2023 PCI sectioning utilities.

Sections are fixed 100 m road-chainage intervals derived from DJI SRT GPS
telemetry, not frame counts. PCI scoring is kept in ``pipeline.pci_scorer``;
this module only prepares section inputs and metadata.
"""

from __future__ import annotations

import math
from typing import Any

from pipeline.pci_scorer import score as pci_score_frame
from utils.gps_dedup import haversine_m
from utils.gsd_calibration import compute_gsd

SEGMENT_LENGTH_M = 100.0
FINAL_SECTION_MIN_LENGTH_M = 20.0
MAX_GPS_STEP_M = 50.0
LOW_CONFIDENCE_DETECTION_FRAMES = 5

_IRC_GRADES = [
    (85.0, "Good"),
    (70.0, "Satisfactory"),
    (55.0, "Fair"),
    (40.0, "Poor"),
    (25.0, "Very Poor"),
    (10.0, "Serious"),
    (0.0, "Failed"),
]


def _pci_grade(pci: float) -> str:
    for threshold, grade in _IRC_GRADES:
        if pci >= threshold:
            return grade
    return "Failed"


def _section_id(section_index: int) -> str:
    return f"S-{section_index + 1:02d}"


def _finite_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _valid_coordinate(frame: dict[str, Any]) -> tuple[float, float] | None:
    lat = _finite_float(frame.get("lat"))
    lon = _finite_float(frame.get("lon"))
    if lat is None or lon is None:
        return None
    if lat == 0.0 and lon == 0.0:
        return None
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return None
    return lat, lon


def _altitude_m(frame: dict[str, Any]) -> float | None:
    altitude = _finite_float(frame.get("alt_m", frame.get("altitude_m")))
    if altitude is None or altitude <= 0.0:
        return None
    return altitude


def _frame_index(frame: dict[str, Any], fallback: int) -> int:
    raw = frame.get("frame_index", frame.get("index", fallback))
    try:
        return int(raw)
    except (TypeError, ValueError):
        return fallback


def attach_chainage_to_frames(frames_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return frame copies with cumulative Haversine chainage and section ids.

    Invalid GPS fixes inherit the last section. GPS jumps above 50 m are marked
    as telemetry gaps and do not increase cumulative distance.
    """
    out: list[dict[str, Any]] = []
    cumulative = 0.0
    last_valid: tuple[float, float] | None = None
    last_section_index = 0

    for fallback_index, frame in enumerate(frames_list):
        coord = _valid_coordinate(frame)
        gps_valid = coord is not None
        telemetry_gap = False
        telemetry_gap_m: float | None = None

        if coord is not None:
            if last_valid is not None:
                step_m = haversine_m(last_valid[0], last_valid[1], coord[0], coord[1])
                if step_m > MAX_GPS_STEP_M:
                    telemetry_gap = True
                    telemetry_gap_m = step_m
                else:
                    cumulative += step_m
            last_valid = coord
            last_section_index = int(cumulative // SEGMENT_LENGTH_M)

        section_index = last_section_index
        out.append(
            {
                **frame,
                "frame_index": _frame_index(frame, fallback_index),
                "gps_valid": gps_valid,
                "telemetry_gap": telemetry_gap,
                "telemetry_gap_m": telemetry_gap_m,
                "cumulative_distance_m": cumulative,
                "section_index": section_index,
                "section_id": _section_id(section_index),
            }
        )

    return out


def build_gps_track(
    frames_list: list[dict[str, Any]],
) -> list[tuple[int, float | None, float | None, float]]:
    """Build ``(frame_index, lat, lon, cumulative_distance_m)`` GPS track tuples."""
    chainage_frames = attach_chainage_to_frames(frames_list)
    track: list[tuple[int, float | None, float | None, float]] = []
    for frame in chainage_frames:
        coord = _valid_coordinate(frame)
        lat = coord[0] if coord is not None else None
        lon = coord[1] if coord is not None else None
        track.append(
            (
                int(frame.get("frame_index", len(track))),
                lat,
                lon,
                float(frame.get("cumulative_distance_m", 0.0)),
            )
        )
    return track


def compute_cumulative_distances(frames_list: list[dict[str, Any]]) -> list[float]:
    """Compute cumulative Haversine distance in metres for each frame."""
    return [frame["cumulative_distance_m"] for frame in attach_chainage_to_frames(frames_list)]


def _final_section_length(section_index: int, frames: list[dict[str, Any]]) -> float:
    if not frames:
        return 0.0
    max_distance = max(float(frame.get("cumulative_distance_m", 0.0)) for frame in frames)
    return max(0.0, max_distance - section_index * SEGMENT_LENGTH_M)


def _merge_final_short_section(
    segments: dict[int, list[dict[str, Any]]],
) -> dict[int, list[dict[str, Any]]]:
    keys = sorted(segments)
    if len(keys) < 2:
        return segments

    final_key = keys[-1]
    final_length = _final_section_length(final_key, segments[final_key])
    if final_length >= FINAL_SECTION_MIN_LENGTH_M:
        return segments

    previous_key = keys[-2]
    moved_frames = [
        {
            **frame,
            "section_index": previous_key,
            "section_id": _section_id(previous_key),
            "merged_from_section_index": final_key,
        }
        for frame in segments[final_key]
    ]
    merged = dict(segments)
    merged[previous_key] = sorted(
        [*merged[previous_key], *moved_frames],
        key=lambda frame: float(frame.get("cumulative_distance_m", 0.0)),
    )
    del merged[final_key]
    return merged


def assign_frames_to_segments(
    frames_with_distances: list[dict[str, Any]],
) -> dict[int, list[dict[str, Any]]]:
    """Assign frames to fixed 100 m sections by cumulative GPS chainage."""
    segments: dict[int, list[dict[str, Any]]] = {}
    for frame in frames_with_distances:
        raw_section = frame.get("section_index")
        if raw_section is None:
            raw_section = int(float(frame.get("cumulative_distance_m", 0.0)) // SEGMENT_LENGTH_M)
        section_index = int(raw_section)
        annotated = {
            **frame,
            "section_index": section_index,
            "section_id": _section_id(section_index),
        }
        segments.setdefault(section_index, []).append(annotated)
    return _merge_final_short_section(segments)


def _section_distance_bounds(
    section_index: int,
    segment_frames: list[dict[str, Any]],
    survey_end_distance_m: float | None,
) -> tuple[float, float]:
    start = section_index * SEGMENT_LENGTH_M
    nominal_end = (section_index + 1) * SEGMENT_LENGTH_M
    actual_max = max(
        (float(frame.get("cumulative_distance_m", 0.0)) for frame in segment_frames),
        default=start,
    )
    if survey_end_distance_m is not None:
        bounded_nominal_end = min(nominal_end, max(start, survey_end_distance_m))
    else:
        bounded_nominal_end = nominal_end
    end = max(actual_max, bounded_nominal_end)
    return round(start, 4), round(max(start, end), 4)


def _first_last_valid_coordinate(
    segment_frames: list[dict[str, Any]],
) -> tuple[tuple[float | None, float | None], tuple[float | None, float | None]]:
    coords = [_valid_coordinate(frame) for frame in segment_frames]
    valid_coords = [coord for coord in coords if coord is not None]
    if not valid_coords:
        return (None, None), (None, None)
    return valid_coords[0], valid_coords[-1]


def _mean_altitude(segment_frames: list[dict[str, Any]]) -> float | None:
    altitudes = [
        altitude
        for frame in segment_frames
        if (altitude := _altitude_m(frame)) is not None
    ]
    if not altitudes:
        return None
    return sum(altitudes) / len(altitudes)


def _crack_width_px(detection: dict[str, Any]) -> float | None:
    explicit_width = _finite_float(detection.get("crack_width_px"))
    if explicit_width is not None and explicit_width > 0.0:
        return explicit_width
    try:
        x1, y1, x2, y2 = [float(value) for value in detection.get("bbox") or []]
    except (TypeError, ValueError):
        return None
    length_px = max(abs(x2 - x1), abs(y2 - y1))
    area_px = _finite_float(detection.get("mask_area_px", detection.get("area_px")))
    if area_px is None or area_px <= 0.0 or length_px <= 0.0:
        return None
    return area_px / length_px


def _apply_section_gsd_to_detections(
    detections: list[dict[str, Any]],
    gsd_mm_per_px: float | None,
) -> list[dict[str, Any]]:
    calibrated: list[dict[str, Any]] = []
    for detection in detections:
        item = dict(detection)
        if gsd_mm_per_px is not None and gsd_mm_per_px > 0.0:
            if item.get("crack_width_mm") is not None and item.get("depth_crack_width_mm") is None:
                item["depth_crack_width_mm"] = item.get("crack_width_mm")
            width_px = _crack_width_px(item)
            item["section_gsd_mm_per_px"] = gsd_mm_per_px
            if width_px is not None and width_px > 0.0:
                item["crack_width_px"] = width_px
                item["crack_width_mm"] = width_px * gsd_mm_per_px
                item["crack_width_source"] = "section_gsd"
        calibrated.append(item)
    return calibrated


def _flatten_detections(segment_frames: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        detection
        for frame in segment_frames
        for detection in (frame.get("detections") or [])
    ]


def compute_segment_pci(
    segment_frames: list[dict[str, Any]],
    detections_for_segment: list[dict[str, Any]] | None = None,
    *,
    survey_end_distance_m: float | None = None,
) -> dict[str, Any]:
    """Compute PCI and metadata for one 100 m GPS-chainage section."""
    if not segment_frames:
        return {
            "section_id": "S-00",
            "pci_score": 50.0,
            "pci_grade": _pci_grade(50.0),
            "is_relative": True,
            "total_length_m": 0.0,
            "start_distance_m": 0.0,
            "end_distance_m": 0.0,
            "start_lat": None,
            "start_lon": None,
            "end_lat": None,
            "end_lon": None,
            "mean_altitude_m": None,
            "gsd_mm_per_px": None,
            "frame_count": 0,
            "detection_frame_count": 0,
            "low_confidence": True,
            "deduct_values": [],
            "detection_count": 0,
            "detections": [],
        }

    section_index = int(
        segment_frames[0].get(
            "section_index",
            int(float(segment_frames[0].get("cumulative_distance_m", 0.0)) // SEGMENT_LENGTH_M),
        )
    )
    start_distance_m, end_distance_m = _section_distance_bounds(
        section_index,
        segment_frames,
        survey_end_distance_m,
    )
    total_length_m = max(0.0, end_distance_m - start_distance_m)
    is_relative = total_length_m < SEGMENT_LENGTH_M

    start_coord, end_coord = _first_last_valid_coordinate(segment_frames)
    mean_altitude_m = _mean_altitude(segment_frames)
    gsd_mm_per_px = compute_gsd(mean_altitude_m) if mean_altitude_m is not None else None

    flattened_detections = detections_for_segment if detections_for_segment is not None else _flatten_detections(segment_frames)
    calibrated_detections = _apply_section_gsd_to_detections(flattened_detections, gsd_mm_per_px)
    detection_frame_count = sum(1 for frame in segment_frames if frame.get("detections"))

    pci_scores: list[float] = []
    individual_accum: dict[str, list[float]] = {}

    for frame in segment_frames:
        frame_detections = _apply_section_gsd_to_detections(frame.get("detections") or [], gsd_mm_per_px)
        raw_pci = frame.get("pci_score")
        if raw_pci is not None:
            pci_scores.append(float(raw_pci))
        else:
            frame_area_px = float(frame.get("frame_area_px") or 1.0)
            depth_map = frame.get("depth_map")
            result = pci_score_frame(frame_detections, frame_area_px, depth_map)
            pci_scores.append(float(result.get("pci", 50.0)))
            for key, value in (result.get("individual_scores") or {}).items():
                individual_accum.setdefault(key, []).append(float(value))

        frame_individual = (
            (frame.get("pci_details") or {}).get("individual_scores")
            or frame.get("individual_scores")
            or {}
        )
        for key, value in frame_individual.items():
            individual_accum.setdefault(key, []).append(float(value))

    avg_pci = sum(pci_scores) / len(pci_scores) if pci_scores else 50.0
    avg_pci = min(100.0, max(0.0, avg_pci))

    deduct_values: list[dict[str, Any]] = []
    for distress_type, values in individual_accum.items():
        if values:
            avg_score = sum(values) / len(values)
            deduct_values.append({"type": distress_type, "value": round(100.0 - avg_score, 4)})
    deduct_values.sort(key=lambda item: (-item["value"], item["type"]))

    return {
        "section_id": _section_id(section_index),
        "start_distance_m": start_distance_m,
        "end_distance_m": end_distance_m,
        "start_lat": start_coord[0],
        "start_lon": start_coord[1],
        "end_lat": end_coord[0],
        "end_lon": end_coord[1],
        "mean_altitude_m": round(mean_altitude_m, 4) if mean_altitude_m is not None else None,
        "gsd_mm_per_px": round(gsd_mm_per_px, 6) if gsd_mm_per_px is not None else None,
        "frame_count": len(segment_frames),
        "detection_frame_count": detection_frame_count,
        "low_confidence": detection_frame_count < LOW_CONFIDENCE_DETECTION_FRAMES,
        "telemetry_gap_count": sum(1 for frame in segment_frames if frame.get("telemetry_gap")),
        "pci_score": round(avg_pci, 4),
        "pci_grade": _pci_grade(avg_pci),
        "is_relative": is_relative,
        "total_length_m": round(total_length_m, 4),
        "deduct_values": deduct_values,
        "detection_count": len(calibrated_detections),
        "detections": calibrated_detections,
    }


def build_pci_sections(
    frames_list: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """Build GPS-chainage sections, survey summary, and annotated frames."""
    chainage_frames = attach_chainage_to_frames(frames_list)
    segment_map = assign_frames_to_segments(chainage_frames)
    survey_end_distance_m = max(
        (float(frame.get("cumulative_distance_m", 0.0)) for frame in chainage_frames),
        default=0.0,
    )
    sections: list[dict[str, Any]] = []
    for segment_index, segment_frames in sorted(segment_map.items()):
        detections = _flatten_detections(segment_frames)
        sections.append(
            {
                "segment_index": segment_index,
                **compute_segment_pci(
                    segment_frames,
                    detections,
                    survey_end_distance_m=survey_end_distance_m,
                ),
            }
        )
    return sections, build_survey_pci_summary(sections), chainage_frames


def build_survey_pci_summary(all_segments: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate section scores into a survey-level weighted PCI summary."""
    if not all_segments:
        return {
            "weighted_pci": 0.0,
            "total_length_m": 0.0,
            "segment_count": 0,
            "rpci_segment_count": 0,
            "worst_segment_index": None,
            "worst_segment_pci": None,
            "best_segment_index": None,
            "best_segment_pci": None,
            "pci_grade": _pci_grade(0.0),
        }

    total_length = 0.0
    weighted_sum = 0.0
    rpci_count = 0
    worst_idx: int | None = None
    worst_pci: float | None = None
    best_idx: int | None = None
    best_pci: float | None = None

    for segment in all_segments:
        pci = float(segment.get("pci_score", 50.0))
        length = float(segment.get("total_length_m", 0.0))
        segment_index = segment.get("segment_index")

        total_length += length
        weighted_sum += pci * length

        if segment.get("is_relative", False):
            rpci_count += 1
        if worst_pci is None or pci < worst_pci:
            worst_pci = pci
            worst_idx = segment_index
        if best_pci is None or pci > best_pci:
            best_pci = pci
            best_idx = segment_index

    weighted_pci = weighted_sum / total_length if total_length > 0.0 else 0.0
    weighted_pci = min(100.0, max(0.0, weighted_pci))

    return {
        "weighted_pci": round(weighted_pci, 4),
        "total_length_m": round(total_length, 4),
        "segment_count": len(all_segments),
        "rpci_segment_count": rpci_count,
        "worst_segment_index": worst_idx,
        "worst_segment_pci": round(worst_pci, 4) if worst_pci is not None else None,
        "best_segment_index": best_idx,
        "best_segment_pci": round(best_pci, 4) if best_pci is not None else None,
        "pci_grade": _pci_grade(weighted_pci),
    }
