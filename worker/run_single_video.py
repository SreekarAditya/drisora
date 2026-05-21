# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any

from PIL import Image

from jobs.dispatcher import dispatch_job
from pipeline import depth_anything_v2_inference, pci_scorer, report_generator, sam2_inference, yolo_inference
from utils.gsd_calibration import attach_gsd
from utils.pci_segmentation import (
    assign_frames_to_segments,
    build_survey_pci_summary,
    compute_cumulative_distances,
    compute_segment_pci,
)


def _frame_area_and_width(image_path: Path) -> tuple[int, int]:
    with Image.open(image_path) as image:
        width, height = image.size
    return max(1, width * height), max(1, width)


def _process_frame(frame: dict[str, Any], enable_depth: bool) -> dict[str, Any]:
    frame_path = Path(frame["path"])
    frame_area_px, image_width_px = _frame_area_and_width(frame_path)
    calibrated_frame = attach_gsd(frame, image_width_px)

    detections = yolo_inference.run(str(frame_path))
    if detections:
        detections = sam2_inference.run(str(frame_path), detections)

    depth_map = None
    if enable_depth:
        depth_result = depth_anything_v2_inference.run(str(frame_path), detections)
        if isinstance(depth_result, dict):
            detections = depth_result.get("detections", detections)
            depth_map = depth_result.get("depth_map")

    pci_result = pci_scorer.score(detections, frame_area_px=frame_area_px, depth_map=depth_map)
    return {
        **calibrated_frame,
        "frame_area_px": frame_area_px,
        "detections": detections,
        "pci_score": pci_result["pci"],
        "pci_details": pci_result,
        "depth_available": depth_map is not None and getattr(depth_map, "size", 0) > 0,
    }


def _section_results(frames: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    distances = compute_cumulative_distances(frames)
    frames_with_distances = [
        {**frame, "cumulative_distance_m": distances[index]} for index, frame in enumerate(frames)
    ]
    section_map = assign_frames_to_segments(frames_with_distances)
    sections: list[dict[str, Any]] = []
    for segment_index, segment_frames in sorted(section_map.items()):
        detections = [
            detection
            for frame in segment_frames
            for detection in (frame.get("detections") or [])
        ]
        section = compute_segment_pci(segment_frames, detections)
        sections.append({"segment_index": segment_index, **section})
    return sections, build_survey_pci_summary(sections)


def run_single_video(args: argparse.Namespace) -> dict[str, Any]:
    started = time.perf_counter()
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    files: dict[str, Any] = {
        "video": str(Path(args.video).expanduser()),
        "frame_extraction_mode": "all_frames" if args.all_frames else "interval",
        "frame_interval_seconds": None if args.all_frames else args.frame_interval_seconds,
    }
    if args.srt:
        files["srt"] = str(Path(args.srt).expanduser())

    frame_batch = dispatch_job(args.job_id, "drone_footage", files)
    frame_results = [_process_frame(frame, args.enable_depth) for frame in frame_batch["frames"]]
    sections, summary = _section_results(frame_results)

    detection_count = sum(len(frame.get("detections") or []) for frame in frame_results)
    result = {
        "job_id": args.job_id,
        "mode": "single_video",
        "pipeline": "Frame Extraction -> YOLOv12s -> SAM2 -> Depth Anything V2 -> IRC:82-2023 PCI",
        "frame_count": len(frame_results),
        "detection_count": detection_count,
        "frames": frame_results,
        "sections": sections,
        "summary": summary,
        "elapsed_ms": int((time.perf_counter() - started) * 1000),
    }

    result_path = out_dir / "results.json"
    result_path.write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")
    report_generator.generate_irc82_pdf_report(
        out_dir / "report.pdf",
        job_id=args.job_id,
        summary=summary,
        sections=sections,
        frame_count=len(frame_results),
        detection_count=detection_count,
    )
    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Drisora backend inference on one drone video.")
    parser.add_argument("--video", required=True, help="Path to drone MP4/MOV input.")
    parser.add_argument("--srt", help="Path to matching DJI SRT telemetry file.")
    parser.add_argument("--out", default="outputs/single-video", help="Output directory.")
    parser.add_argument("--job-id", default="local-single-video", help="Result identifier.")
    parser.add_argument("--frame-interval-seconds", type=float, default=1.0)
    parser.add_argument("--all-frames", dest="all_frames", action="store_true", help="Decode every frame instead of interval sampling.")
    parser.add_argument("--sample-frames", dest="all_frames", action="store_false", help="Sample frames by --frame-interval-seconds.")
    parser.set_defaults(all_frames=True)
    parser.add_argument("--enable-depth", dest="enable_depth", action="store_true", help="Enable Depth Anything V2 metric depth enrichment.")
    parser.add_argument("--disable-depth", dest="enable_depth", action="store_false", help="Skip metric depth enrichment.")
    parser.set_defaults(enable_depth=True)
    return parser.parse_args()


if __name__ == "__main__":
    run_single_video(parse_args())
