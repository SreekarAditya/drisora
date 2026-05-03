"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { SummaryBar, PciChip, NoDetectionsState } from "./shared";
import { analyzeDistress } from "@/lib/civil-intelligence";
import { getPciBand, ircRecommendation, PCI_BANDS } from "@/types";
import type { JobResults, FrameResult } from "@/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const DroneMapClient = dynamic(
  () => import("./DroneMapClient").then((m) => m.DroneMapClient),
  { ssr: false, loading: () => <div className="h-full rounded-xl bg-[#0f0f0f] animate-pulse" /> },
);

interface Props {
  results: JobResults;
  jobId: string;
  surveyDate: string;
  orgName: string;
}

function SegmentSidebar({
  frame,
  onClose,
}: {
  frame: FrameResult;
  onClose: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const band = getPciBand(frame.pci_score);
  const analysis = analyzeDistress({
    crackTypes: frame.crack_types,
    pci: frame.pci_score,
    avgWidthMm: frame.avg_crack_width_mm,
    maxWidthMm: frame.max_crack_width_mm,
    crackCount: frame.final_detection_count ?? frame.crack_types.length,
    sectionLengthM: 10,
  });
  const hasMetricAnalysis =
    frame.camera_surface_distance_m != null ||
    frame.avg_crack_width_mm != null ||
    frame.max_crack_width_mm != null ||
    Object.keys(frame.crack_type_lengths_m).length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0f0f0f]">
      <div className="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-3">
        <PciChip score={frame.pci_score} />
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Overlay thumbnail */}
      <div className="relative h-44 shrink-0 bg-[#080808]">
        {frame.overlay_url && !imgError ? (
          <Image
            src={frame.overlay_url}
            alt="Crack overlay"
            fill
            className="object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-700">
            No overlay
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-gray-600">Condition</p>
            <p className="text-sm font-medium" style={{ color: band.color }}>
              {band.label} — PCI {frame.pci_score.toFixed(0)}
            </p>
          </div>

          {frame.lat != null && frame.lon != null && (
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-gray-600">GPS</p>
              <p className="font-mono text-xs text-gray-400">
                {frame.lat.toFixed(6)}, {frame.lon.toFixed(6)}
              </p>
              {frame.alt_m != null && (
                <p className="font-mono text-xs text-gray-600">{frame.alt_m.toFixed(1)} m alt</p>
              )}
            </div>
          )}

          {frame.crack_types.length > 0 && (
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-gray-600">Crack types</p>
              <div className="flex flex-wrap gap-1.5">
                {frame.crack_types.map((ct) => (
                  <span key={ct} className="rounded bg-[#1a1a1a] px-2 py-0.5 text-xs text-gray-300">
                    {ct}
                  </span>
                ))}
              </div>
            </div>
          )}

          {hasMetricAnalysis && (
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-gray-600">Crack Metrics</p>
              {frame.camera_surface_distance_m != null && (
                <p className="text-sm text-gray-300">
                  {frame.camera_surface_distance_m.toFixed(2)} m camera-to-surface
                </p>
              )}
              {frame.avg_crack_width_mm != null && (
                <p className="mt-1 text-sm text-gray-300">
                  {frame.avg_crack_width_mm.toFixed(1)} mm avg width from pixels
                </p>
              )}
              {frame.max_crack_width_mm != null && frame.max_crack_width_mm !== frame.avg_crack_width_mm && (
                <p className="mt-1 text-xs text-gray-500">
                  {frame.max_crack_width_mm.toFixed(1)} mm max estimated width
                </p>
              )}
              {Object.keys(frame.crack_type_lengths_m).length > 0 && (
                <div className="mt-3 space-y-1">
                  {Object.entries(frame.crack_type_lengths_m).map(([type, length]) => (
                    <div key={type} className="flex justify-between gap-3 rounded bg-[#111] px-2 py-1 text-xs">
                      <span className="text-gray-400">{type}</span>
                      <span className="font-mono text-gray-300">{length.toFixed(2)} m</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Possible Causes</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  analysis.priority === "Immediate"
                    ? "bg-red-500/10 text-red-300"
                    : analysis.priority === "Preventive"
                      ? "bg-amber-500/10 text-amber-300"
                      : "bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {analysis.priority}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-200">
              {analysis.distressLabel} · {analysis.severity}
            </p>
            <ul className="mt-2 space-y-1.5">
              {analysis.possibleCauses.map((cause) => (
                <li key={cause} className="text-sm leading-5 text-gray-500">
                  {cause}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-gray-600">Recommended Action</p>
            <p className="text-sm leading-6 text-gray-300">{analysis.recommendedMitigation}</p>
          </div>

          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-gray-600">IRC:82-2023</p>
            <p className="text-sm text-gray-300">{ircRecommendation(frame.pci_score)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DroneJobResults({ results, jobId, surveyDate, orgName }: Props) {
  const [selectedFrame, setSelectedFrame] = useState<FrameResult | null>(null);
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const handleSelect = useCallback((frame: FrameResult) => {
    setSelectedFrame(frame);
  }, []);

  const { frames, summary } = results;

  if (frames.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <SummaryBar results={results} jobId={jobId} surveyDate={surveyDate} orgName={orgName} />
        <NoDetectionsState jobId={jobId} />
      </div>
    );
  }

  const gpsFrames = frames.filter((f) => f.lat != null && f.lon != null);

  // Compute road length as sum of Haversine distances between consecutive GPS frames
  const totalLengthM = gpsFrames.reduce((acc, f, i) => {
    if (i === 0) return acc;
    const prev = gpsFrames[i - 1];
    const R = 6371000;
    const dLat = ((f.lat! - prev.lat!) * Math.PI) / 180;
    const dLon = ((f.lon! - prev.lon!) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((prev.lat! * Math.PI) / 180) *
        Math.cos((f.lat! * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return acc + R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, 0);

  const bandCounts = PCI_BANDS.map((b) => ({
    band: b,
    count: frames.filter((f) => f.pci_score >= b.min && f.pci_score <= b.max).length,
  }));

  const roadLengthExtra = totalLengthM > 0 ? (
    <>
      <div className="h-8 w-px bg-[#1e1e1e]" />
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Road length</p>
        <p className="mt-0.5 text-2xl font-semibold text-white">
          {totalLengthM >= 1000
            ? `${(totalLengthM / 1000).toFixed(2)} km`
            : `${totalLengthM.toFixed(0)} m`}
        </p>
      </div>
    </>
  ) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SummaryBar results={results} jobId={jobId} surveyDate={surveyDate} orgName={orgName} extra={roadLengthExtra} />

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* PCI band legend */}
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] px-5 py-4">
          {PCI_BANDS.map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <span
                className="h-3 w-8 rounded-sm"
                style={{ background: b.color }}
              />
              <span className="text-xs text-gray-500">
                {b.label} <span className="text-gray-700">{b.range}</span>
              </span>
              <span className="font-mono text-xs text-gray-600">
                ({bandCounts.find((bc) => bc.band.label === b.label)?.count ?? 0})
              </span>
            </div>
          ))}
        </div>

        {/* Map + sidebar */}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="h-[560px] overflow-hidden rounded-xl border border-[#1a1a1a]">
            {gpsFrames.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mb-3 text-gray-600">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <p className="text-sm font-semibold text-white">No GPS data available</p>
                <p className="mt-1 text-xs text-gray-600">
                  This survey has no location coordinates — the map view is unavailable.
                </p>
                <p className="mt-1 text-xs text-gray-700">
                  Results are still available in the crack distribution section below.
                </p>
              </div>
            ) : (
              <DroneMapClient
                frames={frames}
                onSelect={handleSelect}
                selectedStem={selectedFrame?.stem ?? null}
              />
            )}
          </div>

          {/* Desktop sidebar (hidden on mobile — bottom sheet used instead) */}
          <div className="hidden h-[560px] lg:block">
            {selectedFrame ? (
              <SegmentSidebar frame={selectedFrame} onClose={() => setSelectedFrame(null)} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-[#1a1a1a] bg-[#0f0f0f]">
                <div className="px-6 text-center">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto mb-3 text-[#2a2a2a]">
                    <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="16" cy="16" r="4" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="16" y1="4" x2="16" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="16" y1="24" x2="16" y2="28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="4" y1="16" x2="8" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="24" y1="16" x2="28" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <p className="text-xs text-gray-600">Click a segment on the map</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile bottom sheet */}
        {isMobile && selectedFrame && (
          <div className="fixed bottom-0 left-0 right-0 z-50 h-96 overflow-hidden rounded-t-xl border-t border-[#1a1a1a] bg-[#0f0f0f]">
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-[#333]" />
            </div>
            <SegmentSidebar frame={selectedFrame} onClose={() => setSelectedFrame(null)} />
          </div>
        )}

        {/* Crack distribution */}
        {Object.keys(summary.crack_type_counts).length > 0 && (
          <div className="mt-6 overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] p-5">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-gray-600">Crack type distribution</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(summary.crack_type_counts)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between rounded-lg bg-[#111] px-3 py-2">
                    <span className="text-sm text-gray-300">{type}</span>
                    <span className="font-mono text-xs text-gray-500">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
