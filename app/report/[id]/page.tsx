import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";

export default async function LegacySurveyReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();
  const [{ data: survey }, { count: sectionCount }, { count: detectionCount }] = await Promise.all([
    supabase.from("surveys").select("id, name, location, engineer_name, surveyed_at, created_at, status").eq("id", id).maybeSingle(),
    supabase.from("road_sections").select("id", { count: "exact", head: true }).eq("survey_id", id),
    supabase.from("detections").select("id", { count: "exact", head: true }).eq("survey_id", id),
  ]);
  if (!survey) notFound();
  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-white px-12 py-14 text-slate-900">
      <p className="text-sm font-semibold uppercase tracking-widest text-amber-700">Drisora legacy evidence report</p>
      <h1 className="mt-4 text-4xl font-bold">{survey.name}</h1>
      <p className="mt-2 text-slate-500">{survey.location ?? "Location not recorded"}</p>
      <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        Historical point PCI values and their derived condition/intervention labels are intentionally suppressed because this legacy workflow did not satisfy the current six-input measurement contract. Reprocess the source as a configured drone job to produce 100 m PCI bounds.
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric label="Status" value={survey.status} />
        <Metric label="Evidence sections" value={String(sectionCount ?? 0)} />
        <Metric label="Detection rows" value={String(detectionCount ?? 0)} />
        <Metric label="Survey date" value={new Date(survey.surveyed_at ?? survey.created_at).toLocaleDateString("en-IN")} />
      </div>
      <h2 className="mt-10 text-xl font-semibold">Scope</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">Partial IRC:82-2023 PCI assessment requires calibrated cracking extent and pothole number plus explicit nulls for roughness, ravelling, patching, and rut depth. This retained legacy report is an evidence index only; it does not claim a PCI result.</p>
      <p className="mt-12 border-t pt-4 text-xs text-slate-400">Survey {survey.id} · Engineer {survey.engineer_name ?? "not recorded"}</p>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-slate-200 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 font-semibold">{value}</p></div>;
}
