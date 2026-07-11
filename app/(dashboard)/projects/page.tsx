import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { JobRecord, ProjectRecord, Survey } from "@/types";

type ProjectStats = { linked: number; completed: number; active: number; bounded: number; lastActivity: string };

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: projects, error }, { data: jobs }, { data: surveys }] = await Promise.all([
    supabase.from("projects").select("*").eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("jobs").select("*").eq("user_id", user.id).is("deleted_at", null),
    supabase.from("surveys").select("id,user_id,project_id,name,location,engineer_name,surveyed_at,created_at,status,deleted_at").eq("user_id", user.id).is("deleted_at", null),
  ]);
  if (error) throw new Error(`Failed to load projects: ${error.message}`);
  const projectRows = (projects ?? []) as ProjectRecord[];
  const jobRows = (jobs ?? []) as JobRecord[];
  const surveyRows = (surveys ?? []) as Survey[];
  const stats = new Map(projectRows.map((project) => [project.id, projectStats(project, jobRows, surveyRows)]));
  const unassigned = jobRows.filter((row) => !row.project_id).length + surveyRows.filter((row) => !row.project_id).length;
  const bounded = jobRows.filter((row) => row.pci_lower != null && row.pci_upper != null).length;
  const completed = jobRows.filter((row) => row.status === "complete").length + surveyRows.filter((row) => row.status === "complete").length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex flex-col justify-between gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end">
        <div><p className="font-mono text-[11px] uppercase tracking-widest text-[#F5A623]">Asset portfolio</p><h1 className="mt-3 text-3xl font-semibold text-white">Projects</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#8A8A9A]">Group evidence by road stretch. Portfolio point averaging is disabled; current drone jobs retain their own section bounds.</p></div>
        <Link href="/projects/new" className="rounded-[10px] bg-[#F5A623] px-5 py-2.5 text-sm font-semibold text-[#09090C]">New Project</Link>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Projects" value={projectRows.length} note="asset containers" />
        <Metric label="Linked records" value={jobRows.length + surveyRows.length - unassigned} note={`${unassigned} unassigned`} />
        <Metric label="Completed outputs" value={completed} note="evidence reports" />
        <Metric label="Bounded assessments" value={bounded} note="partial PCI intervals" accent />
      </section>
      {projectRows.length === 0 ? <section className="mt-8 rounded-[14px] border border-dashed border-white/10 p-16 text-center"><h2 className="text-lg font-medium text-white">Create your first project</h2><p className="mt-2 text-sm text-[#8A8A9A]">Projects organize repeat survey evidence without inventing a portfolio PCI.</p></section> : (
        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projectRows.map((project) => <ProjectCard key={project.id} project={project} stats={stats.get(project.id)!} />)}</section>
      )}
    </main>
  );
}

function projectStats(project: ProjectRecord, jobs: JobRecord[], surveys: Survey[]): ProjectStats {
  const records = [...jobs.filter((row) => row.project_id === project.id), ...surveys.filter((row) => row.project_id === project.id)];
  const completed = records.filter((row) => row.status === "complete").length;
  return { linked: records.length, completed, active: records.length - completed, bounded: jobs.filter((row) => row.project_id === project.id && row.pci_lower != null && row.pci_upper != null).length, lastActivity: records.map((row) => row.created_at).sort().at(-1) ?? project.created_at };
}

function ProjectCard({ project, stats }: { project: ProjectRecord; stats: ProjectStats }) {
  return <Link href={`/projects/${project.id}`} className="flex min-h-64 flex-col rounded-[14px] border border-white/10 bg-[#111116] p-6 hover:border-[#F5A623]/40"><p className="font-mono text-[11px] uppercase tracking-widest text-[#8A8A9A]">{project.package_code ?? "Project"}</p><h2 className="mt-2 text-xl font-semibold text-white">{project.name}</h2><p className="mt-3 text-sm text-[#8A8A9A]">{project.road_name ?? project.location ?? "Road stretch not recorded"}</p><div className="mt-auto grid grid-cols-4 gap-2 pt-6">{[["Linked", stats.linked], ["Complete", stats.completed], ["Active", stats.active], ["Bounds", stats.bounded]].map(([label, value]) => <div key={label} className="rounded bg-white/[0.04] p-2"><p className="font-mono text-[9px] uppercase text-[#4A4A5A]">{label}</p><p className="mt-1 font-mono text-lg text-white">{value}</p></div>)}</div><p className="mt-4 font-mono text-[10px] text-[#4A4A5A]">Latest {new Date(stats.lastActivity).toLocaleDateString("en-IN")}</p></Link>;
}

function Metric({ label, value, note, accent = false }: { label: string; value: number; note: string; accent?: boolean }) {
  return <div className="rounded-[14px] border border-white/10 bg-[#111116] p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-[#8A8A9A]">{label}</p><p className={`mt-2 font-mono text-2xl font-semibold ${accent ? "text-[#F5A623]" : "text-white"}`}>{value}</p><p className="mt-2 text-xs text-[#4A4A5A]">{note}</p></div>;
}
