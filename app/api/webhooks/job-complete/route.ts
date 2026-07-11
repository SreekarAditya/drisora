import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { PciBounds } from "@/types";

interface WebhookBody {
  job_id: string;
  user_id: string;
  status: "complete" | "failed";
  error_message?: string;
  pci_complete?: null;
  pci_bounds?: PciBounds | null;
  partial_pci_sections_key?: string | null;
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
    !validBounds(body.pci_bounds) ||
    (body.frame_count != null && (!Number.isInteger(body.frame_count) || body.frame_count < 0)) ||
    (body.processed_count != null && (!Number.isInteger(body.processed_count) || body.processed_count < 0)) ||
    (body.output_r2_prefix != null && typeof body.output_r2_prefix !== "string") ||
    (body.partial_pci_sections_key != null && typeof body.partial_pci_sections_key !== "string");

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
  const baseUpdate: Record<string, unknown> = {
    status: body.status,
    completed_at: new Date().toISOString(),
    error_message: body.error_message ?? null,
    average_pci: null,
  };
  if (body.frame_count != null) baseUpdate.frame_count = body.frame_count;
  if (body.processed_count != null) baseUpdate.processed_count = body.processed_count;
  if (body.output_r2_prefix) baseUpdate.r2_prefix = body.output_r2_prefix;
  const intervalUpdate = {
    ...baseUpdate,
    pci_complete: null,
    pci_lower: body.pci_bounds?.lower ?? null,
    pci_upper: body.pci_bounds?.upper ?? null,
    partial_pci_sections_key: body.partial_pci_sections_key ?? null,
  };

  const { data, error } = await supabase
    .from("jobs")
    .update(intervalUpdate)
    .eq("id", body.job_id)
    .eq("user_id", body.user_id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

function validBounds(bounds: PciBounds | null | undefined) {
  if (bounds == null) return true;
  return Number.isFinite(bounds.lower) && Number.isFinite(bounds.upper) &&
    Number.isFinite(bounds.width) && bounds.lower >= 0 && bounds.upper <= 100 &&
    bounds.lower <= bounds.upper && Math.abs(bounds.width - (bounds.upper - bounds.lower)) < 1e-6;
}
