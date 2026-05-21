import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPciBand, JOB_MODE_LABELS, type JobRecord, type ProjectRecord, type Survey } from "@/types";

type ProjectStats = {
  linked: number;
  completed: number;
  active: number;
  averagePci: number | null;
  lastActivity: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "No activity";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function projectStats(project: ProjectRecord, jobs: JobRecord[], surveys: Survey[]): ProjectStats {
  const projectJobs = jobs.filter((job) => job.project_id === project.id);
  const projectSurveys = surveys.filter((survey) => survey.project_id === project.id);
  const records = [...projectJobs, ...projectSurveys];
  const pciValues = records
    .map((record) => record.average_pci)
    .filter((value): value is number => value != null);
  const completed =
    projectJobs.filter((job) => job.status === "complete").length +
    projectSurveys.filter((survey) => survey.status === "complete").length;
  const active = records.length - completed;
  const lastActivity = records
    .map((record) => record.created_at)
    .filter(Boolean)
    .sort()
    .at(-1) ?? project.created_at;

  return {
    linked: records.length,
    completed,
    active,
    averagePci: pciValues.length > 0 ? pciValues.reduce((sum, value) => sum + value, 0) / pciValues.length : null,
    lastActivity,
  };
}

function ProjectCard({
  project,
  stats,
}: {
  project: ProjectRecord;
  stats: ProjectStats;
}) {
  const band = stats.averagePci == null ? null : getPciBand(stats.averagePci);
  const chainage =
    project.start_chainage_km != null && project.end_chainage_km != null
      ? `Km ${project.start_chainage_km.toFixed(3)} to ${project.end_chainage_km.toFixed(3)}`
      : project.corridor;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex min-h-64 flex-col rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] p-6 transition-all duration-200 hover:border-[rgba(245,166,35,0.35)] hover:bg-[rgba(245,166,35,0.03)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#8A8A9A]">
            {project.package_code ?? "Project"}
          </p>
          <h2 className="mt-2 line-clamp-2 text-xl font-semibold tracking-tight text-white group-hover:text-[#F5A623] transition-colors duration-150">
            {project.name}
          </h2>
        </div>
        {band ? (
          <div className="flex shrink-0 flex-col items-center gap-1">
            <div
              className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5"
              style={{
                backgroundColor: `${band.color}15`,
                border: `1px solid ${band.color}40`,
                borderLeft: `4px solid ${band.color}`,
              }}
            >
              <span className="font-mono text-[18px] font-medium" style={{ color: band.color }}>
                {stats.averagePci?.toFixed(0)}
              </span>
            </div>
            <span className="font-mono text-[10px] text-[#8A8A9A]">{band.label}</span>
          </div>
        ) : (
          <span className="shrink-0 rounded-[8px] border border-[rgba(255,255,255,0.10)] px-3 py-1.5 font-mono text-[11px] text-[#4A4A5A]">
            No PCI
          </span>
        )}
      </div>

      <div className="mt-4 space-y-1 text-[13px] text-[#8A8A9A]">
        <p className="line-clamp-1">{project.road_name ?? project.location ?? "Road stretch not recorded"}</p>
        {chainage && <p className="line-clamp-1 font-mono text-[12px]">{chainage}</p>}
        {project.agency && <p className="line-clamp-1 italic">{project.agency}</p>}
      </div>

      <div className="mt-auto grid grid-cols-3 gap-2 pt-6">
        {([
          ["Linked", stats.linked],
          ["Complete", stats.completed],
          ["Active", stats.active],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-[8px] bg-[rgba(255,255,255,0.04)] px-3 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#4A4A5A]">{label}</p>
            <p className="mt-1 font-mono text-lg font-medium text-white">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 font-mono text-[11px] text-[#4A4A5A]">Latest activity {formatDate(stats.lastActivity)}</p>
    </Link>
  );
}

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const [{ data: projects, error: projectError }, { data: jobs }, { data: surveys }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("id, user_id, project_id, mode, status, frame_count, processed_count, gps_available, average_pci, r2_prefix, created_at, completed_at, error_message, deleted_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("surveys")
      .select("id, user_id, project_id, name, location, engineer_name, surveyed_at, created_at, status, average_pci, deleted_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (projectError) {
    throw new Error(`Failed to load projects: ${projectError.message}`);
  }

  const projectRows = (projects ?? []) as ProjectRecord[];
  const jobRows = (jobs ?? []) as JobRecord[];
  const surveyRows = (surveys ?? []) as Survey[];
  const totalLinked = jobRows.filter((job) => job.project_id).length + surveyRows.filter((survey) => survey.project_id).length;
  const unassigned = jobRows.filter((job) => !job.project_id).length + surveyRows.filter((survey) => !survey.project_id).length;
  const completedReports = jobRows.filter((job) => job.status === "complete").length + surveyRows.filter((survey) => survey.status === "complete").length;
  const projectPciValues = projectRows
    .map((project) => projectStats(project, jobRows, surveyRows).averagePci)
    .filter((value): value is number => value != null);
  const portfolioPci =
    projectPciValues.length > 0
      ? projectPciValues.reduce((sum, value) => sum + value, 0) / projectPciValues.length
      : null;

  const statItems = [
    { label: "Projects", value: projectRows.length, sub: "asset containers", color: undefined as string | undefined },
    { label: "Linked surveys", value: totalLinked, sub: `${unassigned} unassigned`, color: totalLinked > 0 ? "#F5A623" : undefined },
    { label: "Ready reports", value: completedReports, sub: "completed outputs", color: completedReports > 0 ? "#22C55E" : undefined },
    { label: "Portfolio PCI", value: portfolioPci == null ? "N/A" : portfolioPci.toFixed(1), sub: portfolioPci == null ? "no PCI yet" : getPciBand(portfolioPci).label, color: portfolioPci != null ? getPciBand(portfolioPci).color : undefined },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex flex-col justify-between gap-5 border-b border-[rgba(255,255,255,0.07)] pb-6 md:flex-row md:items-end">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#F5A623]">
            <span className="inline-block h-4 w-[2px] bg-[#F5A623]" />
            Asset portfolio
          </p>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-white">Projects</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#8A8A9A]">
            Group surveys by road stretch, package, or zone so trends, reports, and maintenance decisions stay tied to the asset.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center justify-center rounded-[10px] bg-[#F5A623] px-5 py-2.5 text-sm font-semibold text-[#09090C] transition-all duration-150 hover:bg-[#FFBE4D]"
        >
          New Project
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statItems.map((s) => {
          const isZero = s.value === 0 || s.value === "N/A";
          return (
            <div key={s.label} className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] px-5 py-5">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#8A8A9A]">{s.label}</p>
              <p
                className="mt-2 font-mono text-[24px] font-semibold leading-none"
                style={{ color: isZero ? "#4A4A5A" : (s.color ?? "#F0F0F4") }}
              >
                {s.value}
              </p>
              <p className="mt-2 text-[12px] text-[#4A4A5A]">{s.sub}</p>
            </div>
          );
        })}
      </section>

      {projectRows.length === 0 ? (
        <section className="mt-8 flex min-h-[280px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[rgba(255,255,255,0.12)] bg-[#111116] px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] border border-[rgba(245,166,35,0.30)] bg-[rgba(245,166,35,0.08)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#F5A623]">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-[18px] font-medium text-white">Create your first project</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8A8A9A]">
            A project becomes the single source of truth for repeat surveys, condition trend, causes, treatments, and combined PDF exports.
          </p>
          <Link
            href="/projects/new"
            className="mt-6 inline-flex rounded-[10px] bg-[#F5A623] px-5 py-2.5 text-sm font-semibold text-[#09090C] transition-all duration-150 hover:bg-[#FFBE4D]"
          >
            Create project
          </Link>
        </section>
      ) : (
        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projectRows.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              stats={projectStats(project, jobRows, surveyRows)}
            />
          ))}
        </section>
      )}

      {unassigned > 0 && (
        <section className="mt-8 rounded-[14px] border border-[rgba(245,166,35,0.25)] bg-[rgba(245,166,35,0.08)] p-5">
          <div className="flex items-start gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-[#F5A623]">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div>
              <p className="text-sm font-medium text-[#F5A623]">
                {unassigned} survey uploads are not linked to a project yet.
              </p>
              <p className="mt-1 text-[13px] text-[#8A8A9A]">
                Open a project and use the assignment panel to attach them.
              </p>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
