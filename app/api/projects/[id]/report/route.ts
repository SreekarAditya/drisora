import { renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";
import { ProjectReport } from "@/components/pdf/ProjectReport";
import { createClient } from "@/lib/supabase/server";
import { JOB_MODE_LABELS, type JobMode, type ProjectRecord } from "@/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [{ data: jobs }, { data: surveys }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, mode, status, created_at, project_id")
      .eq("user_id", user.id)
      .eq("project_id", id)
      .is("deleted_at", null),
    supabase
      .from("surveys")
      .select("id, name, status, created_at, project_id")
      .eq("user_id", user.id)
      .eq("project_id", id)
      .is("deleted_at", null),
  ]);

  const reports = [
    ...((jobs ?? []) as Array<{ id: string; mode: JobMode; status: string; created_at: string }>).map((job) => ({
      id: job.id,
      label: JOB_MODE_LABELS[job.mode],
      source: "job" as const,
      status: job.status,
      created_at: job.created_at,
    })),
    ...((surveys ?? []) as Array<{ id: string; name: string; status: string; created_at: string }>).map((survey) => ({
      id: survey.id,
      label: survey.name,
      source: "survey" as const,
      status: survey.status,
      created_at: survey.created_at,
    })),
  ];

  const element = createElement(ProjectReport, {
    project: project as ProjectRecord,
    reports,
  }) as unknown as ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="drisora-project-${id.slice(0, 8)}.pdf"`,
    },
  });
}
