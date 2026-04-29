import { notFound, redirect } from "next/navigation";
import { CopyShareLinkButton } from "@/components/results/CopyShareLinkButton";
import { ReportDownloadButton } from "@/components/results/ReportDownloadButton";
import { createClient } from "@/lib/supabase/server";
import type { Survey } from "@/types";

export default async function SurveyReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: survey, error } = await supabase
    .from("surveys")
    .select("id, user_id, name, location, engineer_name, surveyed_at, created_at, status, average_pci")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !survey) {
    notFound();
  }

  const typedSurvey = survey as Survey;

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-amber-500">Report</p>
            <h1 className="mt-2 text-3xl font-semibold">{typedSurvey.name}</h1>
            {typedSurvey.location && <p className="mt-1 text-sm text-neutral-400">{typedSurvey.location}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CopyShareLinkButton path={`/report/${id}`} />
            <ReportDownloadButton surveyId={id} />
          </div>
        </header>

        <section className="overflow-hidden rounded border border-neutral-800 bg-neutral-950">
          <iframe
            title={`${typedSurvey.name} report preview`}
            src={`/report/${id}`}
            className="h-[78vh] w-full bg-white"
          />
        </section>
      </div>
    </main>
  );
}
