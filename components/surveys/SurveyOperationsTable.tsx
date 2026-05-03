"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getPciBand, JOB_MODE_LABELS, type JobRecord, type JobStatus } from "@/types";

interface Props {
  jobs: JobRecord[];
}

const STATUS_LABELS: Record<JobStatus, string> = {
  uploading: "Uploading",
  queued: "Queued",
  extracting_frames: "Extracting frames",
  detecting: "Analyzing",
  segmenting: "Analyzing",
  scoring: "Finalizing",
  complete: "Complete",
  failed: "Failed",
};

const STATUS_STYLE: Record<JobStatus, string> = {
  uploading: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  queued: "border-white/10 bg-white/[0.03] text-gray-400",
  extracting_frames: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  detecting: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  segmenting: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  scoring: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  complete: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  failed: "border-red-500/30 bg-red-500/10 text-red-300",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function SurveyOperationsTable({ jobs }: Props) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<JobRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/jobs/${pendingDelete.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Failed to delete survey");
        return;
      }
      setPendingDelete(null);
      router.refresh();
    } catch {
      setError("Failed to delete survey");
    } finally {
      setDeleting(false);
    }
  }

  if (jobs.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-white/15 bg-[#101113] px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-white">No active uploads</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
          Queued, processing, failed, and uploading surveys will appear here. Completed outputs move to Reports.
        </p>
        <Link
          href="/upload"
          className="mt-6 inline-flex rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
        >
          New Survey
        </Link>
      </section>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-white/10 bg-[#0b0c0d]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Upload queue</h2>
            <p className="mt-1 text-xs text-gray-600">Bulk actions are reserved in the table contract for the next release.</p>
          </div>
          <Link
            href="/upload"
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
          >
            New Survey
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-[#111315]">
              <tr>
                {["Date", "Mode", "Progress", "PCI", "Status", "Actions"].map((heading) => (
                  <th key={heading} className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-gray-600">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const pct = job.frame_count > 0 ? Math.round((job.processed_count / job.frame_count) * 100) : 0;
                const band = job.average_pci == null ? null : getPciBand(job.average_pci);
                return (
                  <tr key={job.id} className="border-t border-white/5">
                    <td className="px-5 py-3">
                      <p className="text-sm text-gray-300">{formatDate(job.created_at)}</p>
                      <p className="font-mono text-[10px] text-gray-700">{job.id.slice(0, 8)}...</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-300">{JOB_MODE_LABELS[job.mode]}</td>
                    <td className="px-5 py-3">
                      <div className="flex min-w-40 items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1a1a1a]">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono text-xs text-gray-600">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm" style={{ color: band?.color ?? "#4b5563" }}>
                      {job.average_pci == null ? "N/A" : job.average_pci.toFixed(1)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[job.status]}`}>
                        {STATUS_LABELS[job.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-amber-500/40 hover:text-amber-400"
                        >
                          Track
                        </Link>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(job)}
                          className="rounded-md border border-red-500/20 px-3 py-1.5 text-xs text-red-300 transition-colors hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#101113] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.6)]">
            <h2 className="text-lg font-semibold text-white">Delete survey upload?</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              This soft-deletes the upload from Drisora dashboards. It does not remove historical storage objects or completed reports.
            </p>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
