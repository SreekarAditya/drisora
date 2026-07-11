# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

"""Georeferenced cross-frame distress deduplication.

SAM2 provides mask area but the current inference contract does not retain the
full bitmap.  This module therefore maps each detection's YOLO bounding box to
the ground plane using frame GPS, nadir gimbal orientation, yaw, and calibrated
GSD.  Same-class ground footprints that overlap are clustered; a cluster
contributes its largest SAM mask area once instead of once per video frame.

Missing geometry or failed inference is a hard error.  There is no silent
pass-through path because summing overlapping frames would inflate section
extent.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping


CRACK_CLASSES = {"D00", "D10", "D20"}
POTHOLE_CLASS = "D40"
EARTH_RADIUS_M = 6_371_008.8  # IUGG mean Earth radius, used only for local projection.
DEFAULT_OVERLAP_THRESHOLD = 0.50
NADIR_TOLERANCE_DEG = 15.0


class SpatialDeduplicationError(RuntimeError):
    pass


@dataclass(frozen=True)
class GroundInstance:
    distress_group: str
    class_name: str
    frame_index: int
    mask_area_m2: float
    bbox_ground: tuple[float, float, float, float]
    centroid_east_m: float
    centroid_north_m: float
    area_scale_lower: float
    area_scale_upper: float
    detection: dict[str, Any]


@dataclass
class DistressCluster:
    distress_group: str
    instances: list[GroundInstance] = field(default_factory=list)

    @property
    def representative(self) -> GroundInstance:
        return max(self.instances, key=lambda instance: instance.mask_area_m2)

    @property
    def area_m2(self) -> float:
        return self.representative.mask_area_m2

    @property
    def area_lower_m2(self) -> float:
        return self.area_m2 * min(instance.area_scale_lower for instance in self.instances)

    @property
    def area_upper_m2(self) -> float:
        return self.area_m2 * max(instance.area_scale_upper for instance in self.instances)


def _finite(value: Any, name: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise SpatialDeduplicationError(f"{name} must be finite") from exc
    if not math.isfinite(number):
        raise SpatialDeduplicationError(f"{name} must be finite")
    return number


def _positive(value: Any, name: str) -> float:
    number = _finite(value, name)
    if number <= 0.0:
        raise SpatialDeduplicationError(f"{name} must be greater than zero")
    return number


def _class_name(detection: Mapping[str, Any]) -> str:
    return str(detection.get("class") or detection.get("crack_type") or "").upper()


def _distress_group(class_name: str) -> str:
    if class_name in CRACK_CLASSES:
        return "cracking"
    if class_name == POTHOLE_CLASS:
        return "pothole"
    raise SpatialDeduplicationError(
        f"unsupported detector class {class_name!r}; cannot include it in IRC section extent"
    )


def _local_xy(
    lat: float,
    lon: float,
    anchor_lat: float,
    anchor_lon: float,
) -> tuple[float, float]:
    latitude_radians = math.radians((lat + anchor_lat) / 2.0)
    east = math.radians(lon - anchor_lon) * EARTH_RADIUS_M * math.cos(latitude_radians)
    north = math.radians(lat - anchor_lat) * EARTH_RADIUS_M
    return east, north


def _rotate_image_offset(right_m: float, forward_m: float, yaw_deg: float) -> tuple[float, float]:
    yaw = math.radians(yaw_deg)
    east = forward_m * math.sin(yaw) + right_m * math.cos(yaw)
    north = forward_m * math.cos(yaw) - right_m * math.sin(yaw)
    return east, north


def _ground_bbox(
    bbox: Iterable[Any],
    *,
    image_width_px: int,
    image_height_px: int,
    gsd_m_per_px: float,
    frame_east_m: float,
    frame_north_m: float,
    yaw_deg: float,
) -> tuple[tuple[float, float, float, float], float, float]:
    values = list(bbox)
    if len(values) != 4:
        raise SpatialDeduplicationError("detection bbox must contain four coordinates")
    x1, y1, x2, y2 = (_finite(value, "bbox coordinate") for value in values)
    if x2 <= x1 or y2 <= y1:
        raise SpatialDeduplicationError("detection bbox must have positive width and height")
    if x1 < 0.0 or y1 < 0.0 or x2 > image_width_px or y2 > image_height_px:
        raise SpatialDeduplicationError("detection bbox lies outside the source frame")

    ground_points: list[tuple[float, float]] = []
    for x, y in ((x1, y1), (x2, y1), (x2, y2), (x1, y2)):
        right_m = (x - image_width_px / 2.0) * gsd_m_per_px
        forward_m = (image_height_px / 2.0 - y) * gsd_m_per_px
        east_offset, north_offset = _rotate_image_offset(right_m, forward_m, yaw_deg)
        ground_points.append((frame_east_m + east_offset, frame_north_m + north_offset))

    east_values = [point[0] for point in ground_points]
    north_values = [point[1] for point in ground_points]
    ground_bbox = (
        min(east_values),
        min(north_values),
        max(east_values),
        max(north_values),
    )
    center_x = (x1 + x2) / 2.0
    center_y = (y1 + y2) / 2.0
    center_right_m = (center_x - image_width_px / 2.0) * gsd_m_per_px
    center_forward_m = (image_height_px / 2.0 - center_y) * gsd_m_per_px
    center_east, center_north = _rotate_image_offset(center_right_m, center_forward_m, yaw_deg)
    return ground_bbox, frame_east_m + center_east, frame_north_m + center_north


def _intersection_over_smaller(
    first: tuple[float, float, float, float],
    second: tuple[float, float, float, float],
) -> float:
    left = max(first[0], second[0])
    bottom = max(first[1], second[1])
    right = min(first[2], second[2])
    top = min(first[3], second[3])
    if right <= left or top <= bottom:
        return 0.0
    intersection = (right - left) * (top - bottom)
    first_area = (first[2] - first[0]) * (first[3] - first[1])
    second_area = (second[2] - second[0]) * (second[3] - second[1])
    smaller = min(first_area, second_area)
    return intersection / smaller if smaller > 0.0 else 0.0


def _validate_frame(frame: Mapping[str, Any]) -> None:
    if frame.get("detector_status") != "success":
        raise SpatialDeduplicationError("detector failure prevents spatial deduplication")
    if frame.get("segmentation_status") != "success":
        raise SpatialDeduplicationError("segmentation failure prevents spatial deduplication")
    pitch = _finite(frame.get("gimbal_pitch"), "gimbal_pitch")
    if abs(pitch + 90.0) > NADIR_TOLERANCE_DEG:
        raise SpatialDeduplicationError(
            f"gimbal pitch {pitch:.2f} is outside the supported nadir range"
        )


def _instances(frames: list[Mapping[str, Any]]) -> tuple[list[GroundInstance], dict[str, Any]]:
    if not frames:
        raise SpatialDeduplicationError("at least one frame is required")
    anchor_lat = _finite(frames[0].get("lat"), "frame latitude")
    anchor_lon = _finite(frames[0].get("lon"), "frame longitude")
    instances: list[GroundInstance] = []
    gsd_values: list[float] = []
    error_values: list[float] = []

    for fallback_index, frame in enumerate(frames):
        _validate_frame(frame)
        lat = _finite(frame.get("lat"), "frame latitude")
        lon = _finite(frame.get("lon"), "frame longitude")
        width = int(_positive(frame.get("image_width_px"), "image_width_px"))
        height = int(_positive(frame.get("image_height_px"), "image_height_px"))
        gsd = _positive(frame.get("gsd_m_per_px"), "gsd_m_per_px")
        yaw = _finite(frame.get("gimbal_yaw"), "gimbal_yaw")
        lower_scale = _positive(frame.get("area_scale_lower"), "area_scale_lower")
        upper_scale = _positive(frame.get("area_scale_upper"), "area_scale_upper")
        frame_index = int(frame.get("index", frame.get("frame_index", fallback_index)))
        frame_east, frame_north = _local_xy(lat, lon, anchor_lat, anchor_lon)
        gsd_values.append(gsd)
        error_values.append(_positive(frame.get("gsd_relative_error_pct"), "gsd_relative_error_pct"))

        for detection in frame.get("detections") or []:
            if not isinstance(detection, Mapping):
                raise SpatialDeduplicationError("detection must be a mapping")
            class_name = _class_name(detection)
            group = _distress_group(class_name)
            mask_area_px = _positive(
                detection.get("mask_area_px"),
                "mask_area_px",
            )
            ground_bbox, center_east, center_north = _ground_bbox(
                detection.get("bbox") or [],
                image_width_px=width,
                image_height_px=height,
                gsd_m_per_px=gsd,
                frame_east_m=frame_east,
                frame_north_m=frame_north,
                yaw_deg=yaw,
            )
            mask_area_m2 = mask_area_px * gsd**2
            instances.append(
                GroundInstance(
                    distress_group=group,
                    class_name=class_name,
                    frame_index=frame_index,
                    mask_area_m2=mask_area_m2,
                    bbox_ground=ground_bbox,
                    centroid_east_m=center_east,
                    centroid_north_m=center_north,
                    area_scale_lower=lower_scale,
                    area_scale_upper=upper_scale,
                    detection={**dict(detection), "mask_area_m2": mask_area_m2},
                )
            )

    return instances, {
        "anchor_lat": anchor_lat,
        "anchor_lon": anchor_lon,
        "gsd_min_m_per_px": min(gsd_values),
        "gsd_max_m_per_px": max(gsd_values),
        "gsd_relative_error_pct_max": max(error_values),
    }


def _cluster_instances(
    instances: list[GroundInstance],
    overlap_threshold: float,
) -> list[DistressCluster]:
    threshold = _positive(overlap_threshold, "overlap_threshold")
    if threshold > 1.0:
        raise SpatialDeduplicationError("overlap_threshold cannot exceed 1")
    clusters: list[DistressCluster] = []
    for instance in sorted(
        instances,
        key=lambda value: (value.frame_index, value.distress_group, value.centroid_east_m, value.centroid_north_m),
    ):
        best_cluster: DistressCluster | None = None
        best_overlap = 0.0
        for cluster in clusters:
            if cluster.distress_group != instance.distress_group:
                continue
            overlap = max(
                _intersection_over_smaller(instance.bbox_ground, existing.bbox_ground)
                for existing in cluster.instances
            )
            if overlap >= threshold and overlap > best_overlap:
                best_overlap = overlap
                best_cluster = cluster
        if best_cluster is None:
            clusters.append(DistressCluster(instance.distress_group, [instance]))
        else:
            best_cluster.instances.append(instance)
    return clusters


def deduplicate_section_distresses(
    frames: list[Mapping[str, Any]],
    *,
    overlap_threshold: float = DEFAULT_OVERLAP_THRESHOLD,
) -> dict[str, Any]:
    """Return unique crack/pothole areas for a GPS-chainage section."""
    instances, calibration_summary = _instances(frames)
    clusters = _cluster_instances(instances, overlap_threshold)

    def totals(group: str) -> tuple[float, float, float]:
        selected = [cluster for cluster in clusters if cluster.distress_group == group]
        return (
            sum(cluster.area_m2 for cluster in selected),
            sum(cluster.area_lower_m2 for cluster in selected),
            sum(cluster.area_upper_m2 for cluster in selected),
        )

    cracking_area, cracking_lower, cracking_upper = totals("cracking")
    pothole_area, pothole_lower, pothole_upper = totals("pothole")
    unique_detections: list[dict[str, Any]] = []
    for cluster_index, cluster in enumerate(clusters, start=1):
        representative = cluster.representative
        unique_detections.append(
            {
                **representative.detection,
                "dedup_cluster_id": f"{cluster.distress_group}-{cluster_index:05d}",
                "dedup_instance_count": len(cluster.instances),
                "ground_centroid_east_m": representative.centroid_east_m,
                "ground_centroid_north_m": representative.centroid_north_m,
                "area_uncertainty_m2": {
                    "lower": cluster.area_lower_m2,
                    "upper": cluster.area_upper_m2,
                },
            }
        )

    return {
        "detector_status": "success",
        "segmentation_status": "success",
        "spatial_dedup_applied": True,
        "usable_frame_count": len(frames),
        "raw_detection_count": len(instances),
        "unique_detection_count": len(clusters),
        "cracking_area_m2": cracking_area,
        "pothole_area_m2": pothole_area,
        "area_uncertainty_m2": {
            "cracking": {"lower": cracking_lower, "upper": cracking_upper},
            "pothole": {"lower": pothole_lower, "upper": pothole_upper},
        },
        "unique_detections": unique_detections,
        "dedup_provenance": {
            "method": "georeferenced_bbox_overlap_cluster_max_sam_mask_area",
            "overlap_threshold": overlap_threshold,
            "geometry_basis": "frame GPS + relative-AGL GSD + nadir gimbal yaw + YOLO bbox",
            "area_basis": "largest SAM2 mask area per overlapping ground cluster",
            **calibration_summary,
        },
    }


run = deduplicate_section_distresses
