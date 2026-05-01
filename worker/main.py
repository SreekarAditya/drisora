"""RunPod worker entrypoint.

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

def download_raw_files(job: Dict[str, Any], work_dir: Path) -> None:
    user_id = job["user_id"]
    job_id = job["job_id"]
    file_names = job.get("file_names", [])
    work_dir.mkdir(parents=True, exist_ok=True)
    for name in file_names:
        key = f"uploads/{user_id}/{job_id}/raw/{name}"
        dest = work_dir / name
        log.info("Downloading s3://%s/%s → %s", CLOUDFLARE_R2_BUCKET_NAME, key, dest)
        r2.download_file(CLOUDFLARE_R2_BUCKET_NAME, key, str(dest))


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
) -> None:
    frames = frame_batch["frames"]
    job["frame_count"] = len(frames)
    job["status"] = "detecting"
    save_job(redis, job)

    for i, frame in enumerate(frames):
        frame_path = Path(frame["path"])

        detections = run_detect(str(frame_path))
        depth = run_depth(str(frame_path))
        segments = run_segment(str(frame_path), detections)
        score = score_frame(detections, depth, segments)

        frame_stem = frame_path.stem
        det_key = f"{output_prefix}/detections/{frame_stem}.json"
        dep_key = f"{output_prefix}/depth/{frame_stem}.npy"
        seg_key = f"{output_prefix}/overlays/{frame_stem}.png"

        det_local = frame_path.parent / f"{frame_stem}_det.json"
        det_local.write_text(json.dumps({**detections, "pci_score": score}))
        upload_result(det_local, det_key)

        if depth is not None:
            import numpy as np  # lazy import; only needed when depth module is active
            dep_local = frame_path.parent / f"{frame_stem}_dep.npy"
            np.save(str(dep_local), depth)
            upload_result(dep_local, dep_key)

        if segments is not None:
            upload_result(Path(segments), seg_key)

        update_job_progress(redis, job["job_id"], i + 1)

    job["status"] = "scoring"
    save_job(redis, job)


# ---------------------------------------------------------------------------
# Webhook
# ---------------------------------------------------------------------------

def post_webhook(job_id: str, user_id: str, status: str, error_message: str | None = None) -> None:
    payload: Dict[str, Any] = {"job_id": job_id, "user_id": user_id, "status": status}
    if error_message:
        payload["error_message"] = error_message
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
            files["video"] = str(work_dir / job["file_names"][0])
        elif mode == "drone_footage":
            files["video"] = str(work_dir / job["file_names"][0])
            srt_name = job["options"].get("srt_name")
            if srt_name:
                files["srt"] = str(work_dir / srt_name)

        frame_batch = dispatch_job(job_id, mode, files)

        output_prefix = job.get("output_r2_prefix", f"results/{job['user_id']}/{job_id}")
        process_frames(redis, job, frame_batch, output_prefix)

        job["status"] = "complete"
        job["output_r2_prefix"] = output_prefix
        save_job(redis, job)
        log.info("Job %s complete (%d frames)", job_id, frame_batch["frame_count"])
        post_webhook(job_id, job["user_id"], "complete")

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
