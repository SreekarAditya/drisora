import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import SurveyMap from "@/components/map/SurveyMap";
import { ConditionBreakdown } from "@/components/results/ConditionBreakdown";
import { CrackTypePieChart } from "@/components/results/CrackTypePieChart";
import { PCIGauge } from "@/components/results/PCIGauge";
import { PrioritySections } from "@/components/results/PrioritySections";
import { ProcessingStatus } from "@/components/results/ProcessingStatus";
import type { RoadSectionFeatureCollection, Survey, SurveyStatus } from "@/types";

interface SurveyResultsPayload {
  survey: Survey;
  geojson: RoadSectionFeatureCollection;
  detectionsSummary: Record<string, number>;
}

const STATUS_STYLES: Record<SurveyStatus, string> = {
  uploading: "bg-blue-500/20 text-blue-300",
  queued: "bg-yellow-500/20 text-yellow-300",
  processing: "bg-orange-500/20 text-orange-300",
  complete: "bg-green-500/20 text-green-300",
  failed: "bg-red-500/20 text-red-300",
};

async function fetchResults(id: string): Promise<SurveyResultsPayload> {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  if (!host) {
    throw new Error("Missing request host");
  }

  const response = await fetch(`${protocol}://${host}/api/survey/${id}/results`, {
    headers: {
      cookie: headerStore.get("cookie") ?? "",
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    redirect("/login");
  }

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    throw new Error(`Failed to load survey results: ${response.status}`);
  }

  return response.json();
}

export default async function SurveyResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { survey, geojson, detectionsSummary } = await fetchResults(id);
  const sections = geojson.features.map((feature) => feature.properties);
  const averagePci =
    survey.average_pci ??
    (sections.length > 0
      ? sections.reduce((sum, section) => sum + (section.pci_score ?? 0), 0) / sections.length
      : 0);

  if (survey.status !== "complete") {
    return (
      <main className="min-h-screen bg-[#09090C] px-6 py-8 text-[#F0F0F4]">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-[#F5A623]">Survey results</p>
              <h1 className="mt-2 text-3xl font-semibold">{survey.name}</h1>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLES[survey.status]}`}>
              {survey.status}
            </span>
          </div>

          <section className="rounded border border-[rgba(255,255,255,0.07)] bg-[#09090C] p-6">
            <h2 className="mb-5 text-lg font-medium">Processing</h2>
            <ProcessingStatus surveyId={survey.id} initialStatus={survey.status} />
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen bg-[#09090C] text-[#F0F0F4] lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="h-[58vh] min-h-[520px] lg:h-screen">
        <SurveyMap geojson={geojson} />
      </section>

      <aside className="space-y-6 overflow-y-auto border-l border-[rgba(255,255,255,0.07)] bg-[#09090C] p-6 lg:h-screen">
        <header>
          <p className="text-sm uppercase tracking-wide text-[#F5A623]">Survey results</p>
          <h1 className="mt-2 text-2xl font-semibold">{survey.name}</h1>
          {survey.location && <p className="mt-1 text-sm text-[#8A8A9A]">{survey.location}</p>}
        </header>

        <section className="rounded border border-[rgba(255,255,255,0.07)] bg-[#09090C] p-5">
          <PCIGauge averagePci={averagePci} />
        </section>

        <section className="rounded border border-[rgba(255,255,255,0.07)] bg-[#09090C] p-5">
          <h2 className="mb-4 text-lg font-medium">Condition Breakdown</h2>
          <ConditionBreakdown sections={sections} />
        </section>

        <section className="rounded border border-[rgba(255,255,255,0.07)] bg-[#09090C] p-5">
          <h2 className="mb-4 text-lg font-medium">Priority Sections</h2>
          <PrioritySections sections={sections} />
        </section>

        <section className="rounded border border-[rgba(255,255,255,0.07)] bg-[#09090C] p-5">
          <h2 className="mb-4 text-lg font-medium">Crack Types</h2>
          <CrackTypePieChart detectionsSummary={detectionsSummary} />
        </section>
      </aside>
    </main>
  );
}
