import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProjectAssignForm } from "@/components/projects/ProjectAssignForm";
import { ProjectMapLoader } from "@/components/projects/ProjectMapLoader";
import { buildProjectMapCollection, type ProjectMapFeatureCollection, type SurveySectionRow } from "@/lib/project-map";
import { createClient } from "@/lib/supabase/server";
import { JOB_MODE_LABELS, type JobMode, type JobRecord, type ProjectRecord, type Survey } from "@/types";

type Linked = { id: string; label: string; source: "job" | "survey"; status: string; created_at: string; lower: number | null; upper: number | null };

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
  if (!project) notFound();
  const [{ data: jobData }, { data: surveyData }, { data: availableJobs }, { data: availableSurveys }] = await Promise.all([
    supabase.from("jobs").select("*").eq("user_id", user.id).eq("project_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("surveys").select("id,user_id,project_id,name,location,engineer_name,surveyed_at,created_at,status,deleted_at").eq("user_id", user.id).eq("project_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("jobs").select("id,mode,status,created_at,project_id").eq("user_id", user.id).is("project_id", null).is("deleted_at", null).limit(50),
    supabase.from("surveys").select("id,name,status,created_at,project_id").eq("user_id", user.id).is("project_id", null).is("deleted_at", null).limit(50),
  ]);
  const jobs = (jobData ?? []) as JobRecord[];
  const surveys = (surveyData ?? []) as Survey[];
  const surveyIds = surveys.map((row) => row.id);
  const { data: sectionRows } = surveyIds.length ? await supabase.from("road_sections").select("id,survey_id,geom,section_index,length_m,avg_crack_width_mm,max_crack_width_mm,crack_length_m_by_type").in("survey_id", surveyIds) : { data: [] };
  const map = buildProjectMapCollection({ surveySections: (sectionRows ?? []) as SurveySectionRow[], surveyMetaById: new Map(surveys.map((row) => [row.id, { id: row.id, label: row.name, created_at: row.created_at }])), jobResults: [] });
  const linked: Linked[] = [...jobs.map((row) => ({ id: row.id, label: JOB_MODE_LABELS[row.mode], source: "job" as const, status: row.status, created_at: row.created_at, lower: row.pci_lower ?? null, upper: row.pci_upper ?? null })), ...surveys.map((row) => ({ id: row.id, label: row.name, source: "survey" as const, status: row.status, created_at: row.created_at, lower: null, upper: null }))].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const typed = project as ProjectRecord;
  const complete = linked.filter((row) => row.status === "complete").length;
  const bounded = linked.filter((row) => row.lower != null && row.upper != null).length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[#4A4A5A]">{typed.package_code ?? "Project"}</p><h1 className="mt-2 text-3xl font-semibold text-white">{typed.name}</h1><p className="mt-2 text-sm text-[#8A8A9A]">{[typed.road_name, typed.corridor, typed.location].filter(Boolean).join(" · ")}</p></div><div className="flex gap-3"><a href={`/api/projects/${typed.id}/report`} className="rounded border border-white/10 px-4 py-2 text-sm text-white">Evidence PDF</a><Link href="/upload" className="rounded bg-[#F5A623] px-4 py-2 text-sm font-semibold text-[#09090C]">New Survey</Link></div></header>
      <section className="mt-8 grid gap-4 sm:grid-cols-4"><Metric label="Linked records" value={linked.length} /><Metric label="Completed" value={complete} /><Metric label="Bounded jobs" value={bounded} accent /><Metric label="Legacy evidence" value={surveys.length} /></section>
      <section className="mt-8 rounded-lg border border-white/10 bg-[#101113] p-5"><div className="mb-4"><h2 className="text-lg font-semibold text-white">Combined evidence map</h2><p className="mt-1 text-xs text-[#8A8A9A]">Current jobs display intervals; historical point values are suppressed.</p></div><ProjectMapLoader projectId={typed.id} initialGeojson={map as ProjectMapFeatureCollection} completedGpsJobCount={jobs.filter((row) => row.status === "complete" && row.gps_available).length} /></section>
      <section className="mt-8"><h2 className="mb-4 text-lg font-semibold text-white">Assign surveys to project</h2><ProjectAssignForm projectId={typed.id} jobs={((availableJobs ?? []) as Array<{ id: string; mode: JobMode; status: string; created_at: string }>).map((row) => ({ id: row.id, label: JOB_MODE_LABELS[row.mode], meta: `${row.status} · ${formatDate(row.created_at)}`, source: "job" as const }))} surveys={((availableSurveys ?? []) as Array<{ id: string; name: string; status: string; created_at: string }>).map((row) => ({ id: row.id, label: row.name, meta: `${row.status} · ${formatDate(row.created_at)}`, source: "survey" as const }))} /></section>
      <section className="mt-8 overflow-hidden rounded-lg border border-white/10"><div className="border-b border-white/10 px-5 py-4"><h2 className="text-lg font-semibold text-white">Linked evidence</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[720px]"><thead><tr>{["Name", "Source", "Date", "Assessment", "Status", "Action"].map((heading) => <th key={heading} className="px-5 py-3 text-left font-mono text-[10px] uppercase text-[#4A4A5A]">{heading}</th>)}</tr></thead><tbody>{linked.map((row) => <tr key={`${row.source}-${row.id}`} className="border-t border-white/5"><td className="px-5 py-3 text-sm text-white">{row.label}</td><td className="px-5 py-3 text-xs text-[#8A8A9A]">{row.source}</td><td className="px-5 py-3 text-sm text-[#8A8A9A]">{formatDate(row.created_at)}</td><td className="px-5 py-3 font-mono text-xs text-[#F5A623]">{row.lower != null && row.upper != null ? `${row.lower.toFixed(1)}–${row.upper.toFixed(1)}` : row.source === "survey" ? "Legacy point suppressed" : "Detection only"}</td><td className="px-5 py-3 text-xs text-[#8A8A9A]">{row.status}</td><td className="px-5 py-3"><Link href={row.source === "job" ? `/jobs/${row.id}/results` : `/survey/${row.id}`} className="text-xs text-[#F5A623]">View</Link></td></tr>)}</tbody></table></div></section>
    </main>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) { return <div className="rounded border border-white/10 bg-[#101113] p-5"><p className="font-mono text-[10px] uppercase text-[#4A4A5A]">{label}</p><p className={`mt-2 text-2xl font-semibold ${accent ? "text-[#F5A623]" : "text-white"}`}>{value}</p></div>; }
function formatDate(value: string) { return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
