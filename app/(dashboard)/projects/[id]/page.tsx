import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProjectMapLoader } from "@/components/projects/ProjectMapLoader";
import { ProjectAssignForm } from "@/components/projects/ProjectAssignForm";
import { analyzeDistress } from "@/lib/civil-intelligence";
import { buildProjectMapCollection, type ProjectMapFeatureCollection, type SurveySectionRow } from "@/lib/project-map";
import { createClient } from "@/lib/supabase/server";
import {
  getPciBand,
  JOB_MODE_LABELS,
  PCI_BANDS,
  type JobRecord,
  type ProjectRecord,
  type Survey,
} from "@/types";

type LinkedRecord = {
  id: string;
  label: string;
  status: string;
  average_pci: number | null;
  created_at: string;
  completed_at: string | null;
  source: "job" | "survey";
  mode?: keyof typeof JOB_MODE_LABELS;
};

type DetectionRow = {
  crack_type: string | null;
  severity: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function TrendChart({ records }: { records: LinkedRecord[] }) {
  const trend = records
    .filter((record) => record.average_pci != null)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (trend.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-white/10 bg-[#0b0c0d] text-sm text-gray-600">
        Link at least two completed reports to plot PCI trend.
      </div>
    );
  }

  const width = 640;
  const height = 220;
  const pad = 28;
  const points = trend.map((record, index) => {
    const x = pad + (index / Math.max(1, trend.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (record.average_pci ?? 0) / 100) * (height - pad * 2);
    return { x, y, record };
  });

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-[#0b0c0d] p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
        {[25, 50, 75, 100].map((mark) => {
          const y = pad + (1 - mark / 100) * (height - pad * 2);
          return (
            <g key={mark}>
              <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="#1f2937" strokeWidth="1" />
              <text x="4" y={y + 3} fill="#4b5563" fontSize="10">{mark}</text>
            </g>
          );
        })}
        <polyline
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point) => (
          <circle
            key={point.record.id}
            cx={point.x}
            cy={point.y}
            r="4.5"
            fill={getPciBand(point.record.average_pci ?? 0).color}
            stroke="#0b0c0d"
            strokeWidth="2"
          />
        ))}
      </svg>
    </div>
  );
}

function rankedEntries(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (projectError || !project) notFound();

  const [
    { data: linkedJobs },
    { data: linkedSurveys },
    { data: availableJobs },
    { data: availableSurveys },
  ] = await Promise.all([
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
    supabase
      .from("jobs")
      .select("id, mode, status, average_pci, created_at, project_id")
      .eq("user_id", user.id)
      .is("project_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("surveys")
      .select("id, name, status, average_pci, created_at, project_id")
      .eq("user_id", user.id)
      .is("project_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
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
  const completedGpsJobCount = jobs.filter(
    (job) => job.status === "complete" && job.gps_available === true,
  ).length;

  const [{ data: sectionRows }, { data: detections }] = await Promise.all([
    surveyIds.length > 0
      ? supabase
          .from("road_sections")
          .select("id, survey_id, geom, section_index, pci_score, condition_category, recommended_intervention, priority_rank, length_m, avg_crack_width_mm, max_crack_width_mm, crack_length_m_by_type, possible_causes, recommended_mitigation, maintenance_priority, civil_severity")
          .in("survey_id", surveyIds)
      : Promise.resolve({ data: [] }),
    surveyIds.length > 0
      ? supabase
          .from("detections")
          .select("crack_type, severity")
          .in("survey_id", surveyIds)
      : Promise.resolve({ data: [] }),
  ]);

  const linkedRecords: LinkedRecord[] = [
    ...jobs.map((job) => ({
      id: job.id,
      label: JOB_MODE_LABELS[job.mode],
      status: job.status,
      average_pci: job.average_pci,
      created_at: job.created_at,
      completed_at: job.completed_at,
      source: "job" as const,
      mode: job.mode,
    })),
    ...surveys.map((survey) => ({
      id: survey.id,
      label: survey.name,
      status: survey.status,
      average_pci: survey.average_pci ?? null,
      created_at: survey.created_at,
      completed_at: null,
      source: "survey" as const,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const projectMapCollection = buildProjectMapCollection({
    surveySections: (sectionRows ?? []) as SurveySectionRow[],
    surveyMetaById,
    jobResults: [],
  });

  const sectionPciValues = projectMapCollection.features
    .map((feature) => feature.properties.pci_score)
    .filter((value): value is number => value != null);
  const pciValues = sectionPciValues.length > 0
    ? sectionPciValues
    : linkedRecords
        .map((record) => record.average_pci)
        .filter((value): value is number => value != null);
  const averagePci =
    pciValues.length > 0 ? pciValues.reduce((sum, value) => sum + value, 0) / pciValues.length : null;
  const completed = linkedRecords.filter((record) => record.status === "complete").length;
  const active = linkedRecords.length - completed;
  const conditionCounts = PCI_BANDS.map((band) => ({
    band,
    count: pciValues.filter((value) => value >= band.min && value <= band.max).length,
  }));

  const detectionRows = (detections ?? []) as DetectionRow[];
  const analyses = detectionRows
    .map((detection) =>
      analyzeDistress({
        crackTypes: detection.crack_type ? [detection.crack_type] : [],
        pci: averagePci,
        crackCount: 1,
      }),
    )
    .filter((analysis) => analysis.primaryDistress != null);
  const topCauses = rankedEntries(analyses.flatMap((analysis) => analysis.possibleCauses));
  const topTreatments = rankedEntries(analyses.map((analysis) => analysis.recommendedMitigation));
  const typedProject = project as ProjectRecord;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex flex-col justify-between gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
            {typedProject.package_code ?? "Project dashboard"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{typedProject.name}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            {[typedProject.road_name, typedProject.corridor, typedProject.location].filter(Boolean).join(" · ") ||
              "Road stretch metadata not recorded."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`/api/projects/${typedProject.id}/report`}
            className="rounded-md border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white"
          >
            Combined PDF
          </a>
          <Link
            href="/upload"
            className="rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
          >
            New Survey
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Overall PCI", averagePci == null ? "N/A" : averagePci.toFixed(1), averagePci == null ? "no linked PCI" : getPciBand(averagePci).label],
          ["Linked surveys", linkedRecords.length, `${completed} complete`],
          ["Active queue", active, "in progress or failed"],
          ["Crack records", detectionRows.length, "legacy detections"],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-[#101113] px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
            <p className="mt-0.5 text-xs text-gray-600">{sub}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-lg border border-white/10 bg-[#101113] p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">Aggregated PCI trend</h2>
              <span className="text-xs text-gray-600">Over survey dates</span>
            </div>
            <TrendChart records={linkedRecords} />
          </section>

          <section className="rounded-lg border border-white/10 bg-[#101113] p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">Combined pavement map</h2>
              <span className="text-xs text-gray-600">Campus-wide linked sections and 100 m PCI segments</span>
            </div>
            <ProjectMapLoader
              projectId={typedProject.id}
              initialGeojson={projectMapCollection as ProjectMapFeatureCollection}
              completedGpsJobCount={completedGpsJobCount}
            />
            <div className="mt-4 flex flex-wrap gap-3">
              {PCI_BANDS.map((band) => (
                <span key={band.label} className="inline-flex items-center gap-2 text-xs text-gray-500">
                  <span className="h-2.5 w-7 rounded-sm" style={{ background: band.color }} />
                  {band.label} ({conditionCounts.find((item) => item.band.label === band.label)?.count ?? 0})
                </span>
              ))}
              {projectMapCollection.features.some((feature) => feature.properties.is_relative) && (
                <span className="inline-flex items-center gap-2 text-xs text-gray-500">
                  <span className="h-0.5 w-7 border-t-2 border-dashed border-gray-400" />
                  Relative PCI (&lt;100 m)
                </span>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-white/10 bg-[#101113] p-5">
            <h2 className="text-lg font-semibold text-white">Overall condition</h2>
            <div className="mt-4 space-y-3">
              {conditionCounts.map(({ band, count }) => (
                <div key={band.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-gray-400">{band.label}</span>
                    <span className="font-mono text-gray-600">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#0b0c0d]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pciValues.length > 0 ? (count / pciValues.length) * 100 : 0}%`,
                        background: band.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-[#101113] p-5">
            <h2 className="text-lg font-semibold text-white">Engineering intelligence</h2>
            <div className="mt-4 space-y-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Most common causes</p>
                <ul className="mt-2 space-y-2 text-sm text-gray-300">
                  {(topCauses.length > 0 ? topCauses : [{ label: "Link detection-backed surveys to compute project causes.", count: 0 }]).map((item) => (
                    <li key={item.label} className="rounded-md bg-[#0b0c0d] px-3 py-2">
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Top treatments</p>
                <ul className="mt-2 space-y-2 text-sm text-gray-300">
                  {(topTreatments.length > 0 ? topTreatments : [{ label: "No treatment ranking available yet.", count: 0 }]).map((item) => (
                    <li key={item.label} className="rounded-md bg-[#0b0c0d] px-3 py-2">
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </aside>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">Assign surveys to project</h2>
        <ProjectAssignForm
          projectId={typedProject.id}
          jobs={((availableJobs ?? []) as Array<{ id: string; mode: keyof typeof JOB_MODE_LABELS; status: string; created_at: string }>).map((job) => ({
            id: job.id,
            label: JOB_MODE_LABELS[job.mode],
            meta: `${job.status} · ${formatDate(job.created_at)}`,
            source: "job" as const,
          }))}
          surveys={((availableSurveys ?? []) as Array<{ id: string; name: string; status: string; created_at: string }>).map((survey) => ({
            id: survey.id,
            label: survey.name,
            meta: `${survey.status} · ${formatDate(survey.created_at)}`,
            source: "survey" as const,
          }))}
        />
      </section>

      <section className="mt-8 overflow-hidden rounded-lg border border-white/10 bg-[#0b0c0d]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Linked surveys and reports</h2>
          <span className="text-xs text-gray-600">{linkedRecords.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-[#111315]">
              <tr>
                {["Name", "Source", "Date", "PCI", "Status", "Actions"].map((heading) => (
                  <th key={heading} className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-gray-600">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linkedRecords.map((record) => {
                const band = record.average_pci == null ? null : getPciBand(record.average_pci);
                return (
                  <tr key={`${record.source}-${record.id}`} className="border-t border-white/5">
                    <td className="px-5 py-3 text-sm text-gray-300">{record.label}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{record.source === "job" ? "Upload job" : "Survey"}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{formatDate(record.created_at)}</td>
                    <td className="px-5 py-3 font-mono text-sm" style={{ color: band?.color ?? "#4b5563" }}>
                      {record.average_pci == null ? "N/A" : record.average_pci.toFixed(1)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-gray-400">
                        {record.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={record.source === "job" ? `/jobs/${record.id}/results` : `/survey/${record.id}`}
                          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-amber-500/40 hover:text-amber-400"
                        >
                          View
                        </Link>
                        {record.status === "complete" && (
                          <a
                            href={record.source === "job" ? `/api/jobs/${record.id}/report` : `/api/survey/${record.id}/report`}
                            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-amber-500/40 hover:text-amber-400"
                          >
                            PDF
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {linkedRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-600">
                    No surveys linked yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
