import Link from "next/link";
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
    .select("*")
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
      <header className="mb-8 flex flex-col justify-between gap-5 border-b border-[rgba(255,255,255,0.07)] pb-6 md:flex-row md:items-end">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#F5A623]">
            <span className="inline-block h-4 w-[2px] bg-[#F5A623]" />
            Operations
          </p>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-white">Surveys</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#8A8A9A]">
            Track upload, queue, frame extraction, analysis, failures, and reprocessing before a report is ready.
          </p>
        </div>
        <Link
          href="/upload"
          className="rounded-[10px] bg-[#F5A623] px-5 py-2.5 text-sm font-semibold text-[#09090C] transition-all duration-150 hover:bg-[#FFBE4D]"
        >
          + New Survey
        </Link>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active", value: active, sub: "queued or processing", color: active > 0 ? "#F5A623" : undefined },
          { label: "Uploading", value: uploading, sub: "awaiting submit", color: uploading > 0 ? "#3B82F6" : undefined },
          { label: "Failed", value: failed, sub: "needs attention", color: failed > 0 ? "#EF4444" : undefined },
        ].map((s) => (
          <div key={s.label} className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] px-5 py-5">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#8A8A9A]">{s.label}</p>
            <p
              className="mt-2 font-mono text-[24px] font-semibold leading-none"
              style={{ color: s.value === 0 ? "#4A4A5A" : (s.color ?? "#F0F0F4") }}
            >
              {s.value}
            </p>
            <p className="mt-2 text-[12px] text-[#4A4A5A]">{s.sub}</p>
          </div>
        ))}
      </section>

      {jobs.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[rgba(255,255,255,0.12)] bg-[#111116] px-6 py-20 text-center">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[14px] border border-[rgba(245,166,35,0.30)] bg-[rgba(245,166,35,0.08)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#F5A623]">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="text-[18px] font-medium text-white">No active uploads</h3>
          <p className="mt-2 max-w-sm text-sm text-[#8A8A9A]">
            Queued, processing, failed, and uploading surveys will appear here. Completed outputs move to Reports.
          </p>
          <Link
            href="/upload"
            className="mt-6 inline-flex rounded-[10px] bg-[#F5A623] px-5 py-2.5 text-sm font-semibold text-[#09090C] transition-all duration-150 hover:bg-[#FFBE4D]"
          >
            + New Survey
          </Link>
        </div>
      ) : (
        <SurveyOperationsTable jobs={jobs} />
      )}
    </main>
  );
}
