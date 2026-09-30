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

const STATUS_STYLES: Record<JobStatus, { bg: string; border: string; text: string; dot: string }> = {
  uploading:         { bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.25)", text: "#3B82F6", dot: "#3B82F6" },
  queued:            { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", text: "#8A8A9A", dot: "#4A4A5A" },
  extracting_frames: { bg: "rgba(245,166,35,0.10)",  border: "rgba(245,166,35,0.25)",  text: "#F5A623", dot: "#F5A623" },
  detecting:         { bg: "rgba(245,166,35,0.10)",  border: "rgba(245,166,35,0.25)",  text: "#F5A623", dot: "#F5A623" },
  segmenting:        { bg: "rgba(245,166,35,0.10)",  border: "rgba(245,166,35,0.25)",  text: "#F5A623", dot: "#F5A623" },
  scoring:           { bg: "rgba(245,166,35,0.10)",  border: "rgba(245,166,35,0.25)",  text: "#F5A623", dot: "#F5A623" },
  complete:          { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.25)",   text: "#22C55E", dot: "#22C55E" },
  failed:            { bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.25)",   text: "#EF4444", dot: "#EF4444" },
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
      <section className="flex min-h-[280px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[rgba(255,255,255,0.12)] bg-[#111116] px-6 py-16 text-center">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[14px] border border-[rgba(245,166,35,0.30)] bg-[rgba(245,166,35,0.08)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#F5A623]">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-[18px] font-medium text-white">No active uploads</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8A8A9A]">
          Queued, processing, failed, and uploading surveys will appear here. Completed outputs move to Reports.
        </p>
        <Link
          href="/upload"
          className="mt-6 inline-flex rounded-[10px] bg-[#F5A623] px-5 py-2.5 text-sm font-semibold text-[#09090C] transition-all duration-150 hover:bg-[#FFBE4D]"
        >
          + New Survey
        </Link>
      </section>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#0D0D11]">
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] bg-[#111116] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Upload queue</h2>
            <p className="mt-1 text-[12px] text-[#4A4A5A]">Active and failed surveys — completed outputs move to Reports.</p>
          </div>
          <Link
            href="/upload"
            className="rounded-[10px] bg-[#F5A623] px-4 py-2 text-sm font-semibold text-[#09090C] transition-colors hover:bg-[#FFBE4D]"
          >
            + New Survey
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-[#111116]">
              <tr>
                {["Date", "Mode", "Progress", "PCI", "Status", "Actions"].map((heading) => (
                  <th key={heading} className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#4A4A5A]">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const pct = job.frame_count > 0 ? Math.round((job.processed_count / job.frame_count) * 100) : 0;
                const band = job.average_pci == null ? null : getPciBand(job.average_pci);
                const s = STATUS_STYLES[job.status];
                const isProcessing = !["complete", "failed", "queued"].includes(job.status);
                return (
                  <tr key={job.id} className="border-t border-[rgba(255,255,255,0.05)] transition-colors duration-100 hover:bg-[rgba(255,255,255,0.03)]">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-[#F0F0F4]">{formatDate(job.created_at)}</p>
                      <p className="font-mono text-[10px] text-[#4A4A5A]">{job.id.slice(0, 8)}&hellip;</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center rounded-[6px] border border-[rgba(245,166,35,0.30)] bg-[rgba(245,166,35,0.08)] px-2 py-0.5 font-mono text-[10px] text-[#F5A623]">
                        {JOB_MODE_LABELS[job.mode]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex min-w-40 items-center gap-3">
                        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[rgba(245,166,35,0.15)]">
                          <div className="h-full rounded-full bg-[#F5A623] transition-all duration-300" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono text-[11px] text-[#8A8A9A]">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {band ? (
                        <span className="font-mono text-sm font-medium" style={{ color: band.color }}>
                          {job.average_pci?.toFixed(1)}
                        </span>
                      ) : (
                        <span className="font-mono text-sm text-[#4A4A5A]">N/A</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 font-mono text-[11px] font-medium"
                        style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
                      >
                        <span className={`h-[6px] w-[6px] rounded-full ${isProcessing ? "animate-pulse-dot" : ""}`} style={{ backgroundColor: s.dot }} />
                        {STATUS_LABELS[job.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="rounded-[8px] border border-[rgba(255,255,255,0.10)] px-3 py-1.5 text-xs font-medium text-[#8A8A9A] transition-all duration-100 hover:border-[rgba(245,166,35,0.30)] hover:text-[#F5A623]"
                        >
                          Track
                        </Link>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(job)}
                          className="rounded-[8px] border border-[rgba(255,255,255,0.10)] px-3 py-1.5 text-xs font-medium text-[#8A8A9A] transition-all duration-100 hover:border-[rgba(239,68,68,0.40)] hover:text-[#EF4444]"
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
          <div className="w-full max-w-md rounded-[14px] border border-[rgba(255,255,255,0.12)] bg-[#1A1A22] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
            <h2 className="text-lg font-semibold text-white">Delete survey upload?</h2>
            <p className="mt-2 text-sm leading-6 text-[#8A8A9A]">
              This soft-deletes the upload from Drisora dashboards. It does not remove historical storage objects or completed reports.
            </p>
            {error && <p className="mt-3 rounded-[8px] bg-[rgba(239,68,68,0.10)] border border-[rgba(239,68,68,0.25)] px-3 py-2 text-sm text-[#EF4444]">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-[10px] border border-[rgba(255,255,255,0.10)] px-4 py-2 text-sm font-semibold text-[#8A8A9A] transition-colors hover:border-[rgba(255,255,255,0.20)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-[10px] bg-[#EF4444] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
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
