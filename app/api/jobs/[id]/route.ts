import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRedisClient } from "@/lib/redis";
import type { ProcessingJobRecord } from "@/types";

function isWebhookOnlyFailure(job: ProcessingJobRecord) {
  return (
    job.status === "failed" &&
    typeof job.error_message === "string" &&
    job.error_message.includes("/api/webhooks/job-complete") &&
    typeof job.average_pci === "number" &&
    Number.isFinite(job.average_pci) &&
    job.frame_count > 0 &&
    job.processed_count >= job.frame_count
  );
}

function normalizeJob(job: ProcessingJobRecord): ProcessingJobRecord {
  if (!isWebhookOnlyFailure(job)) return job;
  return {
    ...job,
    status: "complete",
    error_message: null,
    completed_at: job.completed_at ?? new Date().toISOString(),
  };
}

async function syncTerminalJobToSupabase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ProcessingJobRecord,
) {
  if (job.status !== "complete" && job.status !== "failed") return;

  const update: Record<string, unknown> = {
    status: job.status,
    frame_count: job.frame_count,
    processed_count: job.processed_count,
    error_message: job.status === "complete" ? null : job.error_message ?? null,
    completed_at: job.completed_at ?? new Date().toISOString(),
  };

  if (typeof job.average_pci === "number" && Number.isFinite(job.average_pci)) {
    update.average_pci = job.average_pci;
  }
  if (job.output_r2_prefix) {
    update.r2_prefix = job.output_r2_prefix;
  }

  const { error } = await supabase
    .from("jobs")
    .update(update)
    .eq("id", job.job_id)
    .eq("user_id", job.user_id);

  if (error) {
    console.error("job status reconciliation failed:", error.message);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const redis = getRedisClient();
  const raw = await redis.get<string>(`job:${id}`);
  if (!raw) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const redisJob = (typeof raw === "string" ? JSON.parse(raw) : raw) as ProcessingJobRecord;
  const job = normalizeJob(redisJob);
  if (job.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (job !== redisJob) {
    await redis.set(`job:${id}`, JSON.stringify(job));
  }
  await syncTerminalJobToSupabase(supabase, job);

  return NextResponse.json({
    status: job.status,
    processed_count: job.processed_count,
    frame_count: job.frame_count,
    mode: job.mode,
    gps_available: job.gps_available,
    average_pci: job.average_pci ?? null,
    error_message: job.error_message ?? null,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { error } = await supabase
    .from("jobs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
