# Drisora Backend — Pavement Condition Intelligence Pipeline
# Copyright (C) 2026 Sreekar Aditya Reddy
# Licensed under AGPL-3.0 — see LICENSE for details
# https://github.com/SreekarAditya/drisora-backend

import hashlib
import json
import math
import os
import platform
import random
import shutil
import subprocess
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import boto3
import httpx
import runpod
from dotenv import load_dotenv
from PIL import Image

from jobs.dispatcher import dispatch_job
from pipeline import pci_scorer, sam2_inference, yolo_inference
from pipeline.spatial_dedup import DEFAULT_OVERLAP_THRESHOLD
from utils.gsd_calibration import calibration_from_options
from utils.pci_segmentation import build_pci_sections

load_dotenv()

_yolo: Any = None
_sam2: Any = None


def _configure_determinism() -> None:
    seed = int(os.environ.get("DRISORA_DETERMINISTIC_SEED", "1337"))
    os.environ.setdefault("PYTHONHASHSEED", str(seed))
    os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")
    random.seed(seed)
    try:
        import numpy as np

        np.random.seed(seed)
    except Exception:
        pass
    try:
        import torch

        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.benchmark = False
        torch.backends.cudnn.deterministic = True
        try:
            torch.use_deterministic_algorithms(True, warn_only=True)
        except TypeError:
            torch.use_deterministic_algorithms(True)
    except Exception as exc:
        print(f"[DETERMINISM] torch setup skipped: {exc}", flush=True)


_configure_determinism()


def get_yolo() -> Any:
    global _yolo
    if _yolo is None:
        _yolo = yolo_inference.load_model()
    return _yolo


def get_sam2() -> Any:
    global _sam2
    if _sam2 is None:
        _sam2 = sam2_inference.load_model()
    return _sam2


def _warm_model(name: str, loader: Any, ready_message: str) -> None:
    started = time.perf_counter()
    try:
        loader()
        print(ready_message, flush=True)
    except Exception as exc:
        print(f"[WARMUP] {name} failed: {exc}", flush=True)
        raise
    finally:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        print(f"[WARMUP] {name} elapsed_ms={elapsed_ms}", flush=True)


def _option_enabled(options: dict[str, Any], name: str, default: bool = False) -> bool:
    value = options.get(name)
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return default


def _yolo_batch_size(options: dict[str, Any]) -> int:
    raw_value = options.get("yolo_batch_size", os.environ.get("DRISORA_YOLO_BATCH_SIZE", "64"))
    try:
        return max(1, min(256, int(raw_value)))
    except (TypeError, ValueError):
        return 64


def _elapsed_ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)


def _add_ms(timings: dict[str, int], key: str, started: float) -> int:
    elapsed = _elapsed_ms(started)
    timings[key] = timings.get(key, 0) + elapsed
    return elapsed


def _warm_pipeline_models() -> dict[str, int]:
    started = time.perf_counter()
    timings: dict[str, int] = {}
    print("[WARMUP] Starting model warmup...", flush=True)
    stage_started = time.perf_counter()
    _warm_model("YOLO", get_yolo, "[WARMUP] YOLO ready")
    timings["yolo_warmup_ms"] = _elapsed_ms(stage_started)
    stage_started = time.perf_counter()
    _warm_model("SAM2", get_sam2, "[WARMUP] SAM2 ready")
    timings["sam2_warmup_ms"] = _elapsed_ms(stage_started)
    timings["total_warmup_ms"] = _elapsed_ms(started)
    print("[WARMUP] Measured-parameter models ready — starting frame loop", flush=True)
    return timings


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _env_any(*names: str) -> str:
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    raise RuntimeError(f"Missing required environment variable: {' or '.join(names)}")


def _object_storage_endpoint_url() -> str:
    endpoint_url = os.environ.get("OBJECT_STORAGE_ENDPOINT_URL")
    if endpoint_url:
        return endpoint_url
    account_id = _env("CLOUDFLARE_R2_ACCOUNT_ID")
    return f"https://{account_id}.r2.cloudflarestorage.com"


def _redis_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _job_key(job_id: str) -> str:
    return f"job:{job_id}"


def _decode_upstash_result(response: httpx.Response) -> Any:
    response.raise_for_status()
    data = response.json()
    result = data.get("result")
    if isinstance(result, str):
        try:
            return json.loads(result)
        except json.JSONDecodeError:
            return result
    return result


def _load_job(redis_url: str, redis_token: str, job_id: str) -> dict[str, Any]:
    with httpx.Client(timeout=15) as client:
        response = client.get(
            f"{redis_url.rstrip('/')}/get/{_job_key(job_id)}",
            headers=_redis_headers(redis_token),
        )
    result = _decode_upstash_result(response)
    return result if isinstance(result, dict) else {"job_id": job_id}


def _save_job(redis_url: str, redis_token: str, job_id: str, record: dict[str, Any]) -> None:
    with httpx.Client(timeout=15) as client:
        response = client.post(
            f"{redis_url.rstrip('/')}/set/{_job_key(job_id)}",
            headers=_redis_headers(redis_token),
            content=json.dumps(record),
        )
    response.raise_for_status()


def _update_job(redis_url: str, redis_token: str, job_id: str, **fields: Any) -> dict[str, Any]:
    record = _load_job(redis_url, redis_token, job_id)
    record.update(fields)
    record["last_updated"] = _now()
    _save_job(redis_url, redis_token, job_id, record)
    return record


def _create_object_storage_client() -> Any:
    return boto3.client(
        "s3",
        endpoint_url=_object_storage_endpoint_url(),
        aws_access_key_id=_env_any("OBJECT_STORAGE_ACCESS_KEY_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID"),
        aws_secret_access_key=_env_any("OBJECT_STORAGE_SECRET_ACCESS_KEY", "CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
        region_name="auto",
    )


def _safe_file_name(file_name: str) -> str:
    if "/" in file_name or "\\" in file_name or ".." in file_name:
        raise ValueError(f"Unsafe upload filename: {file_name!r}")
    safe_name = Path(file_name).name
    if safe_name in {"", ".", ".."} or safe_name != file_name:
        raise ValueError(f"Unsafe upload filename: {file_name!r}")
    return safe_name


def _download_raw_files(
    object_storage_client: Any,
    bucket: str,
    storage_prefix: str,
    file_names: list[str],
    raw_dir: Path,
) -> list[Path]:
    raw_dir.mkdir(parents=True, exist_ok=True)
    local_files: list[Path] = []
    for file_name in file_names:
        safe_name = _safe_file_name(file_name)
        local_path = raw_dir / safe_name
        local_path.parent.mkdir(parents=True, exist_ok=True)
        object_storage_client.download_file(bucket, f"{storage_prefix.rstrip('/')}/{safe_name}", str(local_path))
        local_files.append(local_path)
    return local_files


def _uploaded_file_by_original_name(
    local_files: list[Path],
    options: dict[str, Any],
    original_name: str,
) -> Path | None:
    original_file_names = options.get("original_file_names")
    if not isinstance(original_file_names, list):
        return None

    for index, candidate in enumerate(original_file_names):
        if candidate == original_name and index < len(local_files):
            return local_files[index]
    return None


def _find_video_file(local_files: list[Path]) -> Path | None:
    return next((path for path in local_files if path.suffix.lower() != ".srt"), None)


def _find_srt_file(local_files: list[Path], options: dict[str, Any]) -> Path | None:
    srt_storage_name = options.get("srt_storage_name")
    if isinstance(srt_storage_name, str) and srt_storage_name:
        storage_match = next((path for path in local_files if path.name == srt_storage_name), None)
        if storage_match:
            return storage_match

    srt_name = options.get("srt_name")
    if isinstance(srt_name, str) and srt_name:
        direct_match = next((path for path in local_files if path.name == srt_name), None)
        if direct_match:
            return direct_match

        original_match = _uploaded_file_by_original_name(local_files, options, srt_name)
        if original_match and original_match.suffix.lower() == ".srt":
            return original_match

    return next((path for path in local_files if path.suffix.lower() == ".srt"), None)


def _build_dispatch_files(
    mode: str,
    local_files: list[Path],
    options: dict[str, Any],
) -> dict[str, Any]:
    interval_value = options.get("frame_interval_seconds")
    raw_extraction_mode = options.get("frame_extraction_mode")
    if isinstance(raw_extraction_mode, str) and raw_extraction_mode.strip():
        extraction_mode = raw_extraction_mode.strip().lower()
    elif interval_value is None:
        extraction_mode = "all_frames"
    else:
        extraction_mode = "interval"
    if extraction_mode not in {"interval", "all_frames"}:
        raise ValueError("frame_extraction_mode must be 'interval' or 'all_frames'")

    files: dict[str, Any] = {
        "frame_extraction_mode": extraction_mode,
        "frame_interval_seconds": None
        if extraction_mode == "all_frames"
        else interval_value if interval_value is not None else 1,
    }
    if mode == "image_batch":
        files["images"] = [str(path) for path in local_files]
    elif mode == "handheld_video":
        video_path = _find_video_file(local_files)
        if not video_path:
            raise ValueError("handheld_video requires a video file")
        files["video"] = str(video_path)
        srt_path = _find_srt_file(local_files, options)
        if srt_path:
            files["srt"] = str(srt_path)
    elif mode == "drone_footage":
        multi_videos = _build_multi_video_files(local_files, options)
        if multi_videos:
            files["videos"] = multi_videos
        else:
            video_path = _find_video_file(local_files)
            if not video_path:
                raise ValueError("drone_footage requires a video file")
            files["video"] = str(video_path)
            srt_path = _find_srt_file(local_files, options)
            if srt_path:
                files["srt"] = str(srt_path)
    else:
        raise ValueError(f"Unknown job mode: {mode!r}")
    return files


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _file_manifest(paths: list[Path]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for path in paths:
        out.append(
            {
                "name": path.name,
                "size_bytes": path.stat().st_size if path.exists() else None,
                "sha256": _sha256_file(path) if path.exists() else None,
            }
        )
    return out


def _model_file(path: Path) -> dict[str, Any]:
    return {
        "path": str(path),
        "exists": path.exists(),
        "size_bytes": path.stat().st_size if path.exists() else None,
        "sha256": _sha256_file(path) if path.exists() else None,
    }


def _package_version(name: str) -> str | None:
    try:
        from importlib.metadata import version

        return version(name)
    except Exception:
        return None


def _command_output(command: list[str]) -> str | None:
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=False, timeout=5)
    except Exception:
        return None
    output = (result.stdout or result.stderr or "").strip()
    return output.splitlines()[0] if output else None


def _runtime_manifest() -> dict[str, Any]:
    return {
        "build_sha": os.environ.get("DRISORA_BUILD_SHA", "unknown"),
        "python": platform.python_version(),
        "platform": platform.platform(),
        "ffmpeg": _command_output(["ffmpeg", "-version"]),
        "ffprobe": _command_output(["ffprobe", "-version"]),
        "packages": {
            "torch": _package_version("torch"),
            "ultralytics": _package_version("ultralytics"),
            "opencv-python": _package_version("opencv-python"),
            "runpod": _package_version("runpod"),
        },
        "deterministic_seed": int(os.environ.get("DRISORA_DETERMINISTIC_SEED", "1337")),
        "deterministic_extractor": os.environ.get("DRISORA_DETERMINISTIC_EXTRACTOR", "1"),
    }


def _model_manifest() -> dict[str, Any]:
    return {
        "yolo": {
            "confidence": getattr(yolo_inference, "CONFIDENCE", None),
            "iou": getattr(yolo_inference, "IOU", None),
            "weights": _model_file(getattr(yolo_inference, "WEIGHTS_PATH")),
        },
        "sam2": {
            "model_path": _model_file(getattr(sam2_inference, "MODEL_PATH")),
            "model_cfg": getattr(sam2_inference, "MODEL_CFG", None),
        },
        "pci": {
            "version": getattr(pci_scorer, "SCORING_VERSION", "legacy"),
            "standard": getattr(pci_scorer, "IRC_EDITION", None),
            "measured_parameters": list(getattr(pci_scorer, "MEASURED_PARAMETERS", ())),
        },
    }


def _frame_manifest(frames: list[dict[str, Any]]) -> list[dict[str, Any]]:
    hash_frames = os.environ.get("DRISORA_HASH_FRAME_MANIFEST", "1").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    out: list[dict[str, Any]] = []
    for frame in frames:
        path = Path(frame["path"])
        out.append(
            {
                "index": frame.get("index"),
                "timestamp_ms": frame.get("timestamp_ms"),
                "filename": path.name,
                "size_bytes": path.stat().st_size if path.exists() else None,
                "sha256": _sha256_file(path) if hash_frames and path.exists() else None,
                "lat": frame.get("lat"),
                "lon": frame.get("lon"),
                "alt_m": frame.get("alt_m", frame.get("alt")),
                "relative_altitude_m": frame.get("relative_altitude_m"),
                "absolute_altitude_m": frame.get("absolute_altitude_m"),
                "altitude_source": frame.get("altitude_source"),
                "gimbal_yaw": frame.get("gimbal_yaw"),
                "gimbal_pitch": frame.get("gimbal_pitch"),
                "gimbal_roll": frame.get("gimbal_roll"),
            }
        )
    return out


def _upload_json(
    object_storage_client: Any,
    bucket: str,
    key: str,
    payload: dict[str, Any] | list[Any],
) -> None:
    object_storage_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(payload, sort_keys=True, default=str).encode("utf-8"),
        ContentType="application/json",
    )


def _storage_name_map(local_files: list[Path]) -> dict[str, Path]:
    return {path.name: path for path in local_files}


def _path_from_storage_name(
    local_files: list[Path],
    storage_by_name: dict[str, Path],
    options: dict[str, Any],
    original_name: str | None,
    storage_name: str | None,
    *,
    expect_srt: bool,
) -> Path | None:
    if isinstance(storage_name, str) and storage_name:
        storage_match = storage_by_name.get(storage_name)
        if storage_match:
            return storage_match

    if isinstance(original_name, str) and original_name:
        original_match = _uploaded_file_by_original_name(local_files, options, original_name)
        if original_match:
            if not expect_srt or original_match.suffix.lower() == ".srt":
                return original_match

    return None


def _build_multi_video_files(
    local_files: list[Path],
    options: dict[str, Any],
) -> list[dict[str, str]] | None:
    if not _option_enabled(options, "is_multi_video"):
        return None

    video_names = options.get("video_filenames")
    if not isinstance(video_names, list) or len(video_names) == 0:
        return None

    video_storage = options.get("video_storage_filenames")
    if not isinstance(video_storage, list):
        video_storage = [None] * len(video_names)

    srt_names = options.get("srt_filenames")
    if not isinstance(srt_names, list):
        srt_names = [None] * len(video_names)

    srt_storage = options.get("srt_storage_filenames")
    if not isinstance(srt_storage, list):
        srt_storage = [None] * len(video_names)

    storage_by_name = _storage_name_map(local_files)
    video_entries: list[dict[str, str]] = []

    for index, video_name in enumerate(video_names):
        if not isinstance(video_name, str) or not video_name:
            continue

        video_path = _path_from_storage_name(
            local_files,
            storage_by_name,
            options,
            video_name,
            video_storage[index] if index < len(video_storage) else None,
            expect_srt=False,
        )
        if not video_path:
            raise ValueError(f"Missing uploaded video for multi-video survey: {video_name}")

        entry: dict[str, str] = {"video": str(video_path)}
        srt_path = _path_from_storage_name(
            local_files,
            storage_by_name,
            options,
            srt_names[index] if index < len(srt_names) else None,
            srt_storage[index] if index < len(srt_storage) else None,
            expect_srt=True,
        )
        if srt_path:
            entry["srt"] = str(srt_path)

        video_entries.append(entry)

    return video_entries


def _frame_dimensions(image_path: Path) -> tuple[int, int]:
    try:
        with Image.open(image_path) as image:
            width, height = image.size
    except Exception as exc:
        raise RuntimeError(f"frame is unreadable: {image_path.name}: {exc}") from exc
    if width <= 0 or height <= 0:
        raise RuntimeError(f"frame has invalid dimensions: {image_path.name}")
    return width, height


def _partial_pci_config(mode: str, options: dict[str, Any]) -> dict[str, Any] | None:
    if mode != "drone_footage":
        return None
    extraction_mode = options.get("frame_extraction_mode")
    frame_interval = options.get("frame_interval_seconds")
    if extraction_mode not in (None, "all_frames") or frame_interval is not None:
        raise ValueError("partial PCI section assessment requires all-frame extraction")
    road_class = options.get("road_class")
    if not isinstance(road_class, str) or not road_class.strip():
        raise ValueError("road_class is required for drone partial PCI assessment")
    surface_type = options.get("surface_type")
    if surface_type is not None and not isinstance(surface_type, str):
        raise ValueError("surface_type must be a string when provided")
    pci_scorer.equation_set(road_class, surface_type)
    try:
        carriageway_width_m = float(options.get("carriageway_width_m"))
    except (TypeError, ValueError) as exc:
        raise ValueError("carriageway_width_m is required") from exc
    if not math.isfinite(carriageway_width_m) or carriageway_width_m <= 0.0:
        raise ValueError("carriageway_width_m must be greater than zero")
    camera_calibration = calibration_from_options(options)
    try:
        overlap_threshold = float(options.get("dedup_overlap_threshold", DEFAULT_OVERLAP_THRESHOLD))
    except (TypeError, ValueError) as exc:
        raise ValueError("dedup_overlap_threshold must be numeric") from exc
    if not 0.0 < overlap_threshold <= 1.0:
        raise ValueError("dedup_overlap_threshold must be in (0, 1]")
    return {
        "road_class": road_class.upper(),
        "surface_type": surface_type.upper() if isinstance(surface_type, str) else None,
        "carriageway_width_m": carriageway_width_m,
        "camera_calibration": camera_calibration,
        "overlap_threshold": overlap_threshold,
    }


def _chunked(items: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [items[index:index + size] for index in range(0, len(items), size)]


def _detections_by_frame_index(detections: list[dict[str, Any]]) -> dict[Any, list[dict[str, Any]]]:
    grouped: dict[Any, list[dict[str, Any]]] = {}
    for detection in detections:
        grouped.setdefault(detection.get("frame_index"), []).append(detection)
    return grouped


def _process_frame(
    frame: dict[str, Any],
    yolo_detections: list[dict[str, Any]] | None = None,
    yolo_elapsed_ms: int | None = None,
) -> dict[str, Any]:
    started = time.perf_counter()
    stage_timings: dict[str, int] = {
        "yolo_ms": 0,
        "sam2_ms": 0,
        "frame_dimensions_ms": 0,
    }
    frame_path = Path(frame["path"])
    if yolo_detections is None:
        stage_started = time.perf_counter()
        detections = yolo_inference.run(str(frame_path))
        stage_timings["yolo_ms"] = _elapsed_ms(stage_started)
    else:
        detections = [dict(detection) for detection in yolo_detections]
        stage_timings["yolo_ms"] = int(yolo_elapsed_ms or 0)
    yolo_count = len(detections)

    sam2_attempted = bool(detections)
    if sam2_attempted:
        stage_started = time.perf_counter()
        detections = sam2_inference.run(str(frame_path), detections)
        stage_timings["sam2_ms"] = _elapsed_ms(stage_started)

    stage_started = time.perf_counter()
    image_width_px, image_height_px = _frame_dimensions(frame_path)
    stage_timings["frame_dimensions_ms"] = _elapsed_ms(stage_started)
    analysis_stage = "yolo_sam2" if detections else "yolo_no_distress_found"
    final_count = len(detections)
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    print(
        "[FRAME_RESULT] "
        f"index={frame.get('index')} detector_status=success segmentation_status=success "
        f"yolo={yolo_count} final={final_count} "
        f"sam2_attempted={sam2_attempted} analysis_stage={analysis_stage} "
        f"stage_timings={json.dumps(stage_timings, sort_keys=True)} elapsed_ms={elapsed_ms}",
        flush=True,
    )

    return {
        "index": frame.get("index"),
        "timestamp_ms": frame.get("timestamp_ms"),
        "crack_types": sorted(
            {
                str(detection.get("class"))
                for detection in detections
                if detection.get("class") is not None
            }
        ),
        "lat": frame.get("lat"),
        "lon": frame.get("lon"),
        "alt_m": frame.get("alt_m", frame.get("alt")),
        "relative_altitude_m": frame.get("relative_altitude_m"),
        "absolute_altitude_m": frame.get("absolute_altitude_m"),
        "altitude_source": frame.get("altitude_source"),
        "gimbal_yaw": frame.get("gimbal_yaw"),
        "gimbal_pitch": frame.get("gimbal_pitch"),
        "gimbal_roll": frame.get("gimbal_roll"),
        "image_width_px": image_width_px,
        "image_height_px": image_height_px,
        "detections": detections,
        "detector_status": "success",
        "segmentation_status": "success",
        "depth_available": False,
        "depth_attempted": False,
        "depth_skipped_reason": "relative_depth_not_used_for_physical_pci_measurement",
        "analysis_stage": analysis_stage,
        "degraded_reasons": [],
        "sam2_attempted": sam2_attempted,
        "yolo_detection_count": yolo_count,
        "final_detection_count": final_count,
        "processing_ms": elapsed_ms,
        "stage_timings_ms": stage_timings,
    }


def _upload_file(object_storage_client: Any, bucket: str, local_path: Path, key: str) -> None:
    object_storage_client.upload_file(str(local_path), bucket, key)


def _post_webhook(
    app_url: str,
    webhook_secret: str,
    payload: dict[str, Any],
) -> tuple[bool, str | None]:
    try:
        with httpx.Client(timeout=20) as client:
            response = client.post(
                f"{app_url.rstrip('/')}/api/webhooks/job-complete",
                json=payload,
                headers={"X-Webhook-Secret": webhook_secret},
            )
    except httpx.HTTPError as exc:
        message = str(exc)
        print(f"[WEBHOOK_ERROR] request failed: {message}", flush=True)
        return False, message

    if response.status_code >= 400:
        detail = response.text[:500]
        message = f"Webhook returned {response.status_code}: {detail}"
        print(f"[WEBHOOK_ERROR] {message}", flush=True)
        return False, message

    return True, None


def handler(job: dict[str, Any]) -> dict[str, Any]:
    job_input = job.get("input") or {}
    job_id = job_input["job_id"]
    user_id = job_input["user_id"]
    mode = job_input["mode"]
    storage_prefix = job_input.get("storage_prefix") or job_input.get("r2_prefix")
    if not isinstance(storage_prefix, str) or not storage_prefix:
        raise ValueError("Job input must include storage_prefix or r2_prefix")
    file_names = job_input["file_names"]
    options = job_input.get("options") or {}

    redis_url = _env("UPSTASH_REDIS_REST_URL")
    redis_token = _env("UPSTASH_REDIS_REST_TOKEN")
    bucket = _env_any("OBJECT_STORAGE_BUCKET", "CLOUDFLARE_R2_BUCKET_NAME")
    app_url = _env_any("APP_CALLBACK_URL", "NEXT_PUBLIC_APP_URL")
    webhook_secret = _env_any(
        "WORKER_WEBHOOK_SECRET",
        "CLOUDFLARE_R2_WEBHOOK_SECRET",
        "RUNPOD_CALLBACK_SECRET",
    )

    work_dir = Path("/tmp") / job_id
    raw_dir = work_dir / "raw"
    result_dir = work_dir / "results"
    detection_dir = result_dir / "detections"
    output_storage_prefix = f"results/{user_id}/{job_id}/"
    job_started = time.perf_counter()
    timing_breakdown_ms: dict[str, int] = {}

    try:
        stage_started = time.perf_counter()
        _update_job(redis_url, redis_token, job_id, status="extracting_frames")
        _add_ms(timing_breakdown_ms, "redis_initial_update_ms", stage_started)
        stage_started = time.perf_counter()
        object_storage_client = _create_object_storage_client()
        _add_ms(timing_breakdown_ms, "object_storage_client_init_ms", stage_started)
        stage_started = time.perf_counter()
        local_files = _download_raw_files(object_storage_client, bucket, storage_prefix, file_names, raw_dir)
        _add_ms(timing_breakdown_ms, "raw_download_ms", stage_started)
        raw_file_manifest = _file_manifest(local_files)

        pci_config = _partial_pci_config(mode, options)
        yolo_batch_size = _yolo_batch_size(options)
        print(
            f"[PIPELINE] mode={mode} yolo_batch_size={yolo_batch_size} "
            f"partial_pci_enabled={pci_config is not None} "
            f"options={json.dumps(options, sort_keys=True)}",
            flush=True,
        )

        stage_started = time.perf_counter()
        frame_batch = dispatch_job(job_id, mode, _build_dispatch_files(mode, local_files, options))
        _add_ms(timing_breakdown_ms, "frame_extraction_ms", stage_started)
        frames = frame_batch["frames"]
        processing_started = time.perf_counter()
        warmup_timings = _warm_pipeline_models()
        timing_breakdown_ms.update(warmup_timings)
        runtime_manifest = _runtime_manifest()
        model_manifest = _model_manifest()
        manifest_prefix = f"{output_storage_prefix}manifests/"
        stage_started = time.perf_counter()
        _upload_json(
            object_storage_client,
            bucket,
            f"{manifest_prefix}run_manifest.json",
            {
                "job_id": job_id,
                "user_id": user_id,
                "mode": mode,
                "created_at": _now(),
                "options": options,
                "input_storage_prefix": storage_prefix,
                "input_r2_prefix": storage_prefix,
                "output_storage_prefix": output_storage_prefix,
                "output_r2_prefix": output_storage_prefix,
                "raw_files": raw_file_manifest,
                "ingest": frame_batch.get("ingest_metadata", {}),
                "frame_count": len(frames),
                "runtime": runtime_manifest,
                "models": model_manifest,
                "partial_pci_config": pci_config,
                "performance": {
                    "yolo_batch_size": yolo_batch_size,
                    "progress_update_target": 100,
                },
            },
        )
        _add_ms(timing_breakdown_ms, "run_manifest_upload_ms", stage_started)
        stage_started = time.perf_counter()
        _upload_json(
            object_storage_client,
            bucket,
            f"{manifest_prefix}frame_manifest.json",
            {
                "job_id": job_id,
                "frame_count": len(frames),
                "frames": _frame_manifest(frames),
            },
        )
        _add_ms(timing_breakdown_ms, "frame_manifest_upload_ms", stage_started)
        stage_started = time.perf_counter()
        _update_job(
            redis_url,
            redis_token,
            job_id,
            status="detecting",
            frame_count=len(frames),
            processed_count=0,
            output_storage_prefix=output_storage_prefix,
            output_r2_prefix=output_storage_prefix,
        )
        _add_ms(timing_breakdown_ms, "redis_detecting_update_ms", stage_started)
        frame_results: list[dict[str, Any]] = []
        processed = 0
        total = len(frames)
        total_detections = 0
        total_processing_ms = 0
        pipeline_stage_counts: dict[str, int] = {}
        degraded_reason_counts: dict[str, int] = {}
        degraded_frame_count = 0
        frame_stage_totals_ms: dict[str, int] = {
            "yolo_ms": 0,
            "sam2_ms": 0,
            "frame_dimensions_ms": 0,
            "frame_upload_ms": 0,
            "detection_json_write_ms": 0,
            "detection_upload_ms": 0,
            "redis_progress_update_ms": 0,
        }
        progress_update_every = max(1, math.ceil(total / 100)) if total > 0 else 1
        processed_count = 0
        for batch_index, frame_chunk in enumerate(_chunked(frames, yolo_batch_size), start=1):
            batch_start = processed_count + 1
            batch_end = processed_count + len(frame_chunk)
            print(
                f"[YOLO_BATCH {batch_index}] frames={batch_start}-{batch_end}/{total} "
                f"batch_size={len(frame_chunk)}",
                flush=True,
            )
            stage_started = time.perf_counter()
            yolo_detections = yolo_inference.run(frame_chunk, batch_size=yolo_batch_size)
            yolo_batch_elapsed_ms = _elapsed_ms(stage_started)
            yolo_share_ms = int(yolo_batch_elapsed_ms / max(1, len(frame_chunk)))
            detections_by_index = _detections_by_frame_index(yolo_detections)
            print(
                f"[YOLO_BATCH_RESULT {batch_index}] detections={len(yolo_detections)} "
                f"elapsed_ms={yolo_batch_elapsed_ms}",
                flush=True,
            )

            for frame in frame_chunk:
                processed_count += 1
                print(f"[FRAME {processed_count}/{total}] processing", flush=True)
                frame_path = Path(frame["path"])
                frame_result = _process_frame(
                    frame,
                    yolo_detections=detections_by_index.get(frame.get("index"), []),
                    yolo_elapsed_ms=yolo_share_ms,
                )
                processed = processed_count
                total_detections += len(frame_result.get("detections") or [])
                frame_results.append(frame_result)
                total_processing_ms += int(frame_result.get("processing_ms") or 0)
                for key, value in (frame_result.get("stage_timings_ms") or {}).items():
                    if isinstance(value, int):
                        frame_stage_totals_ms[key] = frame_stage_totals_ms.get(key, 0) + value

                analysis_stage = str(frame_result.get("analysis_stage") or "unknown")
                pipeline_stage_counts[analysis_stage] = pipeline_stage_counts.get(analysis_stage, 0) + 1
                frame_degraded_reasons = frame_result.get("degraded_reasons") or []
                if frame_degraded_reasons:
                    degraded_frame_count += 1
                for reason in frame_degraded_reasons:
                    reason_key = str(reason)
                    degraded_reason_counts[reason_key] = degraded_reason_counts.get(reason_key, 0) + 1

                stage_started = time.perf_counter()
                artifact_stem = f"frame_{int(frame_result['index']):09d}"
                artifact_frame_name = f"{artifact_stem}{frame_path.suffix.lower()}"
                _upload_file(
                    object_storage_client,
                    bucket,
                    frame_path,
                    f"{output_storage_prefix}frames/{artifact_frame_name}",
                )
                _add_ms(frame_stage_totals_ms, "frame_upload_ms", stage_started)

                stage_started = time.perf_counter()
                detection_path = detection_dir / f"{artifact_stem}.json"
                detection_path.parent.mkdir(parents=True, exist_ok=True)
                detection_path.write_text(json.dumps(frame_result))
                _add_ms(frame_stage_totals_ms, "detection_json_write_ms", stage_started)

                stage_started = time.perf_counter()
                _upload_file(
                    object_storage_client,
                    bucket,
                    detection_path,
                    f"{output_storage_prefix}detections/{artifact_stem}.json",
                )
                _add_ms(frame_stage_totals_ms, "detection_upload_ms", stage_started)
                if processed_count == total or processed_count % progress_update_every == 0:
                    stage_started = time.perf_counter()
                    _update_job(
                        redis_url,
                        redis_token,
                        job_id,
                        processed_count=processed_count,
                    )
                    _add_ms(frame_stage_totals_ms, "redis_progress_update_ms", stage_started)

        if pci_config is not None:
            provenance = {
                "models": model_manifest,
                "seed": runtime_manifest["deterministic_seed"],
                "code_commit": runtime_manifest["build_sha"],
            }
            sections, partial_pci_summary, chainage_frames = build_pci_sections(
                frame_results,
                road_class=pci_config["road_class"],
                surface_type=pci_config["surface_type"],
                carriageway_width_m=pci_config["carriageway_width_m"],
                camera_calibration=pci_config["camera_calibration"],
                provenance=provenance,
                overlap_threshold=pci_config["overlap_threshold"],
            )
            partial_pci_key = f"{output_storage_prefix}partial_pci_sections.json"
            _upload_json(
                object_storage_client,
                bucket,
                partial_pci_key,
                {
                    "job_id": job_id,
                    "summary": partial_pci_summary,
                    "sections": sections,
                    "chainage_frames": [
                        {
                            "frame_index": frame["frame_index"],
                            "section_id": frame["section_id"],
                            "cumulative_distance_m": frame["cumulative_distance_m"],
                            "lat": frame["lat"],
                            "lon": frame["lon"],
                        }
                        for frame in chainage_frames
                    ],
                },
            )
        else:
            sections = []
            partial_pci_key = None
            partial_pci_summary = {
                "assessment_scope": "detection_only",
                "pci_complete": None,
                "pci_bounds": None,
                "measured_weight_fraction": 0.0,
                "unmeasured_weight_fraction": 1.0,
                "reason": "100 m GPS-chainage PCI assessment is available only for configured drone surveys",
                "segment_count": 0,
            }
        end_to_end_processing_ms = int((time.perf_counter() - processing_started) * 1000)
        total_job_elapsed_ms = _elapsed_ms(job_started)
        timing_breakdown_ms["frame_loop_wall_ms"] = end_to_end_processing_ms
        timing_breakdown_ms["total_job_elapsed_ms"] = total_job_elapsed_ms
        frames_per_minute = (
            processed / (end_to_end_processing_ms / 60000)
            if end_to_end_processing_ms > 0 and processed > 0
            else 0.0
        )
        per_frame_average_ms = {
            key: (value / processed if processed > 0 else 0.0)
            for key, value in frame_stage_totals_ms.items()
        }
        stage_total = sum(frame_stage_totals_ms.values())
        unattributed_frame_loop_ms = max(0, end_to_end_processing_ms - stage_total)
        _upload_json(
            object_storage_client,
            bucket,
            f"{manifest_prefix}processing_summary.json",
            {
                "job_id": job_id,
                "status": "complete",
                "processed_count": processed,
                "frame_count": total,
                "average_pci": None,
                "pci_complete": None,
                "pci_bounds": partial_pci_summary["pci_bounds"],
                "partial_pci_sections_key": partial_pci_key,
                "partial_pci": partial_pci_summary,
                "total_detections": total_detections,
                "total_processing_ms": total_processing_ms,
                "end_to_end_processing_ms": end_to_end_processing_ms,
                "frames_per_minute": frames_per_minute,
                "timing_breakdown_ms": timing_breakdown_ms,
                "frame_stage_totals_ms": frame_stage_totals_ms,
                "per_frame_average_ms": per_frame_average_ms,
                "unattributed_frame_loop_ms": unattributed_frame_loop_ms,
                "progress_update_every_frames": progress_update_every,
                "yolo_batch_size": yolo_batch_size,
                "pipeline_stage_counts": pipeline_stage_counts,
                "degraded_frame_count": degraded_frame_count,
                "degraded_reason_counts": degraded_reason_counts,
                "completed_at": _now(),
            },
        )
        _update_job(
            redis_url,
            redis_token,
            job_id,
            status="complete",
            average_pci=None,
            pci_complete=None,
            pci_bounds=partial_pci_summary["pci_bounds"],
            partial_pci=partial_pci_summary,
            partial_pci_sections_key=partial_pci_key,
            output_storage_prefix=output_storage_prefix,
            output_r2_prefix=output_storage_prefix,
        )
        print(
            f"[DONE] processed {processed} frames, sections={len(sections)}, "
            f"pci_bounds={partial_pci_summary['pci_bounds']}, detections={total_detections}",
            flush=True,
        )
        webhook_ok, webhook_error = _post_webhook(
            app_url,
            webhook_secret,
            {
                "job_id": job_id,
                "user_id": user_id,
                "status": "complete",
                "pci_complete": None,
                "pci_bounds": partial_pci_summary["pci_bounds"],
                "partial_pci_sections_key": partial_pci_key,
                "frame_count": len(frames),
                "processed_count": processed,
                "output_storage_prefix": output_storage_prefix,
                "output_r2_prefix": output_storage_prefix,
            },
        )
        if not webhook_ok:
            _update_job(
                redis_url,
                redis_token,
                job_id,
                webhook_error=webhook_error,
            )
        return {
            "job_id": job_id,
            "status": "complete",
            "pci_complete": None,
            "pci_bounds": partial_pci_summary["pci_bounds"],
        }
    except Exception as exc:
        error_message = str(exc)
        error_type = exc.__class__.__name__
        print(
            f"[JOB_ERROR] job_id={job_id} error_type={error_type} "
            f"message={error_message}\n{traceback.format_exc()}",
            flush=True,
        )
        _update_job(
            redis_url,
            redis_token,
            job_id,
            status="failed",
            error_message=error_message,
            error_type=error_type,
        )
        _post_webhook(
            app_url,
            webhook_secret,
            {
                "job_id": job_id,
                "user_id": user_id,
                "status": "failed",
                "error_message": error_message,
            },
        )
        raise
    finally:
        if work_dir.exists():
            shutil.rmtree(work_dir)


if __name__ == "__main__":
    print(f"[WORKER_BOOT] {json.dumps(_runtime_manifest(), sort_keys=True)}", flush=True)
    runpod.serverless.start({"handler": handler})
