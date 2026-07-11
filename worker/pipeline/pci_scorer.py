# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

"""Section-level partial PCI scoring for IRC:82-2023.

The production detector instruments two of the six functional parameters:
cracking extent and pothole number.  The other four parameters stay ``None``;
they are never replaced by constants, imagery-derived proxies, or priors.

All equation functions are pure.  ``score`` is deliberately stricter: it
accepts only spatially deduplicated, section-level physical measurements and
returns PCI bounds.  ``evaluate_complete_pci`` is available for validation and
future instrumented surveys, but returns a point PCI only when all six inputs
are present.
"""

from __future__ import annotations

import math
from enum import Enum
from typing import Any, Callable, Mapping


IRC_EDITION = "IRC:82-2023"
SCORING_VERSION = "drisora_partial_irc82_2023_v2"


class RoadClass(str, Enum):
    HIGHWAY = "HIGHWAY"
    MDR_RURAL = "MDR_RURAL"
    URBAN = "URBAN"


class SurfaceType(str, Enum):
    SD = "SD"
    OGPC = "OGPC"
    MSS = "MSS"
    SDBC = "SDBC"
    BC = "BC"


# IRC:82-2023, Table 5.4 — weightage for functional parameters.
WEIGHTS: dict[str, float] = {
    "roughness": 0.40,
    "pothole": 0.16,
    "rut": 0.14,
    "cracking": 0.12,
    "ravelling": 0.10,
    "patching": 0.08,
}
MEASURED_PARAMETERS = ("cracking", "pothole")
UNMEASURED_PARAMETERS = ("ravelling", "patching", "rut", "roughness")
MEASURED_WEIGHT_FRACTION = 0.28
UNMEASURED_WEIGHT_FRACTION = 0.72
assert math.isclose(
    MEASURED_WEIGHT_FRACTION,
    sum(WEIGHTS[name] for name in MEASURED_PARAMETERS),
)
assert math.isclose(
    UNMEASURED_WEIGHT_FRACTION,
    sum(WEIGHTS[name] for name in UNMEASURED_PARAMETERS),
)

# IRC:82-2023, Clause 7.5.3.4 — one pothole unit is 0.1 square metres.
POTHOLE_UNIT_AREA_M2 = 0.1

# The final printed Table A2.2 pothole polynomial omits a decreasing term and
# grows above 100 as PN increases, contradicting the curve printed beside it.
# The preceding official IRC H-6 draft publishes the equation represented by
# that curve.  This explicit erratum note is emitted in result provenance.
MDR_POTHOLE_EQUATION_NOTE = (
    "Published IRC:82-2023 Table A2.2 pothole polynomial is malformed and "
    "contradicts its plotted curve; the curve-consistent official IRC H-6 "
    "draft polynomial is used pending an IRC corrigendum."
)


def _finite_nonnegative(value: Any, name: str) -> float:
    if value is None:
        raise ValueError(f"{name} is required")
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be a finite non-negative number") from exc
    if not math.isfinite(number) or number < 0.0:
        raise ValueError(f"{name} must be a finite non-negative number")
    return number


def _bounded_index(value: float) -> float:
    if not math.isfinite(value):
        raise ArithmeticError("PCI sub-index equation returned a non-finite value")
    return min(100.0, max(0.0, value))


def _rational(numerator: float, denominator: float) -> float:
    if abs(denominator) < 1e-12:
        raise ArithmeticError("PCI sub-index equation denominator is zero")
    return _bounded_index(numerator / denominator)


# IRC:82-2023 Appendix-2, Table A2.1 — Highways (Expressways, NH, SH).
def highway_cracking(ce: float) -> float:
    ce = _finite_nonnegative(ce, "cracking extent")
    return _rational(7231.0, ce**2 - 0.737 * ce + 73.09)


# IRC:82-2023 Appendix-2, Table A2.1 — Highways (Expressways, NH, SH).
def highway_ravelling(re: float) -> float:
    re = _finite_nonnegative(re, "ravelling extent")
    return _bounded_index(
        52.92 * math.exp(-0.02525 * re) + 44.1 * math.exp(-0.2899 * re)
    )


# IRC:82-2023 Appendix-2, Table A2.1 — Highways (Expressways, NH, SH).
def highway_pothole(pn: float) -> float:
    pn = _finite_nonnegative(pn, "pothole number")
    numerator = -80.32 * pn**3 + 1129.0 * pn**2 - 3524.0 * pn + 3566.0
    denominator = pn**3 + 5.791 * pn**2 - 28.67 * pn + 35.72
    return _rational(numerator, denominator)


# IRC:82-2023 Appendix-2, Table A2.1 — Highways (Expressways, NH, SH).
def highway_patching(pe: float) -> float:
    return highway_ravelling(_finite_nonnegative(pe, "patch extent"))


# IRC:82-2023 Appendix-2, Table A2.1 — Highways (Expressways, NH, SH).
def highway_rut(rd: float) -> float:
    return highway_cracking(_finite_nonnegative(rd, "rut depth"))


# IRC:82-2023 Appendix-2, Table A2.1 — Highways (Expressways, NH, SH).
def highway_roughness(iri: float) -> float:
    iri = _finite_nonnegative(iri, "IRI")
    return _rational(100.0, iri**1.91 - 3.542 * iri + 4.315)


def _mdr_common(value: float, name: str) -> float:
    value = _finite_nonnegative(value, name)
    numerator = (
        -0.5662 * value**3
        + 85.14 * value**2
        - 3377.0 * value
        + 5.182e4
    )
    denominator = value**2 - 29.31 * value + 523.4
    return _rational(numerator, denominator)


# IRC:82-2023 Appendix-2, Table A2.2 — MDR and rural roads.
def mdr_rural_cracking(ce: float) -> float:
    return _mdr_common(ce, "cracking extent")


# IRC:82-2023 Appendix-2, Table A2.2 — MDR and rural roads.
def mdr_rural_ravelling(re: float) -> float:
    return _mdr_common(re, "ravelling extent")


# IRC H-6 official draft Appendix-2 — curve-consistent correction for the
# malformed pothole polynomial printed in IRC:82-2023 Table A2.2.
def mdr_rural_pothole(pn: float) -> float:
    pn = _finite_nonnegative(pn, "pothole number")
    return _bounded_index(
        0.1204 * pn**3 - 1.5385 * pn**2 - 6.519 * pn + 99.231
    )


# IRC:82-2023 Appendix-2, Table A2.2 — MDR and rural roads.
def mdr_rural_patching(pe: float) -> float:
    pe = _finite_nonnegative(pe, "patch extent")
    numerator = -1.723e-3 * pe**3 - 8.273e-2 * pe**2 + 21.39 * pe + 419.1
    return _rational(numerator, pe + 4.267)


# IRC:82-2023 Appendix-2, Table A2.2 — MDR and rural roads.
def mdr_rural_rut(rd: float) -> float:
    return _mdr_common(rd, "rut depth")


# IRC:82-2023 Appendix-2, Table A2.2 Part A — Surface Dressing (SD).
def mdr_roughness_sd(iri: float) -> float:
    iri = _finite_nonnegative(iri, "IRI")
    numerator = (
        -0.09535 * iri**5
        + 4.235 * iri**4
        - 74.43 * iri**3
        + 642.4 * iri**2
        - 2625.0 * iri
        + 4034.0
    )
    return _rational(numerator, iri**2 - 9.065 * iri + 20.71)


# IRC:82-2023 Appendix-2, Table A2.2 Part A — Open Graded Premix Carpet.
def mdr_roughness_ogpc(iri: float) -> float:
    iri = _finite_nonnegative(iri, "IRI")
    numerator = -4.842 * iri**3 + 121.5 * iri**2 - 875.9 * iri + 2029.0
    return _rational(numerator, iri**2 - 8.389 * iri + 19.85)


# IRC:82-2023 Appendix-2, Table A2.2 Part A — Mix Seal Surfacing.
def mdr_roughness_mss(iri: float) -> float:
    iri = _finite_nonnegative(iri, "IRI")
    numerator = (
        -2.686 * iri**4
        + 64.96 * iri**3
        - 437.2 * iri**2
        + 1046.0 * iri
        - 596.2
    )
    denominator = iri**3 - 9.766 * iri**2 + 31.09 * iri - 30.94
    return _rational(numerator, denominator)


# IRC:82-2023 Appendix-2, Table A2.2 Part A — Semi Dense Bituminous Course.
def mdr_roughness_sdbc(iri: float) -> float:
    iri = _finite_nonnegative(iri, "IRI")
    numerator = -4.468 * iri**3 + 106.2 * iri**2 - 694.7 * iri + 1507.0
    return _rational(numerator, iri**2 - 6.778 * iri + 14.51)


# IRC:82-2023 Appendix-2, Table A2.2 Part A — Bituminous Concrete.
def mdr_roughness_bc(iri: float) -> float:
    iri = _finite_nonnegative(iri, "IRI")
    numerator = (
        -2.53 * iri**4
        + 55.18 * iri**3
        - 293.4 * iri**2
        + 476.4 * iri
        - 5.565
    )
    denominator = iri**3 - 7.458 * iri**2 + 17.77 * iri - 12.09
    return _rational(numerator, denominator)


MDR_ROUGHNESS_FUNCTIONS: dict[SurfaceType, Callable[[float], float]] = {
    SurfaceType.SD: mdr_roughness_sd,
    SurfaceType.OGPC: mdr_roughness_ogpc,
    SurfaceType.MSS: mdr_roughness_mss,
    SurfaceType.SDBC: mdr_roughness_sdbc,
    SurfaceType.BC: mdr_roughness_bc,
}


# IRC:82-2023 Appendix-2, Table A2.3 — Urban roads.
def urban_cracking(ce: float) -> float:
    ce = _finite_nonnegative(ce, "cracking extent")
    return _bounded_index(100.0 * math.exp(-0.0534 * ce) - 0.006641 * ce)


# IRC:82-2023 Appendix-2, Table A2.3 — Urban roads.
def urban_ravelling(re: float) -> float:
    return highway_cracking(_finite_nonnegative(re, "ravelling extent"))


# IRC:82-2023 Appendix-2, Table A2.3 — Urban roads.
def urban_pothole(pn: float) -> float:
    pn = _finite_nonnegative(pn, "pothole number")
    numerator = -130.5 * pn**3 + 2112.0 * pn**2 - 9550.0 * pn + 14390.0
    denominator = pn**3 + 6.619 * pn**2 - 66.73 * pn + 144.1
    return _rational(numerator, denominator)


# IRC:82-2023 Appendix-2, Table A2.3 — Urban roads.
def urban_patching(pe: float) -> float:
    return highway_cracking(_finite_nonnegative(pe, "patch extent"))


# IRC:82-2023 Appendix-2, Table A2.3 — Urban roads.
def urban_rut(rd: float) -> float:
    return highway_cracking(_finite_nonnegative(rd, "rut depth"))


# IRC:82-2023 Appendix-2, Table A2.3 — Urban roads.
def urban_roughness(iri: float) -> float:
    return highway_roughness(_finite_nonnegative(iri, "IRI"))


def _road_class(value: RoadClass | str) -> RoadClass:
    try:
        return value if isinstance(value, RoadClass) else RoadClass(str(value).upper())
    except (TypeError, ValueError) as exc:
        choices = ", ".join(member.value for member in RoadClass)
        raise ValueError(f"road_class must be one of: {choices}") from exc


def _surface_type(value: SurfaceType | str | None, road_class: RoadClass) -> SurfaceType | None:
    if road_class != RoadClass.MDR_RURAL:
        if value is not None:
            raise ValueError("surface_type is only valid for MDR_RURAL")
        return None
    if value is None:
        raise ValueError("surface_type is required for MDR_RURAL")
    try:
        return value if isinstance(value, SurfaceType) else SurfaceType(str(value).upper())
    except (TypeError, ValueError) as exc:
        choices = ", ".join(member.value for member in SurfaceType)
        raise ValueError(f"surface_type must be one of: {choices}") from exc


def equation_set(
    road_class: RoadClass | str,
    surface_type: SurfaceType | str | None = None,
) -> dict[str, Callable[[float], float]]:
    """Return the six pure sub-index functions for a road class."""
    road = _road_class(road_class)
    surface = _surface_type(surface_type, road)
    if road == RoadClass.HIGHWAY:
        return {
            "cracking": highway_cracking,
            "ravelling": highway_ravelling,
            "pothole": highway_pothole,
            "patching": highway_patching,
            "rut": highway_rut,
            "roughness": highway_roughness,
        }
    if road == RoadClass.MDR_RURAL:
        assert surface is not None
        return {
            "cracking": mdr_rural_cracking,
            "ravelling": mdr_rural_ravelling,
            "pothole": mdr_rural_pothole,
            "patching": mdr_rural_patching,
            "rut": mdr_rural_rut,
            "roughness": MDR_ROUGHNESS_FUNCTIONS[surface],
        }
    return {
        "cracking": urban_cracking,
        "ravelling": urban_ravelling,
        "pothole": urban_pothole,
        "patching": urban_patching,
        "rut": urban_rut,
        "roughness": urban_roughness,
    }


def _condition_and_recommendation(pci: float) -> tuple[str, str]:
    # IRC:82-2023 Table 5.5; satisfactory treatment follows Section 9.5.
    if pci > 90.0:
        return "Excellent", "Routine Maintenance"
    if pci > 80.0:
        return "Good", "Preventive Maintenance"
    if pci > 60.0:
        return "Satisfactory", "Renewal"
    if pci > 40.0:
        return "Fair", "Minor Rehabilitation (based on structural evaluation)"
    if pci > 20.0:
        return "Poor", "Major Rehabilitation / Structural Overlay"
    return "Fail", "Reconstruction"


def evaluate_complete_pci(
    inputs: Mapping[str, Any],
    *,
    road_class: RoadClass | str,
    surface_type: SurfaceType | str | None = None,
) -> dict[str, Any]:
    """Evaluate a point PCI only when all six parameters are measured."""
    road = _road_class(road_class)
    surface = _surface_type(surface_type, road)
    functions = equation_set(road, surface)
    source_keys = {
        "cracking": "cracking_extent_pct",
        "ravelling": "ravelling_extent_pct",
        "pothole": "pothole_number",
        "patching": "patching_extent_pct",
        "rut": "rut_depth_mm",
        "roughness": "iri_m_per_km",
    }
    values = {
        parameter: _finite_nonnegative(inputs.get(input_key), input_key)
        for parameter, input_key in source_keys.items()
    }
    sub_indices = {
        parameter: functions[parameter](value)
        for parameter, value in values.items()
    }
    pci = sum(WEIGHTS[name] * sub_indices[name] for name in WEIGHTS)
    pci = _bounded_index(pci)
    condition, recommendation = _condition_and_recommendation(pci)
    return {
        "irc_edition": IRC_EDITION,
        "road_class": road.value,
        "surface_type": surface.value if surface is not None else None,
        "inputs": values,
        "sub_indices": sub_indices,
        "pci_complete": pci,
        "condition": condition,
        "recommendation": recommendation,
        "standard_errata": [MDR_POTHOLE_EQUATION_NOTE] if road == RoadClass.MDR_RURAL else [],
    }


def _validated_provenance(provenance: Mapping[str, Any] | None) -> dict[str, Any]:
    if not isinstance(provenance, Mapping):
        raise ValueError("provenance is required")
    required = ("models", "seed", "gsd", "code_commit")
    missing = [name for name in required if provenance.get(name) in (None, "", {})]
    if missing:
        raise ValueError(f"provenance is missing required fields: {', '.join(missing)}")
    return dict(provenance)


def _area_uncertainty(
    distresses: Mapping[str, Any],
    parameter: str,
    nominal: float,
    section_area: float,
) -> dict[str, float]:
    all_bounds = distresses.get("area_uncertainty_m2")
    if not isinstance(all_bounds, Mapping) or not isinstance(all_bounds.get(parameter), Mapping):
        raise ValueError(f"area_uncertainty_m2.{parameter} is required")
    raw = all_bounds[parameter]
    lower = _finite_nonnegative(raw.get("lower"), f"{parameter} area uncertainty lower")
    upper = _finite_nonnegative(raw.get("upper"), f"{parameter} area uncertainty upper")
    if lower > nominal or upper < nominal or upper > section_area:
        raise ValueError(
            f"{parameter} area uncertainty must contain the nominal area and stay within section area"
        )
    return {"lower": lower, "upper": upper}


def score(
    distresses: Mapping[str, Any],
    *,
    road_class: RoadClass | str,
    surface_type: SurfaceType | str | None = None,
    section_length_m: float,
    carriageway_width_m: float,
    provenance: Mapping[str, Any],
) -> dict[str, Any]:
    """Return a section-level partial PCI assessment with a 72-point interval."""
    if not isinstance(distresses, Mapping):
        raise TypeError("distresses must be a section-level measurement mapping")
    if distresses.get("detector_status") != "success":
        raise RuntimeError("detector did not complete successfully; no PCI result produced")
    if distresses.get("segmentation_status") != "success":
        raise RuntimeError("segmentation did not complete successfully; no PCI result produced")
    if distresses.get("spatial_dedup_applied") is not True:
        raise RuntimeError("spatial deduplication is required before section PCI scoring")
    usable_frame_count = int(_finite_nonnegative(distresses.get("usable_frame_count"), "usable_frame_count"))
    if usable_frame_count <= 0:
        raise RuntimeError("section has no usable frames; no PCI result produced")

    road = _road_class(road_class)
    surface = _surface_type(surface_type, road)
    section_length = _finite_nonnegative(section_length_m, "section_length_m")
    carriageway_width = _finite_nonnegative(carriageway_width_m, "carriageway_width_m")
    if section_length <= 0.0 or carriageway_width <= 0.0:
        raise ValueError("section_length_m and carriageway_width_m must be greater than zero")
    section_area = section_length * carriageway_width

    cracking_area = _finite_nonnegative(distresses.get("cracking_area_m2"), "cracking_area_m2")
    pothole_area = _finite_nonnegative(distresses.get("pothole_area_m2"), "pothole_area_m2")
    if cracking_area > section_area or pothole_area > section_area:
        raise ValueError("distress area cannot exceed pavement section area")
    cracking_area_uncertainty = _area_uncertainty(
        distresses, "cracking", cracking_area, section_area
    )
    pothole_area_uncertainty = _area_uncertainty(
        distresses, "pothole", pothole_area, section_area
    )

    cracking_extent_pct = cracking_area / section_area * 100.0
    pothole_number = pothole_area / POTHOLE_UNIT_AREA_M2
    functions = equation_set(road, surface)
    cracking_index = functions["cracking"](cracking_extent_pct)
    pothole_index = functions["pothole"](pothole_number)
    measured_contribution = (
        WEIGHTS["cracking"] * cracking_index
        + WEIGHTS["pothole"] * pothole_index
    )
    lower = _bounded_index(measured_contribution)
    upper = _bounded_index(measured_contribution + UNMEASURED_WEIGHT_FRACTION * 100.0)
    lower_condition, lower_recommendation = _condition_and_recommendation(lower)
    upper_condition, upper_recommendation = _condition_and_recommendation(upper)

    provenance_result = _validated_provenance(provenance)
    if road == RoadClass.MDR_RURAL:
        provenance_result.setdefault("standard_errata", []).append(MDR_POTHOLE_EQUATION_NOTE)

    no_distress_found = cracking_area == 0.0 and pothole_area == 0.0
    return {
        "irc_edition": IRC_EDITION,
        "scoring_version": SCORING_VERSION,
        "assessment_scope": "partial",
        "road_class": road.value,
        "surface_type": surface.value if surface is not None else None,
        "section_id": distresses.get("section_id"),
        "section_length_m": section_length,
        "carriageway_width_m": carriageway_width,
        "section_area_m2": section_area,
        "detection_state": "no_distress_found" if no_distress_found else "distress_detected",
        "measured": {
            "cracking": {
                "area_m2": cracking_area,
                "area_uncertainty_m2": cracking_area_uncertainty,
                "extent_pct": cracking_extent_pct,
                "sub_index": cracking_index,
                "weight": WEIGHTS["cracking"],
            },
            "pothole": {
                "area_m2": pothole_area,
                "area_uncertainty_m2": pothole_area_uncertainty,
                "pothole_unit_area_m2": POTHOLE_UNIT_AREA_M2,
                "number": pothole_number,
                "number_uncertainty": {
                    "lower": pothole_area_uncertainty["lower"] / POTHOLE_UNIT_AREA_M2,
                    "upper": pothole_area_uncertainty["upper"] / POTHOLE_UNIT_AREA_M2,
                },
                "sub_index": pothole_index,
                "weight": WEIGHTS["pothole"],
            },
        },
        "unmeasured": {
            "ravelling": None,
            "patching": None,
            "rut": None,
            "roughness": None,
        },
        "measured_weight_fraction": MEASURED_WEIGHT_FRACTION,
        "unmeasured_weight_fraction": UNMEASURED_WEIGHT_FRACTION,
        "pci_complete": None,
        "pci_bounds": {
            "lower": lower,
            "upper": upper,
            "width": upper - lower,
        },
        "condition_bounds": {
            "lower": {
                "condition": lower_condition,
                "recommendation": lower_recommendation,
            },
            "upper": {
                "condition": upper_condition,
                "recommendation": upper_recommendation,
            },
        },
        "provenance": provenance_result,
    }


# Compatibility aliases intentionally expose structured results only.
score_section = score
run = score
