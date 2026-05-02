import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRedisClient } from "@/lib/redis";
import type { JobRecord } from "@/app/api/jobs/create/route";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: job } = await supabase
    .from("jobs")
    .select("id, user_id, status")
    .eq("id", id)
    .single();

  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (job.status !== "failed") {
    return NextResponse.json({ error: "Job is not in failed state" }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from("jobs")
    .update({ status: "queued", error_message: null, processed_count: 0, completed_at: null })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to reset job" }, { status: 500 });
  }

  const redis = getRedisClient();
  const raw = await redis.get<string>(`job:${id}`);
  if (raw) {
    const redisJob = (typeof raw === "string" ? JSON.parse(raw) : raw) as JobRecord;
    redisJob.status = "queued";
    redisJob.error_message = null;
    redisJob.processed_count = 0;
    redisJob.last_updated = new Date().toISOString();
    await redis.set(`job:${id}`, JSON.stringify(redisJob));
  }

  return NextResponse.json({ ok: true });
}
