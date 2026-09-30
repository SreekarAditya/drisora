"use client";

import { useState } from "react";

const GRADE_COLORS: Record<string, string> = {
  Good:         "#22c55e",
  Satisfactory: "#eab308",
  Fair:         "#f97316",
  Poor:         "#ef4444",
  "Very Poor":  "#dc2626",
  Serious:      "#991b1b",
  Failed:       "#450a0a",
};

function gradeColor(grade: string | null): string {
  return grade ? (GRADE_COLORS[grade] ?? "#374151") : "#374151";
}

interface PciSegment {
  id: string;
  segment_index: number;
  start_distance_m: number;
  end_distance_m: number;
  total_length_m: number;
  pci_score: number | null;
  pci_grade: string | null;
  is_relative: boolean;
  detection_count: number;
  deduct_values: Array<{ type: string; value: number }> | null;
  source_video_ids: string[] | null;
}

interface SurveySummary {
  weighted_pci: number; total_length_m: number;
  segment_count: number; rpci_segment_count: number;
}

interface PCISegmentViewProps {
  segments: PciSegment[]; summary: SurveySummary; className?: string;
}

const fmtDist = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;

function gradeFromScore(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 85) return "Good"; if (score >= 70) return "Satisfactory";
  if (score >= 55) return "Fair";  if (score >= 40) return "Poor";
  if (score >= 25) return "Very Poor"; if (score >= 10) return "Serious";
  return "Failed";
}

function GradeDistribution({ segments }: { segments: PciSegment[] }) {
  const counts: Record<string, number> = {};
  for (const seg of segments) {
    const g = seg.pci_grade ?? gradeFromScore(seg.pci_score) ?? "Pending";
    counts[g] = (counts[g] ?? 0) + 1;
  }
  const order = ["Good", "Satisfactory", "Fair", "Poor", "Very Poor", "Serious", "Failed", "Pending"];
  const entries = order.filter((g) => counts[g]).map((g) => ({ grade: g, count: counts[g] }));
  if (!entries.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {entries.map(({ grade, count }) => {
        const color = gradeColor(grade === "Pending" ? null : grade);
        return (
          <span
            key={grade}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              background: `${color}22`,
              color: grade === "Pending" ? "#6b7280" : color,
              border: `1px solid ${color}44`,
            }}
          >
            {grade}
            <span
              className="ml-1 rounded-full px-1.5 py-0 text-[10px] font-semibold"
              style={{ background: `${color}33` }}
            >
              {count}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function DetailPanel({ segment, onClose }: { segment: PciSegment; onClose: () => void }) {
  const grade = segment.pci_grade ?? gradeFromScore(segment.pci_score);
  const color = gradeColor(grade);
  const maxDeduct = segment.deduct_values
    ? Math.max(...segment.deduct_values.map((d) => d.value), 1)
    : 1;

  return (
    <div className="mt-3 rounded-lg border border-[rgba(255,255,255,0.10)] bg-[#141416] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-3">
          {segment.pci_score !== null ? (
            <span className="text-3xl font-semibold" style={{ color }}>
              {segment.pci_score.toFixed(0)}
            </span>
          ) : (
            <span className="text-3xl font-semibold text-[#8A8A9A]">—</span>
          )}
          <span className="text-sm font-medium" style={{ color }}>
            {grade ?? "Pending"}
          </span>
          {segment.is_relative && (
            <span className="rounded bg-[rgba(245,166,35,0.10)] px-1.5 py-0.5 text-[10px] font-semibold text-[#F5A623]">
              RPCI
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-[#8A8A9A] hover:text-[#F0F0F4]"
          aria-label="Close detail panel"
        >
          ✕
        </button>
      </div>

      {/* Metrics */}
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A8A9A]">Distance</p>
          <p className="mt-0.5 text-sm font-semibold text-[#F0F0F4]">
            {fmtDist(segment.start_distance_m)} – {fmtDist(segment.end_distance_m)}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A8A9A]">Coverage</p>
          <p className="mt-0.5 text-sm font-semibold text-[#F0F0F4]">
            {fmtDist(segment.total_length_m)} covered
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A8A9A]">Detections</p>
          <p className="mt-0.5 text-sm font-semibold text-[#F0F0F4]">{segment.detection_count}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A8A9A]">Segment #</p>
          <p className="mt-0.5 text-sm font-semibold text-[#F0F0F4]">{segment.segment_index + 1}</p>
        </div>
      </div>

      {/* RPCI warning */}
      {segment.is_relative && (
        <p className="mt-3 rounded border border-[rgba(245,166,35,0.20)] bg-[rgba(245,166,35,0.06)] px-3 py-2 text-xs text-[#FFBE4D]">
          Relative PCI — section &lt; 100 m coverage. Not directly comparable to standard IRC:82-2023 PCI.
        </p>
      )}

      {/* Deduct values */}
      {segment.deduct_values && segment.deduct_values.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A8A9A]">
            Deduct values
          </p>
          <div className="mt-2 space-y-1.5">
            {[...segment.deduct_values]
              .sort((a, b) => b.value - a.value)
              .map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-xs text-[#8A8A9A]">{d.type}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (d.value / maxDeduct) * 100)}%`,
                        background: color,
                        opacity: 0.75,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-mono text-[#F0F0F4]">
                    {d.value.toFixed(1)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PCISegmentView({ segments, summary, className = "" }: PCISegmentViewProps) {
  const [activeSegment, setActiveSegment] = useState<PciSegment | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Empty state
  if (!segments || segments.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-lg border border-[rgba(255,255,255,0.10)] bg-[#101113] p-10 text-center ${className}`}
      >
        <p className="text-sm font-medium text-[#8A8A9A]">No segments computed yet</p>
        <p className="mt-1 text-xs text-[#4A4A5A]">Segments will appear here once processing is complete.</p>
      </div>
    );
  }

  const summaryBand = gradeColor(
    (() => {
      const g = gradeFromScore(summary.weighted_pci);
      return g;
    })()
  );
  const summaryGrade = gradeFromScore(summary.weighted_pci);

  // Compute proportional widths (min 40px)
  const totalLen = segments.reduce((s, seg) => s + (seg.total_length_m || 1), 0);
  const MIN_PX = 40;

  function segWidth(seg: PciSegment): number {
    return Math.max(MIN_PX, (seg.total_length_m / totalLen) * 800);
  }

  return (
    <div className={`rounded-lg border border-[rgba(255,255,255,0.10)] bg-[#101113] p-5 ${className}`}>
      {/* ── Summary card ── */}
      <div className="flex flex-wrap items-start gap-6">
        {/* Weighted PCI */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A8A9A]">Weighted PCI</p>
          <p className="mt-0.5 text-4xl font-semibold" style={{ color: summaryBand }}>
            {summary.weighted_pci.toFixed(1)}
            <span className="ml-2 text-base font-normal" style={{ color: summaryBand }}>
              {summaryGrade}
            </span>
          </p>
        </div>

        <div className="mt-1 h-10 w-px bg-white/10" />

        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A8A9A]">Total length</p>
          <p className="mt-0.5 text-2xl font-semibold text-[#F0F0F4]">{fmtDist(summary.total_length_m)}</p>
        </div>

        <div className="mt-1 h-10 w-px bg-white/10" />

        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A8A9A]">Segments</p>
          <p className="mt-0.5 text-2xl font-semibold text-[#F0F0F4]">{summary.segment_count}</p>
        </div>

        {summary.rpci_segment_count > 0 && (
          <>
            <div className="mt-1 h-10 w-px bg-white/10" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A8A9A]">
                RPCI segments
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-2xl font-semibold text-[#F0F0F4]">
                {summary.rpci_segment_count}
                <span className="rounded bg-[rgba(245,166,35,0.12)] px-1.5 py-0.5 text-[10px] font-semibold text-[#F5A623]">
                  WARNING
                </span>
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Segment strip ── */}
      <div className="mt-5 overflow-x-auto rounded bg-[#09090C] p-3">
        <div className="flex h-14 items-stretch gap-0.5" style={{ minWidth: "max-content" }}>
          {segments.map((seg) => {
            const grade = seg.pci_grade ?? gradeFromScore(seg.pci_score);
            const color = gradeColor(grade);
            const isActive = activeSegment?.id === seg.id;
            const isHovered = hoveredId === seg.id;
            const width = segWidth(seg);

            return (
              <div
                key={seg.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveSegment(isActive ? null : seg)}
                onKeyDown={(e) => e.key === "Enter" && setActiveSegment(isActive ? null : seg)}
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="relative cursor-pointer rounded-sm transition-all focus:outline-none"
                style={{
                  width: `${width}px`,
                  minWidth: `${width}px`,
                  background: color,
                  opacity: seg.pci_score === null ? 0.5 : isHovered || isActive ? 1 : 0.8,
                  border: isActive
                    ? "2px solid rgba(255,255,255,0.6)"
                    : seg.is_relative
                    ? "2px dashed rgba(255,255,255,0.4)"
                    : "2px solid transparent",
                }}
                title={
                  seg.pci_score !== null
                    ? `Segment ${seg.segment_index + 1}: PCI ${seg.pci_score.toFixed(0)} · ${grade}`
                    : `Segment ${seg.segment_index + 1}: Pending`
                }
              >
                {/* RPCI badge */}
                {seg.is_relative && (
                  <span
                    className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 text-[#F5A623]"
                    style={{ fontSize: 10, lineHeight: "14px" }}
                  >
                    RPCI
                  </span>
                )}

                {/* Pending label */}
                {seg.pci_score === null && (
                  <span
                    className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-[#F0F0F4]/60"
                  >
                    —
                  </span>
                )}

                {/* Hover tooltip */}
                {isHovered && !isActive && (
                  <div
                    className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 -translate-y-full rounded border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] p-3 text-sm shadow-lg"
                    style={{ bottom: "calc(100% + 6px)", minWidth: 160 }}
                  >
                    <p className="font-semibold text-[#F0F0F4]">
                      Segment {seg.segment_index + 1}
                    </p>
                    <p className="mt-0.5 text-xs text-[#8A8A9A]">
                      {fmtDist(seg.start_distance_m)} – {fmtDist(seg.end_distance_m)}
                    </p>
                    <p className="mt-1 text-xs" style={{ color }}>
                      {seg.pci_score !== null
                        ? `PCI ${seg.pci_score.toFixed(0)} · ${grade}`
                        : "Pending"}
                    </p>
                    {seg.is_relative && (
                      <p className="mt-0.5 text-[10px] text-[#F5A623]">Relative PCI</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Grade distribution ── */}
      <GradeDistribution segments={segments} />

      {/* ── Detail panel ── */}
      {activeSegment && (
        <DetailPanel
          segment={activeSegment}
          onClose={() => setActiveSegment(null)}
        />
      )}
    </div>
  );
}
