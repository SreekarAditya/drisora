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
      className="group flex min-h-64 flex-col rounded-lg border border-white/10 bg-[#101113] p-5 transition-colors hover:border-amber-500/40"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
            {project.package_code ?? "Project"}
          </p>
          <h2 className="mt-2 line-clamp-2 text-xl font-semibold tracking-tight text-white group-hover:text-amber-400">
            {project.name}
          </h2>
        </div>
        {band ? (
          <span
            className="shrink-0 rounded-md px-2.5 py-1 font-mono text-xs font-semibold"
            style={{ backgroundColor: `${band.color}22`, color: band.color, border: `1px solid ${band.color}55` }}
          >
            PCI {stats.averagePci?.toFixed(0)}
          </span>
        ) : (
          <span className="shrink-0 rounded-md border border-white/10 px-2.5 py-1 text-xs text-gray-500">
            No PCI
          </span>
        )}
      </div>

      <div className="mt-4 space-y-1 text-sm text-gray-500">
        <p className="line-clamp-1">{project.road_name ?? project.location ?? "Road stretch not recorded"}</p>
        {chainage && <p className="line-clamp-1">{chainage}</p>}
        {project.agency && <p className="line-clamp-1">{project.agency}</p>}
      </div>

      <div className="mt-auto grid grid-cols-3 gap-2 pt-6">
        {[
          ["Linked", stats.linked],
          ["Complete", stats.completed],
          ["Active", stats.active],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-white/10 bg-[#0b0c0d] px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">{label}</p>
            <p className="mt-1 text-lg font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-gray-600">Latest activity {formatDate(stats.lastActivity)}</p>
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

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex flex-col justify-between gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
            Asset portfolio
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Projects</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Group surveys by road stretch, package, or zone so trends, reports, and maintenance decisions stay tied to the asset.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center justify-center rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
        >
          New Project
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Projects", projectRows.length, "asset containers"],
          ["Linked surveys", totalLinked, `${unassigned} unassigned`],
          ["Ready reports", completedReports, "completed outputs"],
          ["Portfolio PCI", portfolioPci == null ? "N/A" : portfolioPci.toFixed(1), portfolioPci == null ? "no PCI yet" : getPciBand(portfolioPci).label],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-[#101113] px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
            <p className="mt-0.5 text-xs text-gray-600">{sub}</p>
          </div>
        ))}
      </section>

      {projectRows.length === 0 ? (
        <section className="mt-8 rounded-lg border border-dashed border-white/15 bg-[#101113] px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-white">Create your first project</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
            A project becomes the single source of truth for repeat surveys, condition trend, causes, treatments, and combined PDF exports.
          </p>
          <Link
            href="/projects/new"
            className="mt-6 inline-flex rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
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
        <section className="mt-8 rounded-lg border border-amber-500/20 bg-amber-500/5 p-5">
          <p className="text-sm text-amber-200">
            {unassigned} survey uploads are not linked to a project yet. Open a project and use the assignment panel to attach them.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Current upload modes include {Object.values(JOB_MODE_LABELS).join(", ")}.
          </p>
        </section>
      )}
    </main>
  );
}
