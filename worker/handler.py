import json
import math
import os
import shutil
import time
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
    try:
        loader()
        print(ready_message, flush=True)
    except Exception as exc:
        print(f"{name} model unavailable; using fallback path: {exc}", flush=True)


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


def _warm_pipeline_models(use_depth: bool, warm_sam2: bool) -> None:
    print("[WARMUP] Starting model warmup...", flush=True)
    _warm_model("YOLO", get_yolo, "[WARMUP] YOLO ready")
    if warm_sam2:
        _warm_model("SAM2", get_sam2, "[WARMUP] SAM2 ready")
    else:
        print("[WARMUP] SAM2 warmup skipped (loads on first detection)", flush=True)
    if use_depth:
        _warm_model("DepthPro", get_depth, "[WARMUP] DepthPro ready")
    else:
        print("[WARMUP] DepthPro skipped for this job", flush=True)
    print("[WARMUP] All models ready — starting frame loop", flush=True)


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
    files: dict[str, Any] = {
        "frame_interval_seconds": options.get("frame_interval_seconds", 1),
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


def _process_frame(frame: dict[str, Any], use_depth: bool) -> dict[str, Any]:
    started = time.perf_counter()
    frame_path = Path(frame["path"])
    yolo_count = 0
    sam2_attempted = False
    depth_attempted = False
    depth_skipped_reason = None if use_depth else "disabled_for_mode"
    try:
        detections = yolo_inference.run(str(frame_path))
        yolo_count = len(detections)

        if detections:
            sam2_attempted = True
            detections = sam2_inference.run(str(frame_path), detections)

        if use_depth:
            depth_attempted = True
            depth_result = depthpro_inference.run(str(frame_path), detections)
            detections = depth_result.get("detections", detections)
            depth_map = depth_result.get("depth_map")
        else:
            depth_map = None

        pci_result = pci_scorer.score(
            detections,
            frame_area_px=_frame_area_px(frame_path),
            depth_map=depth_map,
        )
    except Exception as exc:
        detections = []
        depth_map = None
        pci_result = _fallback_pci(str(exc))

    depth_available = depth_map is not None and getattr(depth_map, "size", 0) > 0
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
        f"depth_available={depth_available} elapsed_ms={elapsed_ms}",
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
        "sam2_attempted": sam2_attempted,
        "yolo_detection_count": yolo_count,
        "final_detection_count": final_count,
        "processing_ms": elapsed_ms,
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

    try:
        _update_job(redis_url, redis_token, job_id, status="extracting_frames")
        r2_client = _create_r2_client()
        local_files = _download_raw_files(r2_client, bucket, r2_prefix, file_names, raw_dir)

        use_depth = _depth_enabled(mode, options)
        warm_sam2 = _sam2_warmup_enabled(options)
        print(
            f"[PIPELINE] mode={mode} use_depth={use_depth} warm_sam2={warm_sam2} "
            f"options={json.dumps(options, sort_keys=True)}",
            flush=True,
        )

        frame_batch = dispatch_job(job_id, mode, _build_dispatch_files(mode, local_files, options))
        frames = frame_batch["frames"]
        _update_job(
            redis_url,
            redis_token,
            job_id,
            status="detecting",
            frame_count=len(frames),
            processed_count=0,
            output_r2_prefix=output_r2_prefix,
        )
        _warm_pipeline_models(use_depth=use_depth, warm_sam2=warm_sam2)

        pci_scores: list[float] = []
        processed = 0
        total = len(frames)
        total_detections = 0
        for processed_count, frame in enumerate(frames, start=1):
            print(f"[FRAME {processed_count}/{total}] processing", flush=True)
            frame_path = Path(frame["path"])
            frame_result = _process_frame(frame, use_depth=use_depth)
            processed = processed_count
            total_detections += len(frame_result.get("detections") or [])
            pci_scores.append(float(frame_result["pci_score"]))

            _upload_file(
                r2_client,
                bucket,
                frame_path,
                f"{output_r2_prefix}frames/{frame_path.name}",
            )

            detection_path = detection_dir / f"{frame_path.stem}.json"
            detection_path.parent.mkdir(parents=True, exist_ok=True)
            detection_path.write_text(json.dumps(frame_result))

            _upload_file(
                r2_client,
                bucket,
                detection_path,
                f"{output_r2_prefix}detections/{frame_path.stem}.json",
            )
            _update_job(
                redis_url,
                redis_token,
                job_id,
                processed_count=processed_count,
            )

        average_pci = sum(pci_scores) / len(pci_scores) if pci_scores else 50.0
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
        _update_job(
            redis_url,
            redis_token,
            job_id,
            status="failed",
            error_message=error_message,
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


runpod.serverless.start({"handler": handler})
