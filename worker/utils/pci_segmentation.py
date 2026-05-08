"""IRC:82-2023 compliant PCI segmentation utilities.

Divides a GPS-ordered frame sequence into 100-metre road sections and
computes a PCI score per section following the IRC:82-2023 methodology.
Sections shorter than 100 m are flagged as RPCI (Relative PCI).
"""

from __future__ import annotations

from typing import Any

from utils.gps_dedup import haversine_m
from pipeline.pci_scorer import score as pci_score_frame

# IRC:82-2023 segment length
SEGMENT_LENGTH_M = 100.0

# IRC:82-2023 grade thresholds
_IRC_GRADES = [
    (85.0, "Good"),
    (70.0, "Satisfactory"),
    (55.0, "Fair"),
    (40.0, "Poor"),
    (25.0, "Very Poor"),
    (10.0, "Serious"),
    (0.0,  "Failed"),
]


def _pci_grade(pci: float) -> str:
    """Map PCI score to IRC:82-2023 grade string.

    Bands:
        85-100 → Good
        70-84  → Satisfactory
        55-69  → Fair
        40-54  → Poor
        25-39  → Very Poor
        10-24  → Serious
        0-9    → Failed
    """
    for threshold, grade in _IRC_GRADES:
        if pci >= threshold:
            return grade
    return "Failed"


def compute_cumulative_distances(frames_list: list[dict[str, Any]]) -> list[float]:
    """Compute cumulative distance in metres from frame 0.

    Each frame must have 'lat' and 'lon' keys.
    Returns a list of the same length as frames_list.
    frames_list[0] always gets distance 0.0.
    Uses haversine_m for each consecutive pair.
    Frames with None lat/lon contribute zero distance from the last valid
    position.
    """
    if not frames_list:
        return []

    distances: list[float] = [0.0]
    cumulative = 0.0
    last_valid_lat: float | None = None
    last_valid_lon: float | None = None

    # Seed the last valid position from the first frame (if valid).
    first = frames_list[0]
    if first.get("lat") is not None and first.get("lon") is not None:
        last_valid_lat = float(first["lat"])
        last_valid_lon = float(first["lon"])

    for frame in frames_list[1:]:
        lat = frame.get("lat")
        lon = frame.get("lon")
        if lat is not None and lon is not None:
            lat = float(lat)
            lon = float(lon)
            if last_valid_lat is not None and last_valid_lon is not None:
                cumulative += haversine_m(last_valid_lat, last_valid_lon, lat, lon)
            last_valid_lat = lat
            last_valid_lon = lon
        # If this frame has no valid GPS, cumulative stays unchanged.
        distances.append(cumulative)

    return distances


def assign_frames_to_segments(
    frames_with_distances: list[dict[str, Any]],
) -> dict[int, list[dict[str, Any]]]:
    """Assign frames to 100-metre segments (IRC:82-2023).

    Each frame dict must have a 'cumulative_distance_m' key already set.
    Segment index = int(distance / 100). Segment 0 = 0–100 m, etc.
    Returns {segment_index: [list of frame dicts]}.
    Empty segments are not included.
    """
    segments: dict[int, list[dict[str, Any]]] = {}
    for frame in frames_with_distances:
        dist = float(frame.get("cumulative_distance_m", 0.0))
        seg_idx = int(dist / SEGMENT_LENGTH_M)
        segments.setdefault(seg_idx, []).append(frame)
    return segments


def compute_segment_pci(
    segment_frames: list[dict[str, Any]],
    detections_for_segment: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Compute PCI for a single 100-metre segment.

    segment_frames: frames in this segment, each with cumulative_distance_m.
    detections_for_segment: all detections for frames in this segment.

    Returns a dict with keys:
        pci_score, pci_grade, is_relative, total_length_m,
        deduct_values, detection_count.
    """
    if not segment_frames:
        return {
            "pci_score": 50.0,
            "pci_grade": _pci_grade(50.0),
            "is_relative": True,
            "total_length_m": 0.0,
            "deduct_values": [],
            "detection_count": 0,
        }

    # --- total length of this segment ---
    if len(segment_frames) == 1:
        total_length_m = 0.0
    else:
        first_dist = float(segment_frames[0].get("cumulative_distance_m", 0.0))
        last_dist = float(segment_frames[-1].get("cumulative_distance_m", 0.0))
        total_length_m = max(0.0, last_dist - first_dist)

    is_relative = total_length_m < SEGMENT_LENGTH_M

    # --- PCI scoring ---
    pci_scores: list[float] = []
    # Accumulator for individual distress scores to build deduct_values.
    individual_accum: dict[str, list[float]] = {}

    for frame in segment_frames:
        # Prefer pre-computed pci_score on the frame.
        raw_pci = frame.get("pci_score")
        if raw_pci is not None:
            pci_scores.append(float(raw_pci))
        else:
            # Fall back to computing from scratch.
            detections = frame.get("detections") or []
            frame_area_px = float(frame.get("frame_area_px") or 1.0)
            depth_map = frame.get("depth_map")
            result = pci_score_frame(detections, frame_area_px, depth_map)
            pci_scores.append(float(result.get("pci", 50.0)))
            # Capture individual scores if not already on frame.
            frame_individual = result.get("individual_scores") or {}
            for k, v in frame_individual.items():
                individual_accum.setdefault(k, []).append(float(v))

        # Extract individual_scores from frame if available.
        pci_details = frame.get("pci_details") or {}
        frame_individual = (
            pci_details.get("individual_scores")
            or frame.get("individual_scores")
            or {}
        )
        for k, v in frame_individual.items():
            individual_accum.setdefault(k, []).append(float(v))

    # Average PCI across frames.
    if pci_scores:
        avg_pci = sum(pci_scores) / len(pci_scores)
    else:
        avg_pci = 50.0
    avg_pci = min(100.0, max(0.0, avg_pci))

    # --- deduct_values: average individual scores, expressed as 100 - score ---
    deduct_values: list[dict[str, Any]] = []
    for distress_type, vals in individual_accum.items():
        if vals:
            avg_score = sum(vals) / len(vals)
            # Deduct value = how much below perfect this distress is.
            deduct = round(100.0 - avg_score, 4)
            deduct_values.append({"type": distress_type, "value": deduct})
    # Sort for deterministic output.
    deduct_values.sort(key=lambda d: (-d["value"], d["type"]))

    # --- detection count ---
    if detections_for_segment is not None:
        detection_count = len(detections_for_segment)
    else:
        # Sum detections from individual frames where available.
        detection_count = sum(
            len(frame.get("detections") or []) for frame in segment_frames
        )

    return {
        "pci_score": round(avg_pci, 4),
        "pci_grade": _pci_grade(avg_pci),
        "is_relative": is_relative,
        "total_length_m": round(total_length_m, 4),
        "deduct_values": deduct_values,
        "detection_count": detection_count,
    }


def build_survey_pci_summary(all_segments: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate segment scores into survey-level summary.

    all_segments: list of dicts from compute_segment_pci, each with
        'pci_score', 'total_length_m', 'is_relative', and 'segment_index'
        (added by the caller before passing here).

    Returns a dict with keys:
        weighted_pci, total_length_m, segment_count, rpci_segment_count,
        worst_segment_index, worst_segment_pci,
        best_segment_index, best_segment_pci, pci_grade.
    """
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

    for seg in all_segments:
        pci = float(seg.get("pci_score", 50.0))
        length = float(seg.get("total_length_m", 0.0))
        seg_idx = seg.get("segment_index")

        total_length += length
        weighted_sum += pci * length

        if seg.get("is_relative", False):
            rpci_count += 1

        if worst_pci is None or pci < worst_pci:
            worst_pci = pci
            worst_idx = seg_idx

        if best_pci is None or pci > best_pci:
            best_pci = pci
            best_idx = seg_idx

    if total_length > 0.0:
        weighted_pci = weighted_sum / total_length
    else:
        weighted_pci = 0.0

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
