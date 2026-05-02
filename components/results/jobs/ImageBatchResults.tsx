"use client";

import { useState } from "react";
import Image from "next/image";
import { SummaryBar, PciChip, NoDetectionsState } from "./shared";
import { getPciBand, PCI_BANDS } from "@/types";
import type { JobResults, FrameResult } from "@/types";

interface Props {
  results: JobResults;
  jobId: string;
  surveyDate: string;
  orgName: string;
}

type PciFilter = "all" | "good" | "satisfactory" | "fair" | "poor" | "very_poor";

const FILTER_OPTIONS: { value: PciFilter; label: string; color: string }[] = [
  { value: "all", label: "All", color: "#888" },
  { value: "good", label: "Good 85–100", color: "#22c55e" },
  { value: "satisfactory", label: "Satisfactory 70–84", color: "#eab308" },
  { value: "fair", label: "Fair 55–69", color: "#f97316" },
  { value: "poor", label: "Poor 40–54", color: "#ef4444" },
  { value: "very_poor", label: "Very Poor 0–39", color: "#7f1d1d" },
];

function bandKey(score: number): PciFilter {
  if (score >= 85) return "good";
  if (score >= 70) return "satisfactory";
  if (score >= 55) return "fair";
  if (score >= 40) return "poor";
  return "very_poor";
}

function FrameCard({ frame }: { frame: FrameResult }) {
  const [imgError, setImgError] = useState(false);
  const band = getPciBand(frame.pci_score);
  const dominant = frame.crack_types[0] ?? null;

  return (
    <div className="group overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] transition-colors hover:border-[#2a2a2a]">
      {/* Image */}
      <div className="relative aspect-video w-full bg-[#111] overflow-hidden">
        {frame.overlay_url && !imgError ? (
          <Image
            src={frame.overlay_url}
            alt={`Frame ${frame.index}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-[#2a2a2a]">
              <rect x="2" y="5" width="24" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="10" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 20l6-5 5 4 4-3 9 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        {/* PCI overlay badge */}
        <div
          className="absolute right-2 top-2 rounded px-2 py-0.5 font-mono text-xs font-semibold"
          style={{ background: `${band.color}dd`, color: band.textColor }}
        >
          {frame.pci_score.toFixed(0)}
        </div>
      </div>

      {/* Meta */}
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <PciChip score={frame.pci_score} />
          <span className="font-mono text-[10px] text-gray-700">#{frame.index + 1}</span>
        </div>
        {dominant && (
          <p className="mt-1.5 text-xs text-gray-500">{dominant}</p>
        )}
      </div>
    </div>
  );
}

export function ImageBatchResults({ results, jobId, surveyDate, orgName }: Props) {
  const [filter, setFilter] = useState<PciFilter>("all");
  const { frames } = results;

  if (frames.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <SummaryBar results={results} jobId={jobId} surveyDate={surveyDate} orgName={orgName} />
        <NoDetectionsState jobId={jobId} />
      </div>
    );
  }

  const filtered = filter === "all" ? frames : frames.filter((f) => bandKey(f.pci_score) === filter);

  const bandCounts = PCI_BANDS.map((b) => ({
    band: b,
    count: frames.filter((f) => f.pci_score >= b.min && f.pci_score <= b.max).length,
  }));

  const worstFrame = frames.reduce<FrameResult | null>(
    (w, f) => (!w || f.pci_score < w.pci_score ? f : w),
    null,
  );

  const filterExtra = (
    <div className="h-8 w-px bg-[#1e1e1e]" />
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SummaryBar results={results} jobId={jobId} surveyDate={surveyDate} orgName={orgName} extra={filterExtra} />

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Band distribution bar */}
        <div className="mb-8 overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] p-5">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-gray-600">Condition distribution</p>
          <div className="flex h-3 overflow-hidden rounded-full">
            {bandCounts.map(({ band, count }) =>
              count > 0 ? (
                <div
                  key={band.label}
                  title={`${band.label}: ${count}`}
                  className="transition-all"
                  style={{
                    width: `${(count / frames.length) * 100}%`,
                    background: band.color,
                  }}
                />
              ) : null,
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            {bandCounts.map(({ band, count }) => (
              <div key={band.label} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: band.color }} />
                <span className="text-xs text-gray-500">{band.label}</span>
                <span className="text-xs font-medium text-gray-300">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filter row + worst section */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === opt.value
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    : "border-[#1e1e1e] bg-[#0f0f0f] text-gray-500 hover:border-[#2a2a2a] hover:text-gray-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-gray-600">
            {filtered.length} of {frames.length} sections
          </span>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-[#1a1a1a] text-sm text-gray-600">
            No sections in this PCI band
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((frame) => (
              <FrameCard key={frame.stem} frame={frame} />
            ))}
          </div>
        )}

        {/* Worst section callout */}
        {worstFrame && (
          <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/5 p-5">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-400">Worst section</p>
            <div className="flex flex-wrap items-center gap-4">
              <PciChip score={worstFrame.pci_score} size="lg" />
              <span className="text-sm text-gray-400">
                Frame #{worstFrame.index + 1}
                {worstFrame.crack_types.length > 0 && ` · ${worstFrame.crack_types.join(", ")}`}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
