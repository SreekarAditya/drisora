import { getRedisClient } from "@/lib/redis";
import { submitRunpodJob } from "@/lib/runpod";
import type { ProcessingJobRecord } from "@/types";

export function jobKey(jobId: string) {
  return `job:${jobId}`;
}

export function userJobsKey(userId: string) {
  return `user:${userId}:jobs`;
}

export function parseRedisJob(raw: unknown): ProcessingJobRecord | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    return JSON.parse(raw) as ProcessingJobRecord;
  }
  return raw as ProcessingJobRecord;
}

export async function loadRedisJob(jobId: string) {
  const redis = getRedisClient();
  const raw = await redis.get<string>(jobKey(jobId));
  return parseRedisJob(raw);
}

export async function saveRedisJob(job: ProcessingJobRecord) {
  const redis = getRedisClient();
  await redis.set(jobKey(job.job_id), JSON.stringify(job));
}

export async function submitProcessingJob(job: ProcessingJobRecord) {
  const now = new Date().toISOString();
  const runpodJobId = await submitRunpodJob({
    job_id: job.job_id,
    user_id: job.user_id,
    mode: job.mode,
    r2_prefix: `uploads/${job.user_id}/${job.job_id}/raw/`,
    file_names: job.file_names,
    options: job.options,
  });

  const nextJob: ProcessingJobRecord = {
    ...job,
    runpod_job_id: runpodJobId,
    status: "queued",
    processed_count: 0,
    frame_count: 0,
    error_message: null,
    last_updated: now,
  };
  await saveRedisJob(nextJob);
  return nextJob;
}
