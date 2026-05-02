import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getRedisClient } from "@/lib/redis";
import { jobKey, userJobsKey } from "@/lib/jobs/submit";
import type { JobMode, ProcessingJobRecord } from "@/types";

interface CreateJobBody {
  mode: JobMode;
  file_count: number;
  file_names: string[];
  total_bytes: number;
  options?: Record<string, unknown>;
}

const VALID_MODES: JobMode[] = ["image_batch", "handheld_video", "drone_footage"];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateJobBody;
  try {
    body = (await request.json()) as CreateJobBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!VALID_MODES.includes(body.mode)) {
    return NextResponse.json(
      { error: `Invalid mode. Expected one of ${VALID_MODES.join(", ")}` },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.file_names) || body.file_names.length === 0) {
    return NextResponse.json({ error: "file_names is required" }, { status: 400 });
  }

  if (body.file_count !== body.file_names.length) {
    return NextResponse.json(
      { error: "file_count must match file_names length" },
      { status: 400 },
    );
  }

  if (!Number.isFinite(body.total_bytes) || body.total_bytes <= 0) {
    return NextResponse.json(
      { error: "total_bytes must be a positive number" },
      { status: 400 },
    );
  }

  if (body.mode === "image_batch" && body.file_names.length > 1000) {
    return NextResponse.json(
      { error: "Image batch limited to 1,000 files" },
      { status: 400 },
    );
  }

  if (body.mode === "handheld_video" && body.file_count !== 1) {
    return NextResponse.json(
      { error: "Video modes require exactly one video file" },
      { status: 400 },
    );
  }

  if (body.mode === "drone_footage" && (body.file_count < 1 || body.file_count > 2)) {
    return NextResponse.json(
      { error: "Drone footage requires one video file and an optional SRT file" },
      { status: 400 },
    );
  }

  const options = body.options ?? {};
  const gpsAvailable =
    body.mode === "image_batch"
      ? true
      : body.mode === "handheld_video"
        ? false
        : options.gps_source === "embedded" || options.has_srt === true;

  if (body.mode === "drone_footage" && !gpsAvailable) {
    return NextResponse.json(
      { error: "Drone footage requires embedded GPS or an .SRT file" },
      { status: 400 },
    );
  }

  const jobId = randomUUID();
  const now = new Date().toISOString();

  const job: ProcessingJobRecord = {
    job_id: jobId,
    user_id: user.id,
    runpod_job_id: null,
    mode: body.mode,
    status: "uploading",
    frame_count: 0,
    processed_count: 0,
    gps_available: gpsAvailable,
    output_r2_prefix: `results/${user.id}/${jobId}/`,
    last_updated: now,
    created_at: now,
    error_message: null,
    options,
    file_names: body.file_names,
    total_bytes: body.total_bytes ?? 0,
  };

  const { error: insertError } = await supabase.from("jobs").insert({
    id: jobId,
    user_id: user.id,
    mode: body.mode,
    status: "uploading",
    frame_count: 0,
    processed_count: 0,
    gps_available: gpsAvailable,
    r2_prefix: `results/${user.id}/${jobId}/`,
    created_at: now,
  });

  if (insertError) {
    return NextResponse.json(
      { error: `Failed to create job record: ${insertError.message}` },
      { status: 500 },
    );
  }

  try {
    const redis = getRedisClient();
    await Promise.all([
      redis.set(jobKey(job.job_id), JSON.stringify(job)),
      redis.lpush(userJobsKey(user.id), job.job_id),
    ]);
  } catch (error) {
    await supabase.from("jobs").delete().eq("id", jobId).eq("user_id", user.id);
    const message =
      error instanceof Error ? error.message : "Failed to create upload session";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ job_id: job.job_id, job }, { status: 201 });
}
