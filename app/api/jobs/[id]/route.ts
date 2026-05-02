import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRedisClient } from "@/lib/redis";
import type { ProcessingJobRecord } from "@/types";

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

  const job = (typeof raw === "string" ? JSON.parse(raw) : raw) as ProcessingJobRecord;
  if (job.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    status: job.status,
    processed_count: job.processed_count,
    frame_count: job.frame_count,
    mode: job.mode,
    gps_available: job.gps_available,
    error_message: job.error_message ?? null,
  });
}
