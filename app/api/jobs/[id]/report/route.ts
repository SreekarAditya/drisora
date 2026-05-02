import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { getRedisClient } from "@/lib/redis";
import { loadJobResults } from "@/lib/jobs/results";
import { JobReport } from "@/components/pdf/JobReport";
import type { JobMode, ProcessingJobRecord } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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

    const job = (typeof raw === "string" ? JSON.parse(raw) : raw) as ProcessingJobRecord;
    if (job.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (job.status !== "complete") {
      return NextResponse.json({ error: "Job not complete" }, { status: 409 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, organization")
      .eq("id", user.id)
      .single();

    const results = await loadJobResults(id, user.id, job.mode as JobMode);

    const surveyDate = new Date(job.created_at).toLocaleDateString("en-IN", {
      year: "numeric", month: "long", day: "numeric",
    });
    const orgName = profile?.organization ?? profile?.full_name ?? user.email ?? "Unknown";

    const element = createElement(JobReport, {
      results,
      surveyDate,
      orgName,
    }) as unknown as ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(element);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="drisora-report-${id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (error) {
    console.error("job report generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate report" },
      { status: 500 },
    );
  }
}
