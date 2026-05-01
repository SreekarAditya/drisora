import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

interface WebhookBody {
  job_id: string;
  user_id: string;
  status: string;
  error_message?: string;
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WORKER_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as WebhookBody;

  void updateSupabase(body);

  return NextResponse.json({ ok: true });
}

async function updateSupabase(body: WebhookBody) {
  try {
    const supabase = createServiceRoleClient();
    await supabase
      .from("jobs")
      .update({
        status: body.status,
        completed_at: new Date().toISOString(),
        error_message: body.error_message ?? null,
      })
      .eq("id", body.job_id);
  } catch (err) {
    console.error("webhook supabase update failed:", err);
  }
}
