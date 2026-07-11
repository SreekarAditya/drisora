import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JOB_MODE_LABELS, type JobMode } from "@/types";

type Row = { id: string; label: string; source: "job" | "survey"; status: string; created_at: string; project_id: string | null; lower: number | null; upper: number | null };

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: jobs }, { data: surveys }, { data: projects }] = await Promise.all([
    supabase.from("jobs").select("*").eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("surveys").select("id,project_id,name,status,created_at,report_path,deleted_at").eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("projects").select("id,name").eq("user_id", user.id).is("deleted_at", null),
  ]);
  const projectNames = new Map((projects ?? []).map((row) => [row.id, row.name]));
  const rows: Row[] = [
    ...((jobs ?? []) as Array<{ id: string; project_id: string | null; mode: JobMode; status: string; pci_lower?: number | null; pci_upper?: number | null; created_at: string }>).map((row) => ({ id: row.id, label: JOB_MODE_LABELS[row.mode], source: "job" as const, status: row.status, created_at: row.created_at, project_id: row.project_id, lower: row.pci_lower ?? null, upper: row.pci_upper ?? null })),
    ...((surveys ?? []) as Array<{ id: string; project_id: string | null; name: string; status: string; created_at: string }>).map((row) => ({ id: row.id, label: row.name, source: "survey" as const, status: row.status, created_at: row.created_at, project_id: row.project_id, lower: null, upper: null })),
  ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const bounded = rows.filter((row) => row.lower != null && row.upper != null).length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="border-b border-white/10 pb-6"><p className="font-mono text-[11px] uppercase tracking-widest text-[#F5A623]">Evidence library</p><h1 className="mt-3 text-3xl font-semibold text-white">Reports</h1><p className="mt-2 text-sm leading-6 text-[#8A8A9A]">Current calibrated drone outputs show PCI intervals. Historical point scores are never mixed into project or portfolio averages.</p></header>
      <section className="mt-6 grid gap-4 sm:grid-cols-3"><Metric label="Records" value={rows.length} /><Metric label="Completed" value={rows.filter((row) => row.status === "complete").length} /><Metric label="Bounded assessments" value={bounded} accent /></section>
      <section className="mt-8 overflow-hidden rounded-[14px] border border-white/10 bg-[#0D0D11]"><div className="overflow-x-auto"><table className="w-full min-w-[820px]"><thead><tr>{["Report", "Project", "Date", "Assessment", "Status", "Action"].map((heading) => <th key={heading} className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-[#4A4A5A]">{heading}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={`${row.source}-${row.id}`} className="border-t border-white/5"><td className="px-5 py-4"><p className="text-sm text-white">{row.label}</p><p className="text-xs text-[#4A4A5A]">{row.source}</p></td><td className="px-5 py-4 text-sm text-[#8A8A9A]">{row.project_id ? projectNames.get(row.project_id) ?? "Project" : "Unassigned"}</td><td className="px-5 py-4 text-sm text-[#8A8A9A]">{new Date(row.created_at).toLocaleDateString("en-IN")}</td><td className="px-5 py-4 font-mono text-xs text-[#F5A623]">{row.lower != null && row.upper != null ? `${row.lower.toFixed(1)}–${row.upper.toFixed(1)}` : row.source === "survey" ? "Legacy point suppressed" : "Detection only"}</td><td className="px-5 py-4 text-xs text-[#8A8A9A]">{row.status}</td><td className="px-5 py-4"><Link href={row.source === "job" ? `/jobs/${row.id}/results` : `/survey/${row.id}`} className="text-xs text-[#F5A623]">View evidence</Link></td></tr>)}</tbody></table></div></section>
    </main>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) { return <div className="rounded-[14px] border border-white/10 bg-[#111116] p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-[#8A8A9A]">{label}</p><p className={`mt-2 text-2xl font-semibold ${accent ? "text-[#F5A623]" : "text-white"}`}>{value}</p></div>; }
