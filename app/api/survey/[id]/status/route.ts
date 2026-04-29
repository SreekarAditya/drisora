import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function stageLabel(status: string | null): string | null {
  if (!status) return null;

  const labels: Record<string, string> = {
    queued: "Queued",
    extracting_frames: "Extracting frames",
    running_detection: "Running crack detection",
    scoring: "Scoring pavement condition",
    generating_report: "Generating report",
    complete: "Complete",
    failed: "Failed",
  };

  return labels[status] ?? status;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: survey } = await supabase
    .from("surveys")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      while (!closed) {
        const { data } = await supabase
          .from("jobs")
          .select("status, progress, current_frame, total_frames")
          .eq("survey_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const payload = {
          status: data?.status ?? null,
          stage_label: stageLabel(data?.status ?? null),
          progress: data?.progress ?? 0,
          current_frame: data?.current_frame ?? 0,
          total_frames: data?.total_frames ?? 0,
        };

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

        if (payload.status === "complete" || payload.status === "failed") {
          closed = true;
          controller.close();
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
