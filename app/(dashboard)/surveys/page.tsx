import { redirect } from "next/navigation";
import { SurveyOperationsTable } from "@/components/surveys/SurveyOperationsTable";
import { createClient } from "@/lib/supabase/server";
import type { JobRecord } from "@/types";

export default async function SurveysPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data, error } = await supabase
    .from("jobs")
    .select("id, user_id, project_id, mode, status, frame_count, processed_count, gps_available, average_pci, r2_prefix, created_at, completed_at, error_message, deleted_at")
    .eq("user_id", user.id)
    .neq("status", "complete")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load surveys: ${error.message}`);
  }

  const jobs = (data ?? []) as JobRecord[];
  const active = jobs.filter((job) => !["failed", "uploading"].includes(job.status)).length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const uploading = jobs.filter((job) => job.status === "uploading").length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex flex-col justify-between gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
            Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Surveys</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Track upload, queue, frame extraction, analysis, failures, and reprocessing before a report is ready.
          </p>
        </div>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Active", active, "queued or processing"],
          ["Uploading", uploading, "awaiting submit"],
          ["Failed", failed, "needs attention"],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-[#101113] px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
            <p className="mt-0.5 text-xs text-gray-600">{sub}</p>
          </div>
        ))}
      </section>

      <SurveyOperationsTable jobs={jobs} />
    </main>
  );
}
