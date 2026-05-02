"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { JobMode, JobStatus } from "@/types";
import { JOB_MODE_LABELS } from "@/types";

interface JobState {
  status: JobStatus;
  processed_count: number;
  frame_count: number;
  mode: JobMode;
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

const PIPELINE_STEPS: JobStatus[] = [
  "extracting_frames",
  "detecting",
  "segmenting",
  "scoring",
];

const STATUS_ORDER: JobStatus[] = ["queued", ...PIPELINE_STEPS, "complete"];
const POLL_MS = 3000;

function ModeBadge({ mode }: { mode: JobMode }) {
  const icons: Record<JobMode, React.ReactNode> = {
    image_batch: (
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <rect x="0.5" y="0.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
        <rect x="6.5" y="0.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
        <rect x="0.5" y="6.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
        <rect x="6.5" y="6.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    ),
    handheld_video: (
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <rect x="0.5" y="2.5" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <path d="M8 4.5l2.5-1.5v5L8 6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    drone_footage: (
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <circle cx="5.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.1" />
        <line x1="1" y1="1" x2="3" y2="3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <line x1="10" y1="1" x2="8" y2="3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <line x1="1" y1="10" x2="3" y2="8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <line x1="10" y1="10" x2="8" y2="8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    ),
  };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2a2a2a] bg-[#141414] px-2.5 py-1 font-mono text-[10px] tracking-widest text-gray-400">
      {icons[mode]}
      {JOB_MODE_LABELS[mode].toUpperCase()}
    </span>
  );
}

function Skeleton({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[#1a1a1a] ${className}`}
      style={{ backgroundImage: "linear-gradient(90deg,#1a1a1a 25%,#222 50%,#1a1a1a 75%)", backgroundSize: "200% 100%", animation: "shimmer-x 1.6s infinite" }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] p-8">
          <Skeleton className="mb-2 h-5 w-40" />
          <Skeleton className="mb-4 h-3.5 w-52" />
          <Skeleton className="mb-6 h-1.5 w-full" />
          <div className="space-y-3">
            {PIPELINE_STEPS.map((s) => (
              <div key={s} className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-3.5 w-32" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollKey, setPollKey] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        if (res.status === 401) { router.push("/login"); return; }
        if (res.status === 403 || res.status === 404) { setError("Job not found."); return; }
        if (!res.ok) { setError(`Unexpected error (${res.status})`); return; }

        const data = (await res.json()) as JobState;
        if (!cancelled) {
          setJob(data);
          if (data.status === "complete") {
            router.push(`/jobs/${id}/results`);
          } else if (data.status !== "failed") {
            setTimeout(poll, POLL_MS);
          }
        }
      } catch {
        if (!cancelled) setError("Failed to load job status.");
      }
    }

    void poll();
    return () => { cancelled = true; };
  }, [id, router, pollKey]);

  async function handleRetry() {
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/jobs/${id}/retry`, { method: "POST" });
      if (!res.ok) {
        setRetryError("Retry failed — please try again.");
        return;
      }
      setJob(null);
      setPollKey((k) => k + 1);
    } catch {
      setRetryError("Retry failed — please try again.");
    } finally {
      setRetrying(false);
    }
  }

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

  if (!job) return <LoadingSkeleton />;

  const pct = job.frame_count > 0
    ? Math.round((job.processed_count / job.frame_count) * 100)
    : null;

  const activeIdx = STATUS_ORDER.indexOf(job.status);
  const isTimeout = job.status === "failed" &&
    (job.error_message?.toLowerCase().includes("timeout") ?? false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="text-2xl font-bold tracking-tight text-white">Drisora</span>
          <ModeBadge mode={job.mode} />
        </div>

        <div className="rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] p-8">
          {job.status === "failed" ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-red-400">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5v-4h2v4H9zm0 2h2v-2H9v2z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">
                {isTimeout ? "Processing timed out" : "Processing failed"}
              </h2>
              {isTimeout ? (
                <p className="mt-2 text-sm text-gray-500">
                  The pipeline took too long and was stopped automatically.
                </p>
              ) : job.error_message ? (
                <p className="mt-2 text-sm text-gray-500">{job.error_message}</p>
              ) : null}
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {retrying && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                )}
                {retrying ? "Retrying…" : "Retry"}
              </button>
              {retryError && (
                <p className="mt-2 text-sm text-red-400">{retryError}</p>
              )}
              {isTimeout && (
                <a
                  href="mailto:support@drisora.com"
                  className="mt-3 block text-sm text-gray-400 underline hover:text-gray-300"
                >
                  Contact support
                </a>
              )}
              <Link
                href="/upload"
                className="mt-3 block text-sm text-gray-500 hover:text-gray-400"
              >
                New survey
              </Link>
            </div>
          ) : job.status === "complete" ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-emerald-400">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">Complete — loading results…</h2>
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
              <ol className="mt-6 space-y-2.5">
                {PIPELINE_STEPS.map((step) => {
                  const stepIdx = STATUS_ORDER.indexOf(step);
                  const done = activeIdx > stepIdx;
                  const active = activeIdx === stepIdx;
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
                            <path d="M10 3.5L4.5 9 2 6.5l-.7.7L4.5 10.4l6.2-7.6L10 3.5z" />
                          </svg>
                        ) : (
                          <span>{stepIdx}</span>
                        )}
                      </span>
                      <span className={`text-sm ${done ? "text-gray-600 line-through" : active ? "font-medium text-white" : "text-gray-600"}`}>
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

        <p className="mt-6 text-center font-mono text-[11px] text-gray-700">
          {id}
        </p>
      </div>
    </main>
  );
}
