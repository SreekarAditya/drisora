"""GPS deduplication utilities for drone footage frames.

Uses ground-footprint overlap ratios to decide whether a new frame covers
ground that has already been photographed.  All calculations are done with
the standard :mod:`math` module — no NumPy or SciPy dependency.
"""

from __future__ import annotations

import math
from typing import Any

_EARTH_RADIUS_M: float = 6_371_000.0


def compute_footprint_radius(altitude_m: float, fov_deg: float) -> float:
    """Ground footprint radius in metres for a nadir (straight-down) shot.

    Parameters
    ----------
    altitude_m:
        Drone altitude above ground in metres.
    fov_deg:
        Camera field of view in degrees (full angle, not half-angle).

    Returns
    -------
    float
        Footprint radius in metres.  Returns ``0.0`` for non-positive
        *altitude_m* values to avoid domain errors.
    """
    if altitude_m <= 0.0:
        return 0.0
    return altitude_m * math.tan(math.radians(fov_deg / 2.0))


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two GPS coordinates in metres.

    Parameters
    ----------
    lat1, lon1:
        First point in decimal degrees.
    lat2, lon2:
        Second point in decimal degrees.

    Returns
    -------
    float
        Distance in metres.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)

    a = (
        math.sin(d_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return _EARTH_RADIUS_M * c


def compute_circle_overlap_ratio(
    dist_m: float, r1_m: float, r2_m: float
) -> float:
    """Fraction of circle 1's area that overlaps with circle 2.

    The returned value represents ``intersection_area / (π · r1²)`` and is
    clamped to ``[0.0, 1.0]``.

    Parameters
    ----------
    dist_m:
        Distance between the two circle centres in metres.
    r1_m:
        Radius of the reference circle (circle 1) in metres.
    r2_m:
        Radius of the comparison circle (circle 2) in metres.

    Returns
    -------
    float
        Overlap ratio in ``[0.0, 1.0]``.
    """
    # Guard against degenerate inputs.
    if r1_m <= 0.0:
        return 0.0
    if r2_m <= 0.0:
        return 0.0
    if dist_m < 0.0:
        dist_m = 0.0

    # One circle fully contains the other.
    if dist_m <= abs(r1_m - r2_m):
        return 1.0

    # Circles are completely disjoint.
    if dist_m >= r1_m + r2_m:
        return 0.0

    # Standard lens-intersection formula.
    d = dist_m
    d2 = d * d
    r1_2 = r1_m * r1_m
    r2_2 = r2_m * r2_m

    cos_alpha = (d2 + r1_2 - r2_2) / (2.0 * d * r1_m)
    cos_beta = (d2 + r2_2 - r1_2) / (2.0 * d * r2_m)

    # Clamp cosine arguments to [-1, 1] to absorb floating-point rounding.
    cos_alpha = max(-1.0, min(1.0, cos_alpha))
    cos_beta = max(-1.0, min(1.0, cos_beta))

    alpha = math.acos(cos_alpha)  # half-angle at centre of circle 1
    beta = math.acos(cos_beta)    # half-angle at centre of circle 2

    # Triangle area term: 0.5 * sqrt((-d+r1+r2)(d+r1-r2)(d-r1+r2)(d+r1+r2))
    triangle_term = 0.5 * math.sqrt(
        max(0.0, (-d + r1_m + r2_m) * (d + r1_m - r2_m)
            * (d - r1_m + r2_m) * (d + r1_m + r2_m))
    )

    intersection_area = (
        r1_2 * alpha
        + r2_2 * beta
        - triangle_term
    )

    ratio = intersection_area / (math.pi * r1_2)
    return max(0.0, min(1.0, ratio))


def is_duplicate_frame(
    frame_dict: dict[str, Any],
    processed_zones_list: list[dict[str, Any]],
    overlap_threshold: float = 0.60,
) -> bool:
    """Return ``True`` if the frame's footprint significantly overlaps a known zone.

    A frame is considered a duplicate when its ground footprint overlaps any
    previously processed zone by at least *overlap_threshold* (default 60 %).

    Parameters
    ----------
    frame_dict:
        Dict with keys ``lat``, ``lon``, ``altitude_m``, ``fov_deg``.
    processed_zones_list:
        List of zone dicts, each with keys ``lat``, ``lon``,
        ``footprint_radius_m``.
    overlap_threshold:
        Minimum overlap ratio (inclusive) to classify a frame as duplicate.

    Returns
    -------
    bool
        ``True`` if the frame duplicates at least one zone, ``False``
        otherwise.
    """
    r1 = compute_footprint_radius(
        frame_dict["altitude_m"], frame_dict["fov_deg"]
    )

    for zone in processed_zones_list:
        dist = haversine_m(
            frame_dict["lat"],
            frame_dict["lon"],
            zone["lat"],
            zone["lon"],
        )
        overlap = compute_circle_overlap_ratio(dist, r1, zone["footprint_radius_m"])
        if overlap >= overlap_threshold:
            return True

    return False
