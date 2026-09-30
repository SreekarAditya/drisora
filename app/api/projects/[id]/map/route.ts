import { NextResponse, type NextRequest } from "next/server";
import { loadJobResults } from "@/lib/jobs/results";
import { buildProjectMapCollection, type SurveySectionRow } from "@/lib/project-map";
import { createClient } from "@/lib/supabase/server";
import { JOB_MODE_LABELS, type JobRecord, type Survey } from "@/types";

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

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [{ data: linkedJobs }, { data: linkedSurveys }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, user_id, project_id, mode, status, frame_count, processed_count, gps_available, average_pci, r2_prefix, created_at, completed_at, error_message, deleted_at")
      .eq("user_id", user.id)
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("surveys")
      .select("id, user_id, project_id, name, location, engineer_name, surveyed_at, created_at, status, average_pci, deleted_at")
      .eq("user_id", user.id)
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const jobs = (linkedJobs ?? []) as JobRecord[];
  const surveys = (linkedSurveys ?? []) as Survey[];
  const surveyIds = surveys.map((survey) => survey.id);
  const surveyMetaById = new Map(
    surveys.map((survey) => [
      survey.id,
      { id: survey.id, label: survey.name, created_at: survey.created_at },
    ]),
  );

  const { data: sectionRows } =
    surveyIds.length > 0
      ? await supabase
          .from("road_sections")
          .select("id, survey_id, geom, section_index, pci_score, condition_category, recommended_intervention, priority_rank, length_m, avg_crack_width_mm, max_crack_width_mm, crack_length_m_by_type, possible_causes, recommended_mitigation, maintenance_priority, civil_severity")
          .in("survey_id", surveyIds)
      : { data: [] };

  const completedGpsJobs = jobs.filter(
    (job) => job.status === "complete" && job.gps_available === true,
  );
  const jobResultsSettled = await Promise.allSettled(
    completedGpsJobs.map(async (job) => ({
      meta: {
        id: job.id,
        label: JOB_MODE_LABELS[job.mode],
        created_at: job.created_at,
        mode: job.mode,
      },
      results: await loadJobResults(job.id, user.id, job.mode, {
        includeMediaUrls: false,
      }),
    })),
  );

  const geojson = buildProjectMapCollection({
    surveySections: (sectionRows ?? []) as SurveySectionRow[],
    surveyMetaById,
    jobResults: jobResultsSettled.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    ),
  });

  return NextResponse.json({
    geojson,
    source_counts: {
      survey_sections: (sectionRows ?? []).length,
      gps_jobs: completedGpsJobs.length,
      loaded_gps_jobs: jobResultsSettled.filter((result) => result.status === "fulfilled").length,
    },
  });
}
