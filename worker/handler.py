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
from pipeline import depthpro_inference, pci_scorer, sam2_inference, yolo_inference

load_dotenv()

_yolo: Any = None
_sam2: Any = None
_depth: Any = None


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


def get_depth() -> Any:
    global _depth
    if _depth is None:
        _depth = depthpro_inference.load_model()
    return _depth


def _warm_model(name: str, loader: Any, ready_message: str) -> None:
    started = time.perf_counter()
    try:
        loader()
        print(ready_message, flush=True)
    except Exception as exc:
        print(f"{name} model unavailable; using fallback path: {exc}", flush=True)
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


def _depth_enabled(mode: str, options: dict[str, Any]) -> bool:
    env_default = os.environ.get("DRISORA_ENABLE_DEPTHPRO_DEFAULT")
    if env_default is not None:
        default = env_default.strip().lower() in {"1", "true", "yes", "on"}
    else:
        default = False
    return _option_enabled(
        options,
        "enable_metric_analysis",
        _option_enabled(options, "enable_depthpro", default),
    )


def _sam2_warmup_enabled(options: dict[str, Any]) -> bool:
    env_default = os.environ.get("DRISORA_WARM_SAM2", "0").strip().lower() in {"1", "true", "yes", "on"}
    return _option_enabled(options, "warm_sam2", env_default)


def _yolo_batch_size(options: dict[str, Any]) -> int:
    raw_value = options.get("yolo_batch_size", os.environ.get("DRISORA_YOLO_BATCH_SIZE", "64"))
    try:
        return max(1, min(256, int(raw_value)))
    except (TypeError, ValueError):
        return 64


def _depthpro_batch_size(options: dict[str, Any], yolo_batch_size: int) -> int:
    raw_value = options.get(
        "depthpro_batch_size",
        os.environ.get("DRISORA_DEPTHPRO_BATCH_SIZE", str(min(16, yolo_batch_size))),
    )
    try:
        return max(1, min(64, int(raw_value)))
    except (TypeError, ValueError):
        return min(16, yolo_batch_size)


def _elapsed_ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)


def _add_ms(timings: dict[str, int], key: str, started: float) -> int:
    elapsed = _elapsed_ms(started)
    timings[key] = timings.get(key, 0) + elapsed
    return elapsed


def _warm_pipeline_models(use_depth: bool, warm_sam2: bool) -> dict[str, int | bool]:
    started = time.perf_counter()
    timings: dict[str, int | bool] = {
        "sam2_warmup_enabled": warm_sam2,
        "depthpro_enabled": use_depth,
    }
    print("[WARMUP] Starting model warmup...", flush=True)
    stage_started = time.perf_counter()
    _warm_model("YOLO", get_yolo, "[WARMUP] YOLO ready")
    timings["yolo_warmup_ms"] = _elapsed_ms(stage_started)
    if warm_sam2:
        stage_started = time.perf_counter()
        _warm_model("SAM2", get_sam2, "[WARMUP] SAM2 ready")
        timings["sam2_warmup_ms"] = _elapsed_ms(stage_started)
    else:
        timings["sam2_warmup_ms"] = 0
        print("[WARMUP] SAM2 warmup skipped (loads on first detection)", flush=True)
    if use_depth:
        stage_started = time.perf_counter()
        _warm_model("DepthPro", get_depth, "[WARMUP] DepthPro ready")
        timings["depthpro_warmup_ms"] = _elapsed_ms(stage_started)
    else:
        timings["depthpro_warmup_ms"] = 0
        print("[WARMUP] DepthPro skipped for this job", flush=True)
    timings["total_warmup_ms"] = _elapsed_ms(started)
    print("[WARMUP] All models ready — starting frame loop", flush=True)
    return timings


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


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


def _create_r2_client() -> Any:
    account_id = _env("CLOUDFLARE_R2_ACCOUNT_ID")
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=_env("CLOUDFLARE_R2_ACCESS_KEY_ID"),
        aws_secret_access_key=_env("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
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
    r2_client: Any,
    bucket: str,
    r2_prefix: str,
    file_names: list[str],
    raw_dir: Path,
) -> list[Path]:
    raw_dir.mkdir(parents=True, exist_ok=True)
    local_files: list[Path] = []
    for file_name in file_names:
        safe_name = _safe_file_name(file_name)
        local_path = raw_dir / safe_name
        local_path.parent.mkdir(parents=True, exist_ok=True)
        r2_client.download_file(bucket, f"{r2_prefix.rstrip('/')}/{safe_name}", str(local_path))
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
            if not srt_path:
                raise ValueError("drone_footage requires a paired .SRT GPS log")
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
            "opencv-python-headless": _package_version("opencv-python-headless"),
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
        "depthpro": {
            "model_path": _model_file(getattr(depthpro_inference, "MODEL_PATH")),
            "enabled_default": os.environ.get("DRISORA_ENABLE_DEPTHPRO_DEFAULT"),
        },
        "pci": {
            "version": getattr(pci_scorer, "SCORING_VERSION", "legacy"),
            "standard": getattr(pci_scorer, "IRC_STANDARD", None),
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
                "gimbal_yaw": frame.get("gimbal_yaw"),
            }
        )
    return out


def _upload_json(r2_client: Any, bucket: str, key: str, payload: dict[str, Any] | list[Any]) -> None:
    r2_client.put_object(
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
        if not srt_path:
            raise ValueError(f"Missing uploaded .SRT GPS log for multi-video survey: {video_name}")
        entry["srt"] = str(srt_path)

        video_entries.append(entry)

    return video_entries


def _frame_area_px(image_path: Path) -> int:
    try:
        with Image.open(image_path) as image:
            width, height = image.size
        return max(1, width * height)
    except Exception:
        return 1


def _fallback_pci(error_message: str) -> dict[str, Any]:
    return {
        "pci": 50.0,
        "condition": "Fair",
        "recommendation": "Minor Rehabilitation (structural evaluation)",
        "crack_extent_pct": 0.0,
        "pothole_count": 0,
        "rut_depth_mm": 0.0,
        "iri": 2.5,
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
        "irc_standard": "IRC:82-2023",
        "error_message": error_message,
    }


def _depth_estimate(depth_map: Any) -> float | None:
    if depth_map is None or getattr(depth_map, "size", 0) <= 0:
        return None
    try:
        value = float(depth_map.mean())
        return value if math.isfinite(value) else None
    except Exception:
        return None


def _metric_summary(detections: list[dict[str, Any]], depth_map: Any) -> dict[str, float | None]:
    distances = [
        float(d["camera_surface_distance_m"])
        for d in detections
        if d.get("camera_surface_distance_m") is not None
    ]
    widths = [
        float(d["crack_width_mm"])
        for d in detections
        if d.get("crack_width_mm") is not None
    ]
    camera_surface_distance_m = (
        sum(distances) / len(distances) if distances else _depth_estimate(depth_map)
    )
    return {
        "camera_surface_distance_m": camera_surface_distance_m,
        "avg_crack_width_mm": sum(widths) / len(widths) if widths else None,
        "max_crack_width_mm": max(widths) if widths else None,
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
    use_depth: bool,
    yolo_detections: list[dict[str, Any]] | None = None,
    yolo_elapsed_ms: int | None = None,
    precomputed_depth_map: Any | None = None,
    depth_elapsed_ms: int | None = None,
) -> dict[str, Any]:
    started = time.perf_counter()
    stage_timings: dict[str, int] = {
        "yolo_ms": 0,
        "sam2_ms": 0,
        "depthpro_ms": 0,
        "frame_area_ms": 0,
        "pci_ms": 0,
    }
    frame_path = Path(frame["path"])
    yolo_count = 0
    sam2_attempted = False
    depth_attempted = False
    depth_skipped_reason = None if use_depth else "disabled_for_mode"
    frame_failed = False
    degraded_reasons: list[str] = []
    try:
        if yolo_detections is None:
            stage_started = time.perf_counter()
            detections = yolo_inference.run(str(frame_path))
            stage_timings["yolo_ms"] = _elapsed_ms(stage_started)
        else:
            detections = [dict(detection) for detection in yolo_detections]
            stage_timings["yolo_ms"] = int(yolo_elapsed_ms or 0)
        yolo_count = len(detections)

        if detections:
            sam2_attempted = True
            stage_started = time.perf_counter()
            detections = sam2_inference.run(str(frame_path), detections)
            stage_timings["sam2_ms"] = _elapsed_ms(stage_started)

        if use_depth:
            depth_attempted = True
            if precomputed_depth_map is not None:
                depth_result = depthpro_inference.enrich_detections(precomputed_depth_map, detections)
                stage_timings["depthpro_ms"] = int(depth_elapsed_ms or 0)
            else:
                stage_started = time.perf_counter()
                depth_result = depthpro_inference.run(str(frame_path), detections)
                stage_timings["depthpro_ms"] = _elapsed_ms(stage_started)
            detections = depth_result.get("detections", detections)
            depth_map = depth_result.get("depth_map")
        else:
            depth_map = None

        stage_started = time.perf_counter()
        frame_area_px = _frame_area_px(frame_path)
        stage_timings["frame_area_ms"] = _elapsed_ms(stage_started)
        stage_started = time.perf_counter()
        pci_result = pci_scorer.score(
            detections,
            frame_area_px=frame_area_px,
            depth_map=depth_map,
        )
        stage_timings["pci_ms"] = _elapsed_ms(stage_started)
    except Exception as exc:
        frame_failed = True
        degraded_reasons.append("frame_exception")
        detections = []
        depth_map = None
        pci_result = _fallback_pci(str(exc))

    depth_available = depth_map is not None and getattr(depth_map, "size", 0) > 0
    if use_depth and depth_attempted and not depth_available:
        degraded_reasons.append("depthpro_unavailable")

    if frame_failed:
        analysis_stage = "fallback"
    elif depth_available and sam2_attempted:
        analysis_stage = "yolo_sam2_depthpro"
    elif sam2_attempted:
        analysis_stage = "yolo_sam2"
    else:
        analysis_stage = "yolo_only"

    metrics = _metric_summary(detections, depth_map) if depth_available else {
        "camera_surface_distance_m": None,
        "avg_crack_width_mm": None,
        "max_crack_width_mm": None,
    }
    final_count = len(detections)
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    print(
        "[FRAME_RESULT] "
        f"index={frame.get('index')} pci={pci_result['pci']} "
        f"yolo={yolo_count} final={final_count} "
        f"sam2_attempted={sam2_attempted} depth_attempted={depth_attempted} "
        f"depth_available={depth_available} analysis_stage={analysis_stage} "
        f"degraded_reasons={','.join(degraded_reasons) or 'none'} "
        f"stage_timings={json.dumps(stage_timings, sort_keys=True)} elapsed_ms={elapsed_ms}",
        flush=True,
    )

    return {
        "index": frame.get("index"),
        "timestamp_ms": frame.get("timestamp_ms"),
        "pci_score": pci_result["pci"],
        "condition": pci_result["condition"],
        "recommendation": pci_result["recommendation"],
        "crack_types": pci_result["crack_types"],
        "dominant_crack": pci_result["dominant_crack"],
        "lat": frame.get("lat"),
        "lon": frame.get("lon"),
        "alt_m": frame.get("alt_m", frame.get("alt")),
        "gimbal_yaw": frame.get("gimbal_yaw"),
        "detections": detections,
        "pci_details": pci_result,
        "depth_available": depth_available,
        "depth_estimate": _depth_estimate(depth_map),
        "camera_surface_distance_m": metrics["camera_surface_distance_m"],
        "avg_crack_width_mm": metrics["avg_crack_width_mm"],
        "max_crack_width_mm": metrics["max_crack_width_mm"],
        "depth_attempted": depth_attempted,
        "depth_skipped_reason": depth_skipped_reason,
        "analysis_stage": analysis_stage,
        "degraded_reasons": degraded_reasons,
        "sam2_attempted": sam2_attempted,
        "yolo_detection_count": yolo_count,
        "final_detection_count": final_count,
        "processing_ms": elapsed_ms,
        "stage_timings_ms": stage_timings,
    }


def _upload_file(r2_client: Any, bucket: str, local_path: Path, key: str) -> None:
    r2_client.upload_file(str(local_path), bucket, key)


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
    r2_prefix = job_input["r2_prefix"]
    file_names = job_input["file_names"]
    options = job_input.get("options") or {}

    redis_url = _env("UPSTASH_REDIS_REST_URL")
    redis_token = _env("UPSTASH_REDIS_REST_TOKEN")
    bucket = _env("CLOUDFLARE_R2_BUCKET_NAME")
    app_url = _env("NEXT_PUBLIC_APP_URL")
    webhook_secret = os.environ.get("WORKER_WEBHOOK_SECRET") or _env("CLOUDFLARE_R2_WEBHOOK_SECRET")

    work_dir = Path("/tmp") / job_id
    raw_dir = work_dir / "raw"
    result_dir = work_dir / "results"
    detection_dir = result_dir / "detections"
    output_r2_prefix = f"results/{user_id}/{job_id}/"
    job_started = time.perf_counter()
    timing_breakdown_ms: dict[str, int] = {}

    try:
        stage_started = time.perf_counter()
        _update_job(redis_url, redis_token, job_id, status="extracting_frames")
        _add_ms(timing_breakdown_ms, "redis_initial_update_ms", stage_started)
        stage_started = time.perf_counter()
        r2_client = _create_r2_client()
        _add_ms(timing_breakdown_ms, "r2_client_init_ms", stage_started)
        stage_started = time.perf_counter()
        local_files = _download_raw_files(r2_client, bucket, r2_prefix, file_names, raw_dir)
        _add_ms(timing_breakdown_ms, "raw_download_ms", stage_started)
        raw_file_manifest = _file_manifest(local_files)

        use_depth = _depth_enabled(mode, options)
        warm_sam2 = _sam2_warmup_enabled(options)
        yolo_batch_size = _yolo_batch_size(options)
        depthpro_batch_size = _depthpro_batch_size(options, yolo_batch_size)
        print(
            f"[PIPELINE] mode={mode} use_depth={use_depth} warm_sam2={warm_sam2} "
            f"yolo_batch_size={yolo_batch_size} depthpro_batch_size={depthpro_batch_size} "
            f"options={json.dumps(options, sort_keys=True)}",
            flush=True,
        )

        stage_started = time.perf_counter()
        frame_batch = dispatch_job(job_id, mode, _build_dispatch_files(mode, local_files, options))
        _add_ms(timing_breakdown_ms, "frame_extraction_ms", stage_started)
        frames = frame_batch["frames"]
        manifest_prefix = f"{output_r2_prefix}manifests/"
        stage_started = time.perf_counter()
        _upload_json(
            r2_client,
            bucket,
            f"{manifest_prefix}run_manifest.json",
            {
                "job_id": job_id,
                "user_id": user_id,
                "mode": mode,
                "created_at": _now(),
                "options": options,
                "input_r2_prefix": r2_prefix,
                "output_r2_prefix": output_r2_prefix,
                "raw_files": raw_file_manifest,
                "ingest": frame_batch.get("ingest_metadata", {}),
                "frame_count": len(frames),
                "runtime": _runtime_manifest(),
                "models": _model_manifest(),
                "performance": {
                    "yolo_batch_size": yolo_batch_size,
                    "depthpro_batch_size": depthpro_batch_size if use_depth else 0,
                    "progress_update_target": 100,
                },
            },
        )
        _add_ms(timing_breakdown_ms, "run_manifest_upload_ms", stage_started)
        stage_started = time.perf_counter()
        _upload_json(
            r2_client,
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
            output_r2_prefix=output_r2_prefix,
        )
        _add_ms(timing_breakdown_ms, "redis_detecting_update_ms", stage_started)
        processing_started = time.perf_counter()
        warmup_timings = _warm_pipeline_models(use_depth=use_depth, warm_sam2=warm_sam2)
        for key, value in warmup_timings.items():
            if isinstance(value, int) and not isinstance(value, bool):
                timing_breakdown_ms[key] = value

        pci_scores: list[float] = []
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
            "depthpro_ms": 0,
            "frame_area_ms": 0,
            "pci_ms": 0,
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

            depth_maps_by_index: dict[Any, Any] = {}
            depth_share_ms = 0
            if use_depth:
                depth_started = time.perf_counter()
                try:
                    for depth_chunk in _chunked(frame_chunk, depthpro_batch_size):
                        depth_paths = [str(Path(frame["path"])) for frame in depth_chunk]
                        depth_maps = depthpro_inference.infer_depth_maps(depth_paths)
                        for frame, depth_map in zip(depth_chunk, depth_maps):
                            depth_maps_by_index[frame.get("index")] = depth_map
                    depth_batch_elapsed_ms = _elapsed_ms(depth_started)
                    depth_share_ms = int(depth_batch_elapsed_ms / max(1, len(frame_chunk)))
                    print(
                        f"[DEPTHPRO_BATCH_RESULT {batch_index}] frames={len(depth_maps_by_index)} "
                        f"batch_size={depthpro_batch_size} elapsed_ms={depth_batch_elapsed_ms}",
                        flush=True,
                    )
                except Exception as exc:
                    print(
                        f"[DEPTHPRO_BATCH {batch_index}] failed: {exc}; "
                        "falling back to per-frame depth",
                        flush=True,
                    )

            for frame in frame_chunk:
                processed_count += 1
                print(f"[FRAME {processed_count}/{total}] processing", flush=True)
                frame_path = Path(frame["path"])
                frame_result = _process_frame(
                    frame,
                    use_depth=use_depth,
                    yolo_detections=detections_by_index.get(frame.get("index"), []),
                    yolo_elapsed_ms=yolo_share_ms,
                    precomputed_depth_map=depth_maps_by_index.get(frame.get("index")),
                    depth_elapsed_ms=depth_share_ms,
                )
                processed = processed_count
                total_detections += len(frame_result.get("detections") or [])
                pci_scores.append(float(frame_result["pci_score"]))
                total_processing_ms += int(frame_result.get("processing_ms") or 0)
                for key, value in (frame_result.get("stage_timings_ms") or {}).items():
                    if isinstance(value, int):
                        frame_stage_totals_ms[key] = frame_stage_totals_ms.get(key, 0) + value

                analysis_stage = str(frame_result.get("analysis_stage") or "unknown")
                pipeline_stage_counts[analysis_stage] = pipeline_stage_counts.get(analysis_stage, 0) + 1
                frame_degraded_reasons = frame_result.get("degraded_reasons") or []
                if analysis_stage == "fallback" or frame_degraded_reasons:
                    degraded_frame_count += 1
                for reason in frame_degraded_reasons:
                    reason_key = str(reason)
                    degraded_reason_counts[reason_key] = degraded_reason_counts.get(reason_key, 0) + 1

                stage_started = time.perf_counter()
                _upload_file(
                    r2_client,
                    bucket,
                    frame_path,
                    f"{output_r2_prefix}frames/{frame_path.name}",
                )
                _add_ms(frame_stage_totals_ms, "frame_upload_ms", stage_started)

                stage_started = time.perf_counter()
                detection_path = detection_dir / f"{frame_path.stem}.json"
                detection_path.parent.mkdir(parents=True, exist_ok=True)
                detection_path.write_text(json.dumps(frame_result))
                _add_ms(frame_stage_totals_ms, "detection_json_write_ms", stage_started)

                stage_started = time.perf_counter()
                _upload_file(
                    r2_client,
                    bucket,
                    detection_path,
                    f"{output_r2_prefix}detections/{frame_path.stem}.json",
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

        average_pci = sum(pci_scores) / len(pci_scores) if pci_scores else 50.0
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
            r2_client,
            bucket,
            f"{manifest_prefix}processing_summary.json",
            {
                "job_id": job_id,
                "status": "complete",
                "processed_count": processed,
                "frame_count": total,
                "average_pci": average_pci,
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
                "depthpro_batch_size": depthpro_batch_size if use_depth else 0,
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
            average_pci=average_pci,
            output_r2_prefix=output_r2_prefix,
        )
        print(
            f"[DONE] processed {processed} frames, avg_pci={average_pci:.1f}, detections={total_detections}",
            flush=True,
        )
        webhook_ok, webhook_error = _post_webhook(
            app_url,
            webhook_secret,
            {
                "job_id": job_id,
                "user_id": user_id,
                "status": "complete",
                "average_pci": average_pci,
                "frame_count": len(frames),
                "processed_count": processed,
                "output_r2_prefix": output_r2_prefix,
            },
        )
        if not webhook_ok:
            _update_job(
                redis_url,
                redis_token,
                job_id,
                webhook_error=webhook_error,
            )
        return {"job_id": job_id, "status": "complete", "average_pci": average_pci}
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


print(f"[WORKER_BOOT] {json.dumps(_runtime_manifest(), sort_keys=True)}", flush=True)

runpod.serverless.start({"handler": handler})
