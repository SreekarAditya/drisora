# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

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
    """Write a compact IRC:82-2023 pavement condition PDF report."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except Exception as exc:
        raise RuntimeError("PDF report generation requires reportlab") from exc

    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(str(path), pagesize=A4, title=f"Drisora IRC:82-2023 Report {job_id}")
    story: list[Any] = []

    story.append(Paragraph("Drisora Pavement Condition Report", styles["Title"]))
    story.append(Paragraph("IRC:82-2023 pavement condition intelligence pipeline", styles["Normal"]))
    story.append(Spacer(1, 12))

    generated_at = datetime.now(timezone.utc).isoformat()
    weighted_pci = summary.get("weighted_pci", summary.get("average_pci", 0.0))
    report_rows = [
        ["Job ID", job_id],
        ["Generated", generated_at],
        ["Frames processed", str(frame_count)],
        ["Detections", str(detection_count)],
        ["Weighted PCI", f"{float(weighted_pci):.2f}"],
        ["PCI grade", str(summary.get("pci_grade", "Unknown"))],
        ["Total length (m)", f"{float(summary.get('total_length_m', 0.0)):.2f}"],
        ["10 m sections", str(summary.get("segment_count", len(sections)))],
    ]
    story.append(Table(report_rows, colWidths=[140, 330], style=_table_style()))
    story.append(Spacer(1, 16))

    story.append(Paragraph("Section PCI", styles["Heading2"]))
    section_rows = [["Section", "Length (m)", "PCI", "Grade", "Relative", "Detections"]]
    for section in sections:
        section_rows.append(
            [
                str(section.get("segment_index", "")),
                f"{float(section.get('total_length_m', 0.0)):.2f}",
                f"{float(section.get('pci_score', 0.0)):.2f}",
                str(section.get("pci_grade", "")),
                "yes" if section.get("is_relative") else "no",
                str(section.get("detection_count", 0)),
            ]
        )
    story.append(Table(section_rows, repeatRows=1, style=_table_style(header=True)))
    doc.build(story)
    return path


def _table_style(header: bool = False) -> TableStyle:
    commands: list[tuple[Any, ...]] = [
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#B8C0CC")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    if header:
        commands.extend(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#17324D")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ]
        )
    return TableStyle(commands)
