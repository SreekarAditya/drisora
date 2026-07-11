import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import SurveyMap from "@/components/map/SurveyMap";
import { CrackTypePieChart } from "@/components/results/CrackTypePieChart";
import { ProcessingStatus } from "@/components/results/ProcessingStatus";
import type { RoadSectionFeatureCollection, Survey, SurveyStatus } from "@/types";

interface SurveyResultsPayload { survey: Survey; geojson: RoadSectionFeatureCollection; detectionsSummary: Record<string, number> }
const STATUS_STYLES: Record<SurveyStatus, string> = { uploading: "bg-blue-500/20 text-blue-300", queued: "bg-yellow-500/20 text-yellow-300", processing: "bg-orange-500/20 text-orange-300", complete: "bg-green-500/20 text-green-300", failed: "bg-red-500/20 text-red-300" };

async function fetchResults(id: string): Promise<SurveyResultsPayload> {
  const h = await headers();
  const host = h.get("host");
  if (!host) throw new Error("Missing request host");
  const response = await fetch(`${h.get("x-forwarded-proto") ?? "http"}://${host}/api/survey/${id}/results`, { headers: { cookie: h.get("cookie") ?? "" }, cache: "no-store" });
  if (response.status === 401) redirect("/login");
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error(`Failed to load survey results: ${response.status}`);
  return response.json();
}

export default async function SurveyResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { survey, geojson, detectionsSummary } = await fetchResults(id);
  if (survey.status !== "complete") return <main className="min-h-screen bg-[#09090C] px-6 py-8 text-[#F0F0F4]"><div className="mx-auto max-w-3xl"><div className="flex justify-between"><h1 className="text-3xl font-semibold">{survey.name}</h1><span className={`rounded-full px-3 py-1 text-sm ${STATUS_STYLES[survey.status]}`}>{survey.status}</span></div><section className="mt-8 rounded border border-white/10 p-6"><ProcessingStatus surveyId={survey.id} initialStatus={survey.status} /></section></div></main>;
  return (
    <main className="grid min-h-screen bg-[#09090C] text-[#F0F0F4] lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="h-[58vh] min-h-[520px] lg:h-screen"><SurveyMap geojson={geojson} /></section>
      <aside className="space-y-6 overflow-y-auto border-l border-white/10 p-6 lg:h-screen">
        <header><p className="text-sm uppercase tracking-wide text-[#F5A623]">Legacy survey evidence</p><h1 className="mt-2 text-2xl font-semibold">{survey.name}</h1><p className="mt-1 text-sm text-[#8A8A9A]">{survey.location}</p></header>
        <section className="rounded border border-amber-500/20 bg-amber-500/5 p-5 text-sm leading-6 text-[#C9C9D2]">Legacy point PCI and condition classifications are suppressed. Reprocess with explicit road class, carriageway width, relative AGL, camera calibration, and spatial deduplication to obtain bounds.</section>
        <section className="rounded border border-white/10 p-5"><h2 className="mb-4 text-lg font-medium">Detection classes</h2><CrackTypePieChart detectionsSummary={detectionsSummary} /></section>
      </aside>
    </main>
  );
}
