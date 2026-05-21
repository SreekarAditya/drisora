"use client";

import { useState } from "react";
import { SummaryBar, PciChip, NoDetectionsState } from "./shared";
import { DetectionFrameImage } from "./DetectionFrameImage";
import { crackWidthBandLabel } from "@/lib/crack-metrics";
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
  const band = getPciBand(frame.pci_score);
  const dominant = frame.crack_types[0] ?? null;
  const hasCracks =
    frame.crack_types.length > 0 ||
    (frame.final_detection_count ?? frame.yolo_detection_count ?? 0) > 0 ||
    frame.max_crack_width_mm != null ||
    Object.keys(frame.crack_type_lengths_m).length > 0;

  return (
    <div className="group overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] transition-colors hover:border-[rgba(255,255,255,0.12)]">
      {/* Image */}
      <div className="relative aspect-video w-full bg-[#0D0D11] overflow-hidden">
        <DetectionFrameImage
          frame={frame}
          alt={`Frame ${frame.index}`}
          objectFit="cover"
          className="h-full w-full"
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          placeholderClassName="text-[#4A4A5A]"
        />
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
          <span className="font-mono text-[10px] text-[#4A4A5A]">#{frame.index + 1}</span>
        </div>
        {dominant && (
          <p className="mt-1.5 text-xs text-[#8A8A9A]">{dominant}</p>
        )}
        <div className="mt-2 space-y-1 border-t border-[rgba(255,255,255,0.05)] pt-2 text-[11px] text-[#8A8A9A]">
          {hasCracks ? (
            <>
              <div className="flex justify-between gap-2">
                <span>Max width</span>
                <span className="font-mono text-[#F0F0F4]">
                  {frame.max_crack_width_mm == null ? "N/A" : `${frame.max_crack_width_mm.toFixed(1)} mm`}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Avg width</span>
                <span className="font-mono text-[#F0F0F4]">
                  {frame.avg_crack_width_mm == null ? "N/A" : `${frame.avg_crack_width_mm.toFixed(1)} mm`}
                </span>
              </div>
              <p className="font-mono text-[10px] text-[#4A4A5A]">
                {crackWidthBandLabel(frame.max_crack_width_mm ?? frame.avg_crack_width_mm)}
                {frame.crack_metrics_estimated ? " (legacy estimate)" : ""}
              </p>
            </>
          ) : (
            <p>No cracks detected</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ImageBatchResults({ results, jobId, surveyDate, orgName }: Props) {
  const [filter, setFilter] = useState<PciFilter>("all");
  const { frames } = results;

  if (frames.length === 0) {
    return (
      <div className="min-h-screen bg-[#09090C]">
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
    <div className="h-8 w-px bg-[rgba(255,255,255,0.07)]" />
  );

  return (
    <div className="min-h-screen bg-[#09090C]">
      <SummaryBar results={results} jobId={jobId} surveyDate={surveyDate} orgName={orgName} extra={filterExtra} />

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Band distribution bar */}
        <div className="mb-8 overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] p-5">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[#4A4A5A]">Condition distribution</p>
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
                <span className="text-xs text-[#8A8A9A]">{band.label}</span>
                <span className="text-xs font-medium text-[#F0F0F4]">{count}</span>
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
                    ? "border-[rgba(245,166,35,0.40)] bg-[rgba(245,166,35,0.08)] text-[#F5A623]"
                    : "border-[rgba(255,255,255,0.07)] bg-[#111116] text-[#8A8A9A] hover:border-[rgba(255,255,255,0.15)] hover:text-[#F0F0F4]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-[#4A4A5A]">
            {filtered.length} of {frames.length} sections
          </span>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-[14px] border border-[rgba(255,255,255,0.07)] text-sm text-[#4A4A5A]">
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
          <div className="mt-8 rounded-[14px] border border-[rgba(239,68,68,0.20)] bg-[rgba(239,68,68,0.05)] p-5">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[#EF4444]">Worst section</p>
            <div className="flex flex-wrap items-center gap-4">
              <PciChip score={worstFrame.pci_score} size="lg" />
              <span className="text-sm text-[#8A8A9A]">
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
