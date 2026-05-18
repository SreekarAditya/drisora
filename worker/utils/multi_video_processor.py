"""Multi-video survey processor for Drisora pavement intelligence.

Orchestrates GPS-deduped frame processing across multiple drone video files,
then computes per-segment PCI and persists results to Supabase.

This is a legacy survey-level helper. The active RunPod path builds a
``drone_footage`` multi-video payload and dispatches through ``jobs.dispatcher``.
If this helper is wired back in, every video entry must carry a paired .SRT GPS
log. It does NOT run YOLO/SAM2/DepthPro itself; those are delegated to the
``process_frame_fn`` callable supplied by the caller.
"""

from __future__ import annotations

from typing import Any, Callable

from ingest.srt_parser import parse_srt
from ingest.video_handler import attach_gps_to_frames, extract_frames
from utils.gps_dedup import compute_footprint_radius, is_duplicate_frame
from utils.pci_segmentation import (
    assign_frames_to_segments,
    build_survey_pci_summary,
    compute_cumulative_distances,
    compute_segment_pci,
)
from utils.srt_parser import parse_dji_srt

# Default DJI Mavic 3 FOV used when a frame has no SRT data.
_DEFAULT_FOV_DEG: float = 73.7
_DEFAULT_ALT_M: float = 30.0


def _log(logger: Callable[..., None] | None, message: str) -> None:
    """Emit a log message via *logger* or fall back to ``print``."""
    if logger is not None:
        logger(message)
    else:
        print(message, flush=True)


def _flight_bounds(frames: list[dict[str, Any]]) -> dict[str, float | None]:
    """Compute bounding box over frames that have GPS."""
    lats = [f["lat"] for f in frames if f.get("lat") is not None]
    lons = [f["lon"] for f in frames if f.get("lon") is not None]
    if not lats:
        return {"min_lat": None, "max_lat": None, "min_lon": None, "max_lon": None}
    return {
        "min_lat": min(lats),
        "max_lat": max(lats),
        "min_lon": min(lons),
        "max_lon": max(lons),
    }


def process_multi_video_survey(
    job_id: str,
    survey_id: str,
    video_entries: list[dict[str, Any]],
    process_frame_fn: Callable[[dict[str, Any], bool], dict[str, Any]],
    supabase_client: Any,
    logger: Callable[..., None] | None = None,
) -> dict[str, Any]:
    """Orchestrate multi-video survey processing.

    Parameters
    ----------
    job_id:
        RunPod job identifier (used for logging context).
    survey_id:
        Supabase survey UUID to update on completion.
    video_entries:
        Each dict must contain:
        ``video_id``, ``video_path``, ``srt_path`` (or None),
        ``video_filename``, ``srt_filename`` (or None).
    process_frame_fn:
        Callable matching ``_process_frame(frame: dict, use_depth: bool)``
        from handler.py.  Returns a result dict with at least
        ``pci_score`` and ``detections``.
    supabase_client:
        Supabase Python client for persistence.
    logger:
        Optional callable for log output; defaults to ``print``.

    Returns
    -------
    dict
        Processing summary — see module docstring for schema.
    """
    prefix = f"[SURVEY {survey_id}]"

    # ------------------------------------------------------------------
    # Guard: empty input
    # ------------------------------------------------------------------
    if not video_entries:
        _log(logger, f"{prefix} No video entries supplied — returning empty result.")
        return {
            "status": "complete",
            "survey_id": survey_id,
            "videos_processed": 0,
            "total_frames": 0,
            "skipped_frames": 0,
            "average_pci": 0.0,
            "total_length_m": 0.0,
            "segments": [],
            "survey_summary": {
                "weighted_pci": 0.0,
                "total_length_m": 0.0,
                "segment_count": 0,
                "rpci_segment_count": 0,
            },
            "skipped_videos": [],
        }

    # ------------------------------------------------------------------
    # Step 1 — Parse all SRT files.
    # ------------------------------------------------------------------
    _log(logger, f"{prefix} Parsing SRT files for {len(video_entries)} video(s).")
    srt_map: dict[str, list[dict[str, Any]]] = {}  # video_id -> dji srt entries
    raw_srt_map: dict[str, list] = {}  # video_id -> raw SrtEntry list (for attach_gps_to_frames)

    for entry in video_entries:
        vid = entry["video_id"]
        srt_path = entry.get("srt_path")
        filename = entry.get("video_filename", vid)
        if not srt_path:
            raise ValueError(f"{filename}: missing required .SRT GPS log")
        try:
            dji_entries = parse_dji_srt(srt_path)
            srt_map[vid] = dji_entries
            # Also keep the raw SrtEntry list so attach_gps_to_frames can use it.
            raw_srt_map[vid] = parse_srt(srt_path) if srt_path else []
            _log(logger, f"{prefix} {filename}: parsed {len(dji_entries)} SRT entries.")
        except (ValueError, Exception) as exc:
            _log(logger, f"{prefix} WARNING — {filename}: SRT parse failed ({exc}). Processing without GPS.")
            srt_map[vid] = []
            raw_srt_map[vid] = []

    # ------------------------------------------------------------------
    # Step 2 — Sort videos chronologically by first SRT timestamp.
    # ------------------------------------------------------------------
    def _first_ts(entry: dict[str, Any]) -> int:
        dji = srt_map.get(entry["video_id"], [])
        if dji:
            return min(e["timestamp_ms"] for e in dji)
        return 2**62  # no SRT → sort last

    sorted_entries = sorted(video_entries, key=_first_ts)
    _log(logger, f"{prefix} Video processing order: {[e.get('video_filename', e['video_id']) for e in sorted_entries]}")

    # ------------------------------------------------------------------
    # Step 3-5 — Process each video in order.
    # ------------------------------------------------------------------
    processed_zones: list[dict[str, Any]] = []  # global dedup registry

    # Accumulators
    all_processed_frames: list[dict[str, Any]] = []  # frames that were processed (not skipped)
    skipped_videos: list[dict[str, str]] = []
    video_stats: dict[str, dict[str, Any]] = {}  # video_id -> {processed, skipped, frames}

    total_frames_processed = 0
    total_frames_skipped = 0
    global_frame_index = 0

    for entry in sorted_entries:
        vid = entry["video_id"]
        video_path = entry["video_path"]
        filename = entry.get("video_filename", vid)
        dji_entries = srt_map.get(vid, [])
        raw_srt = raw_srt_map.get(vid, [])

        _log(logger, f"{prefix} Extracting frames from {filename}.")
        try:
            raw_frames = extract_frames(video_path, interval_seconds=1)
        except Exception as exc:
            _log(logger, f"{prefix} ERROR — could not extract frames from {filename}: {exc}")
            video_stats[vid] = {"processed": 0, "skipped": 0, "frames": []}
            continue

        # Attach GPS if SRT data is available.
        if raw_srt:
            frames = attach_gps_to_frames(raw_frames, raw_srt)
        else:
            frames = raw_frames

        _log(logger, f"{prefix} {filename}: {len(frames)} frames extracted.")

        video_processed = 0
        video_skipped = 0
        video_frames_out: list[dict[str, Any]] = []

        for frame in frames:
            lat = frame.get("lat")
            lon = frame.get("lon")
            alt_m = frame.get("alt_m") or _DEFAULT_ALT_M

            # Build a unified frame dict for the processor.
            frame_dict: dict[str, Any] = {
                "path": frame["path"],
                "index": global_frame_index,
                "timestamp_ms": frame.get("timestamp_ms"),
                "lat": lat,
                "lon": lon,
                "alt_m": alt_m,
            }

            # GPS deduplication.
            if lat is not None and lon is not None:
                check_dict = {
                    "lat": lat,
                    "lon": lon,
                    "altitude_m": alt_m,
                    "fov_deg": _DEFAULT_FOV_DEG,
                }
                if is_duplicate_frame(check_dict, processed_zones):
                    video_skipped += 1
                    total_frames_skipped += 1
                    continue  # skip duplicate

                # Register this zone before processing.
                radius_m = compute_footprint_radius(alt_m, _DEFAULT_FOV_DEG)
                processed_zones.append({
                    "lat": lat,
                    "lon": lon,
                    "footprint_radius_m": radius_m,
                })

            # Process the frame.
            try:
                result = process_frame_fn(frame_dict, False)
            except Exception as exc:
                _log(logger, f"{prefix} WARNING — frame {global_frame_index} processing failed: {exc}")
                result = {}

            # Merge processing result back into frame_dict for downstream use.
            processed_frame = {**frame_dict, **result}
            processed_frame["cumulative_distance_m"] = 0.0  # filled after all videos

            video_frames_out.append(processed_frame)
            video_processed += 1
            total_frames_processed += 1
            global_frame_index += 1

        video_stats[vid] = {
            "processed": video_processed,
            "skipped": video_skipped,
            "frames": video_frames_out,
        }
        all_processed_frames.extend(video_frames_out)

        if video_processed == 0 and (len(frames) > 0):
            msg = f"{filename} was entirely overlapping with previously processed footage and was skipped"
            _log(logger, f"{prefix} {msg}")
            skipped_videos.append({"video_filename": filename, "reason": msg})

        _log(logger, f"{prefix} {filename}: processed={video_processed}, skipped={video_skipped}.")

    # ------------------------------------------------------------------
    # Step 6 — Compute cumulative distances and assign segments.
    # ------------------------------------------------------------------
    _log(logger, f"{prefix} Computing cumulative distances over {len(all_processed_frames)} frames.")
    cumulative_distances = compute_cumulative_distances(all_processed_frames)
    for i, frame in enumerate(all_processed_frames):
        frame["cumulative_distance_m"] = cumulative_distances[i] if i < len(cumulative_distances) else 0.0

    segment_map = assign_frames_to_segments(all_processed_frames)

    # Build per-segment PCI results.
    segments_out: list[dict[str, Any]] = []
    for seg_idx in sorted(segment_map.keys()):
        seg_frames = segment_map[seg_idx]
        seg_result = compute_segment_pci(seg_frames)
        segments_out.append({
            "segment_index": seg_idx,
            "start_m": seg_idx * 100.0,
            "end_m": (seg_idx + 1) * 100.0,
            "pci_score": seg_result["pci_score"],
            "pci_grade": seg_result["pci_grade"],
            "is_relative": seg_result["is_relative"],
            "detection_count": seg_result["detection_count"],
        })

    # Add segment_index into each seg_result for build_survey_pci_summary.
    enriched_segs = [
        {**compute_segment_pci(segment_map[si]), "segment_index": si}
        for si in sorted(segment_map.keys())
    ]
    survey_summary = build_survey_pci_summary(enriched_segs)

    # ------------------------------------------------------------------
    # Step 7 — Persist to Supabase.
    # ------------------------------------------------------------------
    _log(logger, f"{prefix} Persisting results to Supabase.")

    # 7a — Update each survey_video record.
    for entry in sorted_entries:
        vid = entry["video_id"]
        stats = video_stats.get(vid, {"processed": 0, "skipped": 0, "frames": []})
        bounds = _flight_bounds(stats["frames"])
        try:
            supabase_client.table("survey_videos").update({
                "processed_frame_count": stats["processed"],
                "skipped_frame_count": stats["skipped"],
                "status": "done",
                "flight_bounds": bounds,
            }).eq("id", vid).execute()
        except Exception as exc:
            _log(logger, f"{prefix} ERROR — could not update survey_video {vid}: {exc}")

    # 7b — Insert pci_segments rows.
    if segments_out:
        pci_rows = [
            {
                "survey_id": survey_id,
                "segment_index": s["segment_index"],
                "start_distance_m": s["start_m"],
                "end_distance_m": s["end_m"],
                "total_length_m": max(0.0, s["end_m"] - s["start_m"]),
                "pci_score": s["pci_score"],
                "pci_grade": s["pci_grade"],
                "is_relative": s["is_relative"],
                "detection_count": s["detection_count"],
            }
            for s in segments_out
        ]
        try:
            supabase_client.table("pci_segments").insert(pci_rows).execute()
        except Exception as exc:
            _log(logger, f"{prefix} ERROR — could not insert pci_segments: {exc}")

    # 7c — Update survey record.
    try:
        supabase_client.table("surveys").update({
            "average_pci": survey_summary["weighted_pci"],
            "total_length_m": survey_summary["total_length_m"],
        }).eq("id", survey_id).execute()
    except Exception as exc:
        _log(logger, f"{prefix} ERROR — could not update survey {survey_id}: {exc}")

    _log(
        logger,
        f"{prefix} Done. videos_processed={len(sorted_entries)}, "
        f"total_frames={total_frames_processed}, skipped_frames={total_frames_skipped}, "
        f"average_pci={survey_summary['weighted_pci']}, total_length_m={survey_summary['total_length_m']}.",
    )

    # ------------------------------------------------------------------
    # Step 8 — Return result dict.
    # ------------------------------------------------------------------
    return {
        "status": "complete",
        "survey_id": survey_id,
        "videos_processed": len(sorted_entries),
        "total_frames": total_frames_processed,
        "skipped_frames": total_frames_skipped,
        "average_pci": survey_summary["weighted_pci"],
        "total_length_m": survey_summary["total_length_m"],
        "segments": segments_out,
        "survey_summary": {
            "weighted_pci": survey_summary["weighted_pci"],
            "total_length_m": survey_summary["total_length_m"],
            "segment_count": survey_summary["segment_count"],
            "rpci_segment_count": survey_summary["rpci_segment_count"],
        },
        "skipped_videos": skipped_videos,
    }
