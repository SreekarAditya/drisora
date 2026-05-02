"use client";

import Link from "next/link";
import { getPciBand, JOB_MODE_LABELS, ircRecommendation } from "@/types";
import type { JobResults, JobMode } from "@/types";

export function PciChip({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) {
  const band = getPciBand(score);
  const pad = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-block rounded font-mono font-semibold ${pad}`}
      style={{ background: `${band.color}22`, color: band.color, border: `1px solid ${band.color}44` }}
    >
      {score.toFixed(0)} · {band.label}
    </span>
  );
}

interface SummaryBarProps {
  results: JobResults;
  jobId: string;
  surveyDate: string;
  orgName: string;
  extra?: React.ReactNode;
}

export function SummaryBar({ results, jobId, surveyDate, orgName, extra }: SummaryBarProps) {
  const { summary, mode } = results;
  const avgBand = getPciBand(summary.average_pci);

  return (
    <div className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
      <div className="mx-auto max-w-7xl px-6 py-4">
        {/* Top row: breadcrumb + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-400">
              Dashboard
            </Link>
            <span className="text-gray-700">/</span>
            <span className="text-gray-300">{JOB_MODE_LABELS[mode as JobMode]}</span>
            <span className="text-gray-700">/</span>
            <span className="font-mono text-xs text-gray-600">{jobId.slice(0, 8)}…</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/jobs/${jobId}/report`}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#111] px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-amber-500/40 hover:text-amber-400"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 10h8M6 2v6M3.5 5.5L6 8l2.5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download PDF
            </a>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Avg PCI</p>
            <p className="mt-0.5 text-2xl font-semibold" style={{ color: avgBand.color }}>
              {summary.average_pci.toFixed(1)}
              <span className="ml-1.5 text-sm font-normal text-gray-500">{avgBand.label}</span>
            </p>
          </div>
          <div className="h-8 w-px bg-[#1e1e1e]" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Sections</p>
            <p className="mt-0.5 text-2xl font-semibold text-white">{summary.frame_count}</p>
          </div>
          <div className="h-8 w-px bg-[#1e1e1e]" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Worst PCI</p>
            <p className="mt-0.5 text-2xl font-semibold" style={{ color: getPciBand(summary.worst_pci).color }}>
              {summary.worst_pci.toFixed(0)}
            </p>
          </div>
          <div className="h-8 w-px bg-[#1e1e1e]" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Survey date</p>
            <p className="mt-0.5 text-sm text-gray-300">{surveyDate}</p>
          </div>
          <div className="h-8 w-px bg-[#1e1e1e]" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Organization</p>
            <p className="mt-0.5 max-w-[180px] truncate text-sm text-gray-300">{orgName}</p>
          </div>
          <div className="h-8 w-px bg-[#1e1e1e]" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">IRC:82-2023</p>
            <p className={`mt-0.5 text-sm font-medium ${summary.average_pci >= 70 ? "text-emerald-400" : "text-red-400"}`}>
              {summary.average_pci >= 70 ? "Compliant" : "Non-compliant"}
            </p>
          </div>
          {extra}
        </div>
      </div>
    </div>
  );
}

export function NoDetectionsState({ jobId }: { jobId: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-emerald-400">
          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-white">No defects detected</h2>
      <p className="mt-2 max-w-xs text-sm text-gray-500">
        This road section scored PCI 100 — no cracks or damage were found.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <a
          href={`/api/jobs/${jobId}/report`}
          className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
        >
          Download report
        </a>
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-300">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

export { getPciBand, ircRecommendation };
