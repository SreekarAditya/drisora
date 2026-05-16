import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getRedisClient } from "@/lib/redis";
import { jobKey, userJobsKey } from "@/lib/jobs/submit";
import type { ProcessingJobRecord } from "@/types";

interface FlightBounds {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
}

interface VideoInput {
  video_filename: string;
  srt_filename: string | null;
  storage_path: string;
  srt_storage_path?: string | null;
  flight_bounds?: FlightBounds | null;
  frame_count?: number | null;
}

interface JobOptions {
  enable_metric_analysis?: boolean;
  frame_extraction_mode?: string | null;
  frame_interval_seconds?: number | null;
}

interface IngestBody {
  videos: VideoInput[];
  job_options?: JobOptions;
}

function normalizedFrameOptions(options: JobOptions) {
  const rawMode = options.frame_extraction_mode;
  const rawInterval = options.frame_interval_seconds;
  const mode = typeof rawMode === "string" ? rawMode.trim().toLowerCase() : "";

  if (mode === "all_frames" || (mode === "" && rawInterval == null)) {
    return {
      frame_extraction_mode: "all_frames",
      frame_interval_seconds: null,
    };
  }

  const interval = Number(rawInterval);
  if (!Number.isFinite(interval) || interval <= 0) {
    return {
      frame_extraction_mode: "interval",
      frame_interval_seconds: 1,
    };
  }

  return {
    frame_extraction_mode: "interval",
    frame_interval_seconds: interval,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: surveyId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate survey exists and belongs to this user
  const { data: survey } = await supabase
    .from("surveys")
    .select("id")
    .eq("id", surveyId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  let body: IngestBody;
  try {
    body = (await request.json()) as IngestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.videos) || body.videos.length === 0) {
    return NextResponse.json(
      { error: "videos must be a non-empty array" },
      { status: 400 },
    );
  }

  // Validate each video entry
  for (const video of body.videos) {
    if (typeof video.video_filename !== "string" || video.video_filename.length === 0) {
      return NextResponse.json(
        { error: "Each video must have a non-empty video_filename" },
        { status: 400 },
      );
    }
    if (video.srt_filename !== null && typeof video.srt_filename !== "string") {
      return NextResponse.json(
        { error: "srt_filename must be a string or null" },
        { status: 400 },
      );
    }
    if (typeof video.storage_path !== "string" || video.storage_path.length === 0) {
      return NextResponse.json(
        { error: "Each video must have a non-empty storage_path" },
        { status: 400 },
      );
    }
  }

  const now = new Date().toISOString();

  // Batch insert survey_videos records
  const surveyVideoRows = body.videos.map((video) => ({
    id: randomUUID(),
    survey_id: surveyId,
    video_filename: video.video_filename,
    srt_filename: video.srt_filename ?? null,
    storage_path: video.storage_path,
    flight_bounds: video.flight_bounds ?? null,
    frame_count: video.frame_count ?? null,
    status: "pending" as const,
    created_at: now,
  }));

  const { data: insertedVideos, error: videosInsertError } = await supabase
    .from("survey_videos")
    .insert(surveyVideoRows)
    .select("id");

  if (videosInsertError) {
    return NextResponse.json(
      { error: `Failed to create survey video records: ${videosInsertError.message}` },
      { status: 500 },
    );
  }

  const videoIds = (insertedVideos ?? []).map((v) => v.id);

  // Build video pairs info for the worker
  const videoPairs = surveyVideoRows.map((row) => ({
    survey_video_id: row.id,
    video_filename: row.video_filename,
    srt_filename: row.srt_filename,
    storage_path: row.storage_path,
    flight_bounds: row.flight_bounds,
    frame_count: row.frame_count,
  }));

  const jobId = randomUUID();
  const videoStorageFilenames = body.videos.map((video) => video.storage_path.split("/").pop() ?? video.storage_path);
  const srtStorageFilenames = body.videos.map((video) => {
    if (!video.srt_filename) return null;
    const srtStoragePath = video.srt_storage_path ?? video.srt_filename;
    return srtStoragePath.split("/").pop() ?? srtStoragePath;
  });
  const fileNames = [
    ...videoStorageFilenames,
    ...srtStorageFilenames.filter((name): name is string => typeof name === "string" && name.length > 0),
  ];
  const jobOptions: Record<string, unknown> = {
    ...(body.job_options ?? {}),
    ...normalizedFrameOptions(body.job_options ?? {}),
    is_multi_video: body.videos.length > 1,
    video_count: body.videos.length,
    video_filenames: body.videos.map((video) => video.video_filename),
    srt_filenames: body.videos.map((video) => video.srt_filename),
    video_storage_filenames: videoStorageFilenames,
    srt_storage_filenames: srtStorageFilenames,
    video_pairs: videoPairs,
    video_ids: videoIds,
    survey_id: surveyId,
  };

  const job: ProcessingJobRecord = {
    job_id: jobId,
    user_id: user.id,
    project_id: null,
    runpod_job_id: null,
    mode: "drone_footage",
    status: "queued",
    frame_count: 0,
    processed_count: 0,
    gps_available: body.videos.some(
      (v) => v.srt_filename !== null || v.flight_bounds != null,
    ),
    output_r2_prefix: `results/${user.id}/${jobId}/`,
    last_updated: now,
    created_at: now,
    error_message: null,
    options: jobOptions,
    file_names: fileNames,
    total_bytes: 0,
  };

  const { error: jobInsertError } = await supabase.from("jobs").insert({
    id: jobId,
    user_id: user.id,
    project_id: null,
    survey_id: surveyId,
    mode: "drone_footage",
    status: "queued",
    frame_count: 0,
    processed_count: 0,
    gps_available: job.gps_available,
    r2_prefix: job.output_r2_prefix,
    options: jobOptions,
    created_at: now,
  });

  if (jobInsertError) {
    // Roll back survey_videos inserts
    await supabase
      .from("survey_videos")
      .delete()
      .in("id", videoIds);

    return NextResponse.json(
      { error: `Failed to create job record: ${jobInsertError.message}` },
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
    // Roll back DB records
    await supabase.from("jobs").delete().eq("id", jobId).eq("user_id", user.id);
    await supabase.from("survey_videos").delete().in("id", videoIds);

    const message =
      error instanceof Error ? error.message : "Failed to queue job";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json(
    {
      job_id: jobId,
      survey_id: surveyId,
      video_ids: videoIds,
      status: "queued" as const,
    },
    { status: 201 },
  );
}
