import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import boto3
import httpx
import runpod
from dotenv import load_dotenv

from jobs.dispatcher import dispatch_job
from pipeline import depthpro_inference as depth
from pipeline import pci_scorer
from pipeline import sam2_inference as segment
from pipeline import yolo_inference as detect

load_dotenv()


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
        local_path = raw_dir / file_name
        local_path.parent.mkdir(parents=True, exist_ok=True)
        r2_client.download_file(bucket, f"{r2_prefix.rstrip('/')}/{file_name}", str(local_path))
        local_files.append(local_path)
    return local_files


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
        files["video"] = str(local_files[0])
    elif mode == "drone_footage":
        files["video"] = str(local_files[0])
        srt_name = options.get("srt_name")
        if srt_name:
            srt_path = next((path for path in local_files if path.name == srt_name), None)
            if srt_path:
                files["srt"] = str(srt_path)
    else:
        raise ValueError(f"Unknown job mode: {mode!r}")
    return files


def _call_module_run(module: Any, *args: Any) -> Any:
    for name in ("run", "run_detect", "run_segment", "run_depth", "score", "score_frame"):
        func = getattr(module, name, None)
        if callable(func):
            return func(*args)
    raise NotImplementedError(f"{module.__name__} does not expose a runnable pipeline function")


def _pci_value(pci_result: Any) -> float:
    if isinstance(pci_result, dict):
        value = pci_result.get("pci_score", pci_result.get("score", 0))
    else:
        value = pci_result
    return float(value or 0)


def _result_payload(frame: dict[str, Any], pci_result: Any, depth_map: Any) -> dict[str, Any]:
    payload = pci_result.copy() if isinstance(pci_result, dict) else {"pci_score": pci_result}
    payload.setdefault("pci_score", _pci_value(pci_result))
    payload.setdefault("crack_types", [])
    payload.setdefault("depth_estimate", None)
    if payload["depth_estimate"] is None and depth_map is not None and hasattr(depth_map, "mean"):
        payload["depth_estimate"] = float(depth_map.mean())
    payload["lat"] = frame.get("lat")
    payload["lon"] = frame.get("lon")
    payload["alt"] = frame.get("alt_m", frame.get("alt"))
    return payload


def _write_overlay(masks: Any, overlay_path: Path) -> None:
    overlay_path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(masks, (str, Path)) and Path(masks).exists():
        shutil.copyfile(masks, overlay_path)
        return
    if hasattr(masks, "save"):
        masks.save(overlay_path)
        return
    if hasattr(masks, "shape"):
        from PIL import Image

        Image.fromarray(masks).save(overlay_path)
        return
    raise NotImplementedError("segment pipeline did not return a saveable overlay")


def _upload_file(r2_client: Any, bucket: str, local_path: Path, key: str) -> None:
    r2_client.upload_file(str(local_path), bucket, key)


def _post_webhook(
    app_url: str,
    webhook_secret: str,
    payload: dict[str, Any],
) -> None:
    with httpx.Client(timeout=20) as client:
        response = client.post(
            f"{app_url.rstrip('/')}/api/webhooks/job-complete",
            json=payload,
            headers={"X-Webhook-Secret": webhook_secret},
        )
    response.raise_for_status()


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
    overlay_dir = result_dir / "overlays"
    output_r2_prefix = f"results/{user_id}/{job_id}/"

    try:
        _update_job(redis_url, redis_token, job_id, status="extracting_frames")
        r2_client = _create_r2_client()
        local_files = _download_raw_files(r2_client, bucket, r2_prefix, file_names, raw_dir)

        frame_batch = dispatch_job(job_id, mode, _build_dispatch_files(mode, local_files, options))
        frames = frame_batch["frames"]
        _update_job(
            redis_url,
            redis_token,
            job_id,
            status="detecting",
            frame_count=len(frames),
            output_r2_prefix=output_r2_prefix,
        )

        pci_scores: list[float] = []
        for processed_count, frame in enumerate(frames, start=1):
            frame_path = Path(frame["path"])
            frame_stem = frame_path.stem

            detections = _call_module_run(detect, str(frame_path))
            masks = _call_module_run(segment, str(frame_path), detections)
            depth_map = _call_module_run(depth, str(frame_path))
            pci_result = _call_module_run(pci_scorer, detections, masks, depth_map)
            result = _result_payload(frame, pci_result, depth_map)
            pci_scores.append(_pci_value(result))

            detection_path = detection_dir / f"{frame_stem}.json"
            overlay_path = overlay_dir / f"{frame_stem}.png"
            detection_path.parent.mkdir(parents=True, exist_ok=True)
            detection_path.write_text(json.dumps(result))
            _write_overlay(masks, overlay_path)

            _upload_file(
                r2_client,
                bucket,
                detection_path,
                f"{output_r2_prefix}detections/{frame_stem}.json",
            )
            _upload_file(
                r2_client,
                bucket,
                overlay_path,
                f"{output_r2_prefix}overlays/{frame_stem}.png",
            )
            _update_job(
                redis_url,
                redis_token,
                job_id,
                processed_count=processed_count,
            )

        average_pci = sum(pci_scores) / len(pci_scores) if pci_scores else 0.0
        _update_job(
            redis_url,
            redis_token,
            job_id,
            status="complete",
            average_pci=average_pci,
            output_r2_prefix=output_r2_prefix,
        )
        _post_webhook(
            app_url,
            webhook_secret,
            {
                "job_id": job_id,
                "user_id": user_id,
                "status": "complete",
                "average_pci": average_pci,
            },
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
