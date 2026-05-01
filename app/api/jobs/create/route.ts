import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getRedisClient } from "@/lib/redis";

export type JobMode = "image_batch" | "handheld_video" | "drone_footage";

export type JobStatus =
  | "queued"
  | "extracting_frames"
  | "detecting"
  | "segmenting"
  | "scoring"
  | "complete"
  | "failed";

export interface JobRecord {
  job_id: string;
  user_id: string;
  mode: JobMode;
  status: JobStatus;
  frame_count: number;
  processed_count: number;
  gps_available: boolean;
  output_r2_prefix: string;
  last_updated: string;
  created_at: string;
  error_message: string | null;
  options: Record<string, unknown>;
  file_names: string[];
  total_bytes: number;
}

interface CreateJobBody {
  mode: JobMode;
  file_count: number;
  file_names: string[];
  total_bytes: number;
  options?: Record<string, unknown>;
}

const VALID_MODES: JobMode[] = ["image_batch", "handheld_video", "drone_footage"];

function jobKey(jobId: string) {
  return `job:${jobId}`;
}

function userJobsKey(userId: string) {
  return `user:${userId}:jobs`;
}

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

  if (body.mode === "image_batch" && body.file_names.length > 1000) {
    return NextResponse.json(
      { error: "Image batch limited to 1,000 files" },
      { status: 400 },
    );
  }

  if (
    (body.mode === "handheld_video" || body.mode === "drone_footage") &&
    body.file_count !== 1
  ) {
    return NextResponse.json(
      { error: "Video modes require exactly one video file" },
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

  const job: JobRecord = {
    job_id: jobId,
    user_id: user.id,
    mode: body.mode,
    status: "queued",
    frame_count: 0,
    processed_count: 0,
    gps_available: gpsAvailable,
    output_r2_prefix: `results/${user.id}/${jobId}`,
    last_updated: now,
    created_at: now,
    error_message: null,
    options,
    file_names: body.file_names,
    total_bytes: body.total_bytes ?? 0,
  };

  const redis = getRedisClient();
  await Promise.all([
    redis.set(jobKey(job.job_id), JSON.stringify(job)),
    redis.lpush(userJobsKey(user.id), job.job_id),
  ]);

  await supabase.from("jobs").insert({
    id: jobId,
    user_id: user.id,
    mode: body.mode,
    status: "queued",
    frame_count: 0,
    gps_available: gpsAvailable,
    r2_prefix: `results/${user.id}/${jobId}`,
    created_at: now,
  });

  return NextResponse.json({ job_id: job.job_id, job }, { status: 201 });
}
