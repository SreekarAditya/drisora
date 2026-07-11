# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details

"""Fail-honest PDF export for partial IRC:82-2023 section bounds."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def generate_irc82_pdf_report(
    output_path: str | Path,
    *,
    job_id: str,
    summary: dict[str, Any],
    sections: list[dict[str, Any]],
    frame_count: int,
    detection_count: int,
) -> Path:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except Exception as exc:
        raise RuntimeError("PDF report generation requires reportlab") from exc

    bounds = summary.get("pci_bounds")
    if bounds is not None and (
        not isinstance(bounds, dict)
        or not all(isinstance(bounds.get(key), (int, float)) for key in ("lower", "upper", "width"))
    ):
        raise ValueError("summary.pci_bounds must contain numeric lower, upper, and width")

    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    story: list[Any] = [
        Paragraph("Drisora Partial Pavement Condition Report", styles["Title"]),
        Paragraph(
            "Partial IRC:82-2023 PCI assessment: cracking extent and pothole number are instrumented (28% weight). "
            "Roughness, ravelling, patching, and rut depth are unmeasured; PCI is reported only as bounds.",
            styles["Normal"],
        ),
        Spacer(1, 12),
    ]
    bounds_text = "not computed" if bounds is None else f"{bounds['lower']:.2f}–{bounds['upper']:.2f} (width {bounds['width']:.2f})"
    rows = [
        ["Job ID", job_id],
        ["Generated", datetime.now(timezone.utc).isoformat()],
        ["Frames processed", str(frame_count)],
        ["Detections", str(detection_count)],
        ["PCI bounds", bounds_text],
        ["Point PCI", "not computed"],
        ["100 m GPS sections", str(summary.get("segment_count", len(sections)))],
    ]
    story.extend([Table(rows, colWidths=[140, 330], style=_table_style(colors, TableStyle)), Spacer(1, 16)])
    story.append(Paragraph("Section bounds", styles["Heading2"]))
    section_rows = [["Section", "Chainage (m)", "Length (m)", "PCI bounds", "Raw / unique detections"]]
    for section in sections:
        section_bounds = section.get("pci_bounds") or {}
        section_rows.append([
            str(section.get("section_id", section.get("segment_index", ""))),
            f"{float(section.get('start_distance_m', 0.0)):.1f}–{float(section.get('end_distance_m', 0.0)):.1f}",
            f"{float(section.get('section_length_m', 0.0)):.2f}",
            f"{float(section_bounds['lower']):.2f}–{float(section_bounds['upper']):.2f}",
            f"{int(section.get('raw_detection_count', 0))} / {int(section.get('unique_detection_count', 0))}",
        ])
    story.append(Table(section_rows, repeatRows=1, style=_table_style(colors, TableStyle, header=True)))
    SimpleDocTemplate(str(path), pagesize=A4, title=f"Drisora partial PCI bounds {job_id}").build(story)
    return path


def _table_style(colors: Any, table_style: Any, header: bool = False) -> Any:
    commands: list[tuple[Any, ...]] = [
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#B8C0CC")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ]
    if header:
        commands.extend([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#17324D")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ])
    return table_style(commands)
