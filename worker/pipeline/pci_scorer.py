from __future__ import annotations

import math
from collections import Counter
from typing import Any

import numpy as np

CRACK_CLASSES = {"D00", "D10", "D20"}
POTHOLE_CLASS = "D40"
IRC_STANDARD = "IRC:82-2023"
BASELINE_IRI = 2.5


def pci_cracking(ce: float) -> float:
    if ce <= 0:
        return 100.0
    denom = ce**2 - 0.737 * ce + 73.09
    if denom <= 0:
        return 0.0
    return min(100.0, max(0.0, 7231.0 / denom))


def pci_ravelling(re: float) -> float:
    if re <= 0:
        return 100.0
    return min(
        100.0,
        max(
            0.0,
            52.92 * math.exp(-0.02525 * re) + 44.1 * math.exp(-0.2899 * re),
        ),
    )


def pci_pothole(pn: float) -> float:
    if pn <= 0:
        return 100.0
    num = -80.32 * pn**3 + 1129.0 * pn**2 - 3524.0 * pn + 3566.0
    den = pn**3 + 5.791 * pn**2 - 28.67 * pn + 35.72
    if den <= 0:
        return 0.0
    return min(100.0, max(0.0, num / den))


def pci_patch(pe: float) -> float:
    if pe <= 0:
        return 100.0
    return min(
        100.0,
        max(
            0.0,
            52.92 * math.exp(-0.02525 * pe) + 44.1 * math.exp(-0.2899 * pe),
        ),
    )


def pci_rut(rd: float) -> float:
    if rd <= 0:
        return 100.0
    denom = rd**2 - 0.737 * rd + 73.09
    if denom <= 0:
        return 0.0
    return min(100.0, max(0.0, 7231.0 / denom))


def pci_roughness(iri: float) -> float:
    if iri <= 0:
        return 100.0
    denom = iri**1.91 - 3.542 * iri + 4.315
    if denom <= 0:
        return 0.0
    return min(100.0, max(0.0, 100.0 / denom))


def _condition_and_recommendation(pci: float) -> tuple[str, str]:
    if pci > 90:
        return "Excellent", "Routine Maintenance"
    if pci > 80:
        return "Good", "Preventive Maintenance"
    if pci > 60:
        return "Satisfactory", "Renewal treatment recommended"
    if pci > 40:
        return "Fair", "Minor Rehabilitation (structural evaluation)"
    if pci > 20:
        return "Poor", "Major Rehabilitation / Structural Overlay"
    return "Failed", "Reconstruction required"


def _safe_fallback() -> dict[str, Any]:
    condition, recommendation = _condition_and_recommendation(50.0)
    return {
        "pci": 50.0,
        "condition": condition,
        "recommendation": recommendation,
        "crack_extent_pct": 0.0,
        "pothole_count": 0,
        "rut_depth_mm": 0.0,
        "iri": BASELINE_IRI,
        "individual_scores": {
            "cracking": 50.0,
            "ravelling": 50.0,
            "pothole": 50.0,
            "patching": 50.0,
            "rut": 50.0,
            "roughness": 50.0,
        },
        "crack_types": [],
        "dominant_crack": None,
        "irc_standard": IRC_STANDARD,
    }


def _class_name(detection: dict[str, Any]) -> str:
    return str(detection.get("class") or detection.get("crack_type") or "")


def _area_px(detection: dict[str, Any]) -> float:
    return float(detection.get("mask_area_px") or detection.get("area_px") or 0.0)


def _crack_extent_pct(detections: list[dict[str, Any]], frame_area_px: float) -> float:
    crack_detections = [det for det in detections if _class_name(det) in CRACK_CLASSES]
    if not crack_detections:
        return 0.0

    crack_area_m2 = sum(
        float(det.get("mask_area_m2") or 0.0)
        for det in crack_detections
        if det.get("mask_area_m2") is not None
    )
    if crack_area_m2 > 0:
        ratios = []
        for det in crack_detections:
            mask_area_m2 = float(det.get("mask_area_m2") or 0.0)
            mask_area_px = _area_px(det)
            if mask_area_m2 > 0 and mask_area_px > 0:
                ratios.append(mask_area_m2 / mask_area_px)
        if ratios:
            total_frame_area_m2 = max(float(frame_area_px) * (sum(ratios) / len(ratios)), 1e-9)
            return min(100.0, max(0.0, crack_area_m2 / total_frame_area_m2 * 100.0))

    crack_area_px = sum(_area_px(det) for det in crack_detections)
    return min(100.0, max(0.0, crack_area_px / max(float(frame_area_px), 1.0) * 100.0))


def _pothole_count(detections: list[dict[str, Any]]) -> int:
    count = 0
    for detection in detections:
        if _class_name(detection) != POTHOLE_CLASS:
            continue
        if detection.get("mask_area_m2") is None or float(detection.get("mask_area_m2") or 0.0) > 0.1:
            count += 1
    return count


def _rut_depth_mm(depth_map: Any) -> float:
    if depth_map is None:
        return 0.0
    try:
        arr = np.asarray(depth_map, dtype=np.float32)
        if arr.ndim < 2 or arr.size == 0:
            return 0.0
        top_third = arr[: max(1, arr.shape[0] // 3), :]
        top_third = top_third[np.isfinite(top_third)]
        if top_third.size == 0:
            return 0.0
        return max(0.0, float(np.std(top_third)) * 0.3 * 1000.0)
    except Exception:
        return 0.0


def score(
    detections: list[dict[str, Any]],
    frame_area_px: float,
    depth_map: Any = None,
) -> dict[str, Any]:
    try:
        detections = detections or []
        frame_area_px = max(float(frame_area_px or 1.0), 1.0)

        ce = _crack_extent_pct(detections, frame_area_px)
        re = 0.0
        pn = _pothole_count(detections)
        pe = 0.0
        rd = _rut_depth_mm(depth_map)
        iri = BASELINE_IRI

        individual_scores = {
            "cracking": pci_cracking(ce),
            "ravelling": pci_ravelling(re),
            "pothole": pci_pothole(float(pn)),
            "patching": pci_patch(pe),
            "rut": pci_rut(rd),
            "roughness": pci_roughness(iri),
        }
        pci = (
            0.40 * individual_scores["roughness"]
            + 0.16 * individual_scores["pothole"]
            + 0.14 * individual_scores["rut"]
            + 0.12 * individual_scores["cracking"]
            + 0.10 * individual_scores["ravelling"]
            + 0.08 * individual_scores["patching"]
        )
        pci = min(100.0, max(0.0, pci))
        condition, recommendation = _condition_and_recommendation(pci)

        crack_types = sorted({_class_name(det) for det in detections if _class_name(det)})
        crack_counter = Counter(_class_name(det) for det in detections if _class_name(det))
        dominant_crack = crack_counter.most_common(1)[0][0] if crack_counter else None

        return {
            "pci": round(pci, 1),
            "condition": condition,
            "recommendation": recommendation,
            "crack_extent_pct": round(ce, 4),
            "pothole_count": pn,
            "rut_depth_mm": round(rd, 4),
            "iri": iri,
            "individual_scores": {
                key: round(value, 4) for key, value in individual_scores.items()
            },
            "crack_types": crack_types,
            "dominant_crack": dominant_crack,
            "irc_standard": IRC_STANDARD,
        }
    except Exception:
        return _safe_fallback()


def score_frame(
    detections: list[dict[str, Any]] | dict[str, Any],
    frame_area_px: float | Any = 1.0,
    depth_map: Any = None,
) -> dict[str, Any]:
    if isinstance(detections, dict) and "detections" in detections:
        detections = detections.get("detections") or []
    if not isinstance(detections, list):
        detections = [detections]
    if not isinstance(frame_area_px, (int, float)):
        frame_area_px = 1.0
    return score(detections, float(frame_area_px), depth_map)


run = score_frame
