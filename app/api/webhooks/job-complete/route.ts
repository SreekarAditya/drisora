import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

interface WebhookBody {
  job_id: string;
  user_id: string;
  status: "complete" | "failed";
  error_message?: string;
  average_pci?: number;
  frame_count?: number;
  processed_count?: number;
  output_r2_prefix?: string;
}

const VALID_STATUSES = new Set(["complete", "failed"]);

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret");
  const expectedSecret = process.env.WORKER_WEBHOOK_SECRET ?? process.env.CLOUDFLARE_R2_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 });
  }
  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const invalidBody =
    typeof body.job_id !== "string" ||
    body.job_id.length === 0 ||
    typeof body.user_id !== "string" ||
    body.user_id.length === 0 ||
    !VALID_STATUSES.has(body.status) ||
    (body.average_pci != null && !Number.isFinite(body.average_pci)) ||
    (body.frame_count != null && (!Number.isInteger(body.frame_count) || body.frame_count < 0)) ||
    (body.processed_count != null && (!Number.isInteger(body.processed_count) || body.processed_count < 0)) ||
    (body.output_r2_prefix != null && typeof body.output_r2_prefix !== "string");

  if (invalidBody) {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  try {
    const updated = await updateSupabase(body);
    if (!updated) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
  } catch (err) {
    console.error("webhook supabase update failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update job" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

async function updateSupabase(body: WebhookBody) {
  const supabase = createServiceRoleClient();
  const update: Record<string, unknown> = {
    status: body.status,
    completed_at: new Date().toISOString(),
    error_message: body.error_message ?? null,
  };
  if (body.average_pci != null) update.average_pci = body.average_pci;
  if (body.frame_count != null) update.frame_count = body.frame_count;
  if (body.processed_count != null) update.processed_count = body.processed_count;
  if (body.output_r2_prefix) update.r2_prefix = body.output_r2_prefix;

  const { data, error } = await supabase
    .from("jobs")
    .update(update)
    .eq("id", body.job_id)
    .eq("user_id", body.user_id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}
