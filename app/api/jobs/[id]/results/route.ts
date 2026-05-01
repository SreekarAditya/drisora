import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRedisClient } from "@/lib/redis";
import { loadJobResults } from "@/lib/jobs/results";
import type { JobRecord } from "@/app/api/jobs/create/route";
import type { JobMode } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const redis = getRedisClient();
  const raw = await redis.get<string>(`job:${id}`);
  if (!raw) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const job = (typeof raw === "string" ? JSON.parse(raw) : raw) as JobRecord;
  if (job.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (job.status !== "complete") {
    return NextResponse.json({ error: "Job not complete" }, { status: 409 });
  }

  const results = await loadJobResults(id, user.id, job.mode as JobMode);
  return NextResponse.json(results);
}
