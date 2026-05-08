"""RunPod worker entrypoint.

# NOT USED IN SERVERLESS MODE — kept for local testing only.

Polls Redis for queued jobs, downloads raw files from R2 to /tmp,
runs the ingest + detection pipeline frame-by-frame, uploads results
back to R2, then POSTs a webhook to Next.js.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

import boto3
import requests
from dotenv import load_dotenv
from redis import Redis

from jobs.dispatcher import dispatch_job
from pipeline.yolo_inference import run_detect
from pipeline.sam2_inference import run_segment
from pipeline.depthpro_inference import run_depth
from pipeline.pci_scorer import score_frame

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config from environment
# ---------------------------------------------------------------------------

CLOUDFLARE_R2_ACCOUNT_ID = os.environ["CLOUDFLARE_R2_ACCOUNT_ID"]
CLOUDFLARE_R2_ACCESS_KEY_ID = os.environ["CLOUDFLARE_R2_ACCESS_KEY_ID"]
CLOUDFLARE_R2_SECRET_ACCESS_KEY = os.environ["CLOUDFLARE_R2_SECRET_ACCESS_KEY"]
CLOUDFLARE_R2_BUCKET_NAME = os.environ["CLOUDFLARE_R2_BUCKET_NAME"]
REDIS_URL = os.environ["REDIS_URL"]
APP_URL = os.environ["NEXT_PUBLIC_APP_URL"].rstrip("/")
WEBHOOK_SECRET = os.environ["CLOUDFLARE_R2_WEBHOOK_SECRET"]

STALE_THRESHOLD_SECONDS = 600
POLL_INTERVAL_SECONDS = 5

# ---------------------------------------------------------------------------
# R2 client
# ---------------------------------------------------------------------------

r2 = boto3.client(
    "s3",
    endpoint_url=f"https://{CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=CLOUDFLARE_R2_ACCESS_KEY_ID,
    aws_secret_access_key=CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    region_name="auto",
)


# ---------------------------------------------------------------------------
# Redis helpers
# ---------------------------------------------------------------------------

def get_redis() -> Redis:
    return Redis.from_url(REDIS_URL, decode_responses=True)


def load_job(redis: Redis, job_id: str) -> Dict[str, Any] | None:
    raw = redis.get(f"job:{job_id}")
    if not raw:
        return None
    return json.loads(raw)


def save_job(redis: Redis, job: Dict[str, Any]) -> None:
    job["last_updated"] = _now()
    redis.set(f"job:{job['job_id']}", json.dumps(job))


def update_job_progress(redis: Redis, job_id: str, processed_count: int) -> None:
    job = load_job(redis, job_id)
    if not job:
        return
    job["processed_count"] = processed_count
    job["last_updated"] = _now()
    redis.set(f"job:{job_id}", json.dumps(job))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Stale job recovery
# ---------------------------------------------------------------------------

def recover_stale_jobs(redis: Redis) -> None:
    """Reset any in-progress jobs that stalled > STALE_THRESHOLD_SECONDS ago."""
    active_statuses = {"queued", "extracting_frames", "detecting", "segmenting", "scoring"}
    cursor = 0
    reset_count = 0
    while True:
        cursor, keys = redis.scan(cursor, match="job:*", count=100)
        for key in keys:
            raw = redis.get(key)
            if not raw:
                continue
            job = json.loads(raw)
            if job.get("status") not in active_statuses - {"queued"}:
                continue
            last = job.get("last_updated", "")
            if not last:
                continue
            try:
                age = (datetime.now(timezone.utc) - datetime.fromisoformat(last)).total_seconds()
            except ValueError:
                continue
            if age > STALE_THRESHOLD_SECONDS:
                log.warning("Resetting stale job %s (age %.0fs)", job["job_id"], age)
                job["status"] = "queued"
                job["last_updated"] = _now()
                redis.set(key, json.dumps(job))
                reset_count += 1
        if cursor == 0:
            break
    if reset_count:
        log.info("Recovered %d stale job(s)", reset_count)


# ---------------------------------------------------------------------------
# Poll for next queued job
# ---------------------------------------------------------------------------

def dequeue_job(redis: Redis) -> Dict[str, Any] | None:
    """Find and claim one queued job (linear scan; fine for low volume)."""
    cursor = 0
    while True:
        cursor, keys = redis.scan(cursor, match="job:*", count=100)
        for key in keys:
            raw = redis.get(key)
            if not raw:
                continue
            job = json.loads(raw)
            if job.get("status") == "queued":
                job["status"] = "extracting_frames"
                job["last_updated"] = _now()
                redis.set(key, json.dumps(job))
                return job
        if cursor == 0:
            break
    return None


# ---------------------------------------------------------------------------
# R2 download / upload helpers
# ---------------------------------------------------------------------------

def safe_file_name(file_name: str) -> str:
    if "/" in file_name or "\\" in file_name or ".." in file_name:
        raise ValueError(f"Unsafe upload filename: {file_name!r}")
    safe_name = Path(file_name).name
    if safe_name in {"", ".", ".."} or safe_name != file_name:
        raise ValueError(f"Unsafe upload filename: {file_name!r}")
    return safe_name


def download_raw_files(job: Dict[str, Any], work_dir: Path) -> None:
    user_id = job["user_id"]
    job_id = job["job_id"]
    file_names = job.get("file_names", [])
    work_dir.mkdir(parents=True, exist_ok=True)
    for name in file_names:
        safe_name = safe_file_name(name)
        key = f"uploads/{user_id}/{job_id}/raw/{safe_name}"
        dest = work_dir / safe_name
        log.info("Downloading s3://%s/%s → %s", CLOUDFLARE_R2_BUCKET_NAME, key, dest)
        r2.download_file(CLOUDFLARE_R2_BUCKET_NAME, key, str(dest))


def uploaded_file_by_original_name(job: Dict[str, Any], original_name: str, work_dir: Path) -> Path | None:
    original_file_names = job.get("options", {}).get("original_file_names")
    file_names = job.get("file_names", [])
    if not isinstance(original_file_names, list):
        return None

    for index, candidate in enumerate(original_file_names):
        if candidate == original_name and index < len(file_names):
            return work_dir / safe_file_name(file_names[index])
    return None


def find_video_file(job: Dict[str, Any], work_dir: Path) -> Path | None:
    for name in job.get("file_names", []):
        path = work_dir / safe_file_name(name)
        if path.suffix.lower() != ".srt":
            return path
    return None


def find_srt_file(job: Dict[str, Any], work_dir: Path) -> Path | None:
    options = job.get("options", {})
    srt_storage_name = options.get("srt_storage_name")
    if isinstance(srt_storage_name, str) and srt_storage_name:
        path = work_dir / safe_file_name(srt_storage_name)
        if path.exists():
            return path

    srt_name = options.get("srt_name")
    if isinstance(srt_name, str) and srt_name:
        path = work_dir / safe_file_name(srt_name)
        if path.exists():
            return path
        original_match = uploaded_file_by_original_name(job, srt_name, work_dir)
        if original_match and original_match.suffix.lower() == ".srt" and original_match.exists():
            return original_match

    return next((work_dir / safe_file_name(name) for name in job.get("file_names", []) if safe_file_name(name).lower().endswith(".srt")), None)


def build_multi_video_files(job: Dict[str, Any], work_dir: Path) -> list[Dict[str, str]] | None:
    options = job.get("options", {})
    if options.get("is_multi_video") is not True:
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

    entries: list[Dict[str, str]] = []
    for index, video_name in enumerate(video_names):
        if not isinstance(video_name, str) or not video_name:
            continue

        storage_name = video_storage[index] if index < len(video_storage) else None
        video_path = (
            work_dir / safe_file_name(storage_name)
            if isinstance(storage_name, str) and storage_name
            else uploaded_file_by_original_name(job, video_name, work_dir)
        )
        if not video_path or not video_path.exists():
            raise ValueError(f"Missing uploaded video for multi-video survey: {video_name}")

        entry: Dict[str, str] = {"video": str(video_path)}
        srt_name = srt_names[index] if index < len(srt_names) else None
        srt_storage_name = srt_storage[index] if index < len(srt_storage) else None
        srt_path = None
        if isinstance(srt_storage_name, str) and srt_storage_name:
            candidate = work_dir / safe_file_name(srt_storage_name)
            if candidate.exists():
                srt_path = candidate
        if srt_path is None and isinstance(srt_name, str) and srt_name:
            candidate = uploaded_file_by_original_name(job, srt_name, work_dir)
            if candidate and candidate.suffix.lower() == ".srt" and candidate.exists():
                srt_path = candidate
        if srt_path is not None:
            entry["srt"] = str(srt_path)

        entries.append(entry)

    return entries


def upload_result(local_path: Path, r2_key: str) -> None:
    log.info("Uploading %s → s3://%s/%s", local_path, CLOUDFLARE_R2_BUCKET_NAME, r2_key)
    r2.upload_file(str(local_path), CLOUDFLARE_R2_BUCKET_NAME, r2_key)


# ---------------------------------------------------------------------------
# Frame processing
# ---------------------------------------------------------------------------

def process_frames(
    redis: Redis,
    job: Dict[str, Any],
    frame_batch: Dict[str, Any],
    output_prefix: str,
) -> float:
    """Process all frames and return the average PCI score."""
    frames = frame_batch["frames"]
    job["frame_count"] = len(frames)
    job["status"] = "detecting"
    save_job(redis, job)

    pci_scores: list[float] = []

    for i, frame in enumerate(frames):
        frame_path = Path(frame["path"])

        detections = run_detect(str(frame_path))
        depth = run_depth(str(frame_path))
        segments = run_segment(str(frame_path), detections)
        score = score_frame(detections, depth, segments)
        pci_scores.append(float(score))

        frame_stem = frame_path.stem
        det_key = f"{output_prefix}/detections/{frame_stem}.json"
        dep_key = f"{output_prefix}/depth/{frame_stem}.npy"
        seg_key = f"{output_prefix}/overlays/{frame_stem}.png"

        depth_estimate: float | None = None
        if depth is not None and hasattr(depth, "mean"):
            import numpy as np  # lazy import; only needed when depth module is active
            depth_estimate = float(np.mean(depth))
            dep_local = frame_path.parent / f"{frame_stem}_dep.npy"
            np.save(str(dep_local), depth)
            upload_result(dep_local, dep_key)

        det_record = {
            **detections,
            "pci_score": score,
            "index": frame.get("index", i),
            "timestamp_ms": frame.get("timestamp_ms"),
            "lat": frame.get("lat"),
            "lon": frame.get("lon"),
            "alt_m": frame.get("alt_m"),
            "depth_estimate": depth_estimate,
        }
        det_local = frame_path.parent / f"{frame_stem}_det.json"
        det_local.write_text(json.dumps(det_record))
        upload_result(det_local, det_key)

        if segments is not None:
            upload_result(Path(segments), seg_key)

        update_job_progress(redis, job["job_id"], i + 1)

    job["status"] = "scoring"
    save_job(redis, job)

    return sum(pci_scores) / len(pci_scores) if pci_scores else 0.0


# ---------------------------------------------------------------------------
# Webhook
# ---------------------------------------------------------------------------

def post_webhook(
    job_id: str,
    user_id: str,
    status: str,
    error_message: str | None = None,
    average_pci: float | None = None,
) -> None:
    payload: Dict[str, Any] = {"job_id": job_id, "user_id": user_id, "status": status}
    if error_message:
        payload["error_message"] = error_message
    if average_pci is not None:
        payload["average_pci"] = average_pci
    try:
        resp = requests.post(
            f"{APP_URL}/api/webhooks/job-complete",
            json=payload,
            headers={"x-webhook-secret": WEBHOOK_SECRET},
            timeout=10,
        )
        resp.raise_for_status()
    except Exception as exc:
        log.error("Webhook POST failed: %s", exc)


# ---------------------------------------------------------------------------
# Process one job
# ---------------------------------------------------------------------------

def run_job(redis: Redis, job: Dict[str, Any]) -> None:
    job_id = job["job_id"]
    work_dir = Path(f"/tmp/{job_id}")
    log.info("Starting job %s (mode=%s)", job_id, job["mode"])

    try:
        download_raw_files(job, work_dir)

        files: Dict[str, Any] = {"frame_interval_seconds": job["options"].get("frame_interval_seconds", 1.0)}
        mode = job["mode"]

        if mode == "image_batch":
            files["images"] = [str(work_dir / n) for n in job["file_names"]]
        elif mode == "handheld_video":
            video_path = find_video_file(job, work_dir)
            if not video_path:
                raise ValueError("handheld_video requires a video file")
            files["video"] = str(video_path)
            srt_path = find_srt_file(job, work_dir)
            if srt_path:
                files["srt"] = str(srt_path)
        elif mode == "drone_footage":
            multi_videos = build_multi_video_files(job, work_dir)
            if multi_videos:
                files["videos"] = multi_videos
            else:
                video_path = find_video_file(job, work_dir)
                if not video_path:
                    raise ValueError("drone_footage requires a video file")
                files["video"] = str(video_path)
                srt_path = find_srt_file(job, work_dir)
                if srt_path:
                    files["srt"] = str(srt_path)

        frame_batch = dispatch_job(job_id, mode, files)

        output_prefix = job.get("output_r2_prefix", f"results/{job['user_id']}/{job_id}")
        average_pci = process_frames(redis, job, frame_batch, output_prefix)

        job["status"] = "complete"
        job["output_r2_prefix"] = output_prefix
        job["average_pci"] = average_pci
        save_job(redis, job)
        log.info("Job %s complete (%d frames, avg PCI %.1f)", job_id, frame_batch["frame_count"], average_pci)
        post_webhook(job_id, job["user_id"], "complete", average_pci=average_pci)

    except Exception as exc:
        log.exception("Job %s failed: %s", job_id, exc)
        job["status"] = "failed"
        job["error_message"] = str(exc)
        save_job(redis, job)
        post_webhook(job_id, job["user_id"], "failed", str(exc))

    finally:
        if work_dir.exists():
            shutil.rmtree(work_dir)
            log.info("Cleaned up /tmp/%s", job_id)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> None:
    log.info("Worker starting up")
    redis = get_redis()

    recover_stale_jobs(redis)
    log.info("Stale job recovery complete — entering poll loop")

    while True:
        job = dequeue_job(redis)
        if job:
            run_job(redis, job)
        else:
            time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
