"use client";

import Link from "next/link";
import { JOB_MODE_LABELS } from "@/types";
import type { JobMode, JobResults, PciBounds } from "@/types";

export const PARTIAL_PCI_SCOPE =
  "Partial IRC:82-2023 PCI assessment: 2 of 6 functional parameters instrumented (cracking extent, pothole number; 28% of composite weight). Roughness, ravelling, patching, and rut depth require instrumented survey (ARSS/NSV or manual per IRC:82-2023 Appendix-1) and are not measured. PCI reported as bounds, not a point estimate.";

export function PciBoundsChip({ bounds, size = "sm" }: { bounds: PciBounds | null; size?: "sm" | "lg" }) {
  const pad = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-block rounded border border-[rgba(245,166,35,0.32)] bg-[rgba(245,166,35,0.08)] font-mono font-semibold text-[#F5A623] ${pad}`}
    >
      {bounds ? `PCI ${bounds.lower.toFixed(1)}–${bounds.upper.toFixed(1)}` : "PCI not computed"}
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
  return (
    <div className="border-b border-[rgba(255,255,255,0.07)] bg-[#0D0D11]">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/dashboard" className="text-[#8A8A9A] transition-colors hover:text-[#F0F0F4]">
              Dashboard
            </Link>
            <span className="text-[#4A4A5A]">/</span>
            <span className="text-[#F0F0F4]">{JOB_MODE_LABELS[mode as JobMode]}</span>
            <span className="text-[#4A4A5A]">/</span>
            <span className="font-mono text-xs text-[#4A4A5A]">{jobId.slice(0, 8)}…</span>
          </div>
          <a
            href={`/api/jobs/${jobId}/report`}
            className="rounded-[8px] border border-[rgba(255,255,255,0.10)] bg-[#111116] px-3 py-1.5 text-xs font-medium text-[#8A8A9A] transition-colors hover:text-[#F5A623]"
          >
            Download evidence PDF
          </a>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-6">
          <Stat label="PCI result">
            <PciBoundsChip bounds={summary.pci_bounds} size="lg" />
          </Stat>
          <Divider />
          <Stat label="Instrumented weight" value={`${Math.round(summary.measured_weight_fraction * 100)}%`} />
          <Divider />
          <Stat label="100 m sections" value={String(summary.segment_count)} />
          <Divider />
          <Stat label="Evidence frames" value={String(summary.frame_count)} />
          <Divider />
          <Stat label="Survey date" value={surveyDate} compact />
          <Divider />
          <Stat label="Organization" value={orgName} compact />
          {extra}
        </div>

        <p className="mt-4 max-w-5xl text-xs leading-5 text-[#8A8A9A]">{PARTIAL_PCI_SCOPE}</p>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px bg-[rgba(255,255,255,0.07)]" />;
}

function Stat({ label, value, compact = false, children }: { label: string; value?: string; compact?: boolean; children?: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-[#4A4A5A]">{label}</p>
      {children ?? (
        <p className={`${compact ? "text-sm" : "font-mono text-2xl font-semibold"} mt-0.5 max-w-[190px] truncate text-[#F0F0F4]`}>
          {value}
        </p>
      )}
    </div>
  );
}

export function NoDetectionsState({ jobId }: { jobId: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[14px] border border-[rgba(245,166,35,0.30)] bg-[rgba(245,166,35,0.08)] text-[#F5A623]">
        —
      </div>
      <h2 className="text-lg font-semibold text-[#F0F0F4]">No frame evidence available</h2>
      <p className="mt-2 max-w-md text-sm text-[#8A8A9A]">
        No point PCI is inferred. A successful zero-distress detector result is distinct from missing or unusable evidence.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <a href={`/api/jobs/${jobId}/report`} className="rounded-[10px] bg-[#F5A623] px-5 py-2.5 text-sm font-semibold text-[#09090C]">
          Download evidence report
        </a>
        <Link href="/dashboard" className="text-sm text-[#8A8A9A] hover:text-[#F0F0F4]">Back to dashboard</Link>
      </div>
    </div>
  );
}
