import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

interface WebhookBody {
  job_id: string;
  user_id: string;
  status: string;
  error_message?: string;
  average_pci?: number;
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret");
  const expectedSecret = process.env.WORKER_WEBHOOK_SECRET ?? process.env.CLOUDFLARE_R2_WEBHOOK_SECRET;
  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as WebhookBody;

  await updateSupabase(body);

  return NextResponse.json({ ok: true });
}

async function updateSupabase(body: WebhookBody) {
  try {
    const supabase = createServiceRoleClient();
    const update: Record<string, unknown> = {
      status: body.status,
      completed_at: new Date().toISOString(),
      error_message: body.error_message ?? null,
    };
    if (body.average_pci != null) update.average_pci = body.average_pci;
    await supabase.from("jobs").update(update).eq("id", body.job_id);
  } catch (err) {
    console.error("webhook supabase update failed:", err);
  }
}
