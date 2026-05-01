"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type JobStatus =
  | "queued"
  | "extracting_frames"
  | "detecting"
  | "segmenting"
  | "scoring"
  | "complete"
  | "failed";

interface JobState {
  status: JobStatus;
  processed_count: number;
  frame_count: number;
  mode: string;
  gps_available: boolean;
  error_message: string | null;
}

const STATUS_LABELS: Record<JobStatus, string> = {
  queued: "Queued",
  extracting_frames: "Extracting frames",
  detecting: "Detecting cracks",
  segmenting: "Segmenting",
  scoring: "Scoring PCI",
  complete: "Complete",
  failed: "Failed",
};

const STATUS_ORDER: JobStatus[] = [
  "queued",
  "extracting_frames",
  "detecting",
  "segmenting",
  "scoring",
  "complete",
];

const TERMINAL = new Set<JobStatus>(["complete", "failed"]);
const POLL_MS = 3000;

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 403 || res.status === 404) {
          setError("Job not found.");
          return;
        }
        if (!res.ok) {
          setError(`Unexpected error (${res.status})`);
          return;
        }
        const data = (await res.json()) as JobState;
        if (!cancelled) {
          setJob(data);
          if (!TERMINAL.has(data.status)) {
            setTimeout(poll, POLL_MS);
          }
        }
      } catch {
        if (!cancelled) setError("Failed to load job status.");
      }
    }

    void poll();
    return () => { cancelled = true; };
  }, [id, router]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6">
        <div className="text-center">
          <p className="text-sm text-red-400">{error}</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-amber-400 hover:text-amber-300">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-amber-500" />
      </main>
    );
  }

  const pct =
    job.frame_count > 0
      ? Math.round((job.processed_count / job.frame_count) * 100)
      : null;

  const activeStep = STATUS_ORDER.indexOf(job.status);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold tracking-tight text-white">Drisora</span>
          <div className="mt-1 flex items-center justify-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-amber-500" />
            <span className="text-[11px] uppercase tracking-widest text-gray-600">
              Processing
            </span>
            <span className="h-1 w-1 rounded-full bg-amber-500" />
          </div>
        </div>

        <div className="rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] p-8">
          {job.status === "failed" ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-red-400">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9v4h2V9H9zm0 6h2v-2H9v2z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">Processing failed</h2>
              {job.error_message && (
                <p className="mt-2 text-sm text-gray-500">{job.error_message}</p>
              )}
              <Link
                href="/upload"
                className="mt-6 inline-block rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
              >
                Try again
              </Link>
            </div>
          ) : job.status === "complete" ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-emerald-400">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">Survey complete</h2>
              <p className="mt-1 text-sm text-gray-500">
                {job.frame_count} frame{job.frame_count !== 1 ? "s" : ""} processed
                {job.gps_available ? " · GPS available" : ""}
              </p>
              <Link
                href="/dashboard"
                className="mt-6 inline-block rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
              >
                View in dashboard
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-white">
                {STATUS_LABELS[job.status]}…
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {pct !== null
                  ? `${job.processed_count} / ${job.frame_count} frames · ${pct}%`
                  : "Preparing…"}
              </p>

              {/* Progress bar */}
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#1a1a1a]">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500"
                  style={{ width: pct !== null ? `${pct}%` : "0%" }}
                />
              </div>

              {/* Pipeline steps */}
              <ol className="mt-6 space-y-2">
                {STATUS_ORDER.filter((s) => s !== "queued").map((step, i) => {
                  const stepIdx = STATUS_ORDER.indexOf(step);
                  const done = activeStep > stepIdx;
                  const active = activeStep === stepIdx;
                  return (
                    <li key={step} className="flex items-center gap-3">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                          done
                            ? "bg-emerald-500/20 text-emerald-400"
                            : active
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-[#1a1a1a] text-gray-600"
                        }`}
                      >
                        {done ? (
                          <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3">
                            <path d="M10 3L5 8.5 2 5.5l-1 1L5 10.5l6-7-1-0.5z" />
                          </svg>
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span
                        className={`text-sm ${
                          done
                            ? "text-gray-500 line-through"
                            : active
                              ? "font-medium text-white"
                              : "text-gray-600"
                        }`}
                      >
                        {STATUS_LABELS[step]}
                      </span>
                      {active && (
                        <span className="ml-auto h-3 w-3 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-amber-500" />
                      )}
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-700">Job ID: {id}</p>
      </div>
    </main>
  );
}
