"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Dot,
} from "recharts";
import { SummaryBar, PciChip, NoDetectionsState } from "./shared";
import { getPciBand, ircRecommendation } from "@/types";
import type { JobResults, FrameResult } from "@/types";

interface Props {
  results: JobResults;
  jobId: string;
  surveyDate: string;
  orgName: string;
}

function fmtTime(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

interface ChartPoint {
  t: number; // seconds
  pci: number;
  frame: FrameResult;
}

function CustomDot(props: {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
  selected?: boolean;
  onClick?: (frame: FrameResult) => void;
}) {
  const { cx, cy, payload, selected, onClick } = props;
  if (cx == null || cy == null || !payload) return null;
  const band = getPciBand(payload.pci);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={selected ? 6 : 3.5}
      fill={band.color}
      stroke={selected ? "#fff" : "transparent"}
      strokeWidth={1.5}
      style={{ cursor: "pointer" }}
      onClick={() => onClick?.(payload.frame)}
    />
  );
}

interface TooltipPayload {
  payload?: ChartPoint;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.[0]?.payload) return null;
  const { pci, t } = payload[0].payload;
  const band = getPciBand(pci);
  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#111] p-3 shadow-xl">
      <p className="font-mono text-[11px] text-gray-500">{fmtTime(t * 1000)}</p>
      <p className="mt-1 text-sm font-semibold" style={{ color: band.color }}>
        PCI {pci.toFixed(0)} · {band.label}
      </p>
    </div>
  );
}

function FramePanel({ frame, onClose }: { frame: FrameResult; onClose: () => void }) {
  const [imgError, setImgError] = useState(false);
  const band = getPciBand(frame.pci_score);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0f0f0f]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-3">
        <div className="flex items-center gap-2">
          {frame.timestamp_ms != null && (
            <span className="font-mono text-xs text-gray-500">{fmtTime(frame.timestamp_ms)}</span>
          )}
          <PciChip score={frame.pci_score} />
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Overlay image */}
      <div className="relative flex-1 bg-[#080808]">
        {frame.overlay_url && !imgError ? (
          <Image
            src={frame.overlay_url}
            alt={`Frame at ${frame.timestamp_ms ?? frame.index}`}
            fill
            className="object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-700">
            No overlay available
          </div>
        )}
      </div>

      {/* Detail */}
      <div className="border-t border-[#1a1a1a] p-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-gray-600">Condition</p>
            <p className="mt-0.5 font-medium" style={{ color: band.color }}>{band.label}</p>
          </div>
          <div>
            <p className="text-gray-600">Recommendation</p>
            <p className="mt-0.5 text-gray-300">{ircRecommendation(frame.pci_score)}</p>
          </div>
          {frame.crack_types.length > 0 && (
            <div className="col-span-2">
              <p className="text-gray-600">Crack types</p>
              <p className="mt-0.5 text-gray-300">{frame.crack_types.join(", ")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function HandheldVideoResults({ results, jobId, surveyDate, orgName }: Props) {
  const [selectedFrame, setSelectedFrame] = useState<FrameResult | null>(null);

  const { frames, summary } = results;

  if (frames.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <SummaryBar results={results} jobId={jobId} surveyDate={surveyDate} orgName={orgName} />
        <NoDetectionsState jobId={jobId} />
      </div>
    );
  }

  const chartData: ChartPoint[] = frames
    .filter((f) => f.timestamp_ms != null)
    .map((f) => ({ t: (f.timestamp_ms ?? 0) / 1000, pci: f.pci_score, frame: f }));

  const fallbackData: ChartPoint[] = frames.map((f, i) => ({
    t: i,
    pci: f.pci_score,
    frame: f,
  }));

  const data = chartData.length > 0 ? chartData : fallbackData;
  const xLabel = chartData.length > 0 ? "Time (s)" : "Frame index";

  const lowestPciFrame = frames.reduce<FrameResult | null>(
    (w, f) => (!w || f.pci_score < w.pci_score ? f : w),
    null,
  );

  const handleDotClick = useCallback((frame: FrameResult) => {
    setSelectedFrame(frame);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SummaryBar results={results} jobId={jobId} surveyDate={surveyDate} orgName={orgName} />

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Lowest PCI callout */}
        {lowestPciFrame && lowestPciFrame.timestamp_ms != null && (
          <div className="mb-6 flex items-center gap-4 rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] px-5 py-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Worst at</span>
            <span className="font-mono text-sm text-gray-300">{fmtTime(lowestPciFrame.timestamp_ms)}</span>
            <PciChip score={lowestPciFrame.pci_score} />
            <button
              className="ml-auto text-xs text-amber-400 hover:text-amber-300"
              onClick={() => setSelectedFrame(lowestPciFrame)}
            >
              View frame →
            </button>
          </div>
        )}

        {/* Chart + panel layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Line chart */}
          <div className="overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] p-6">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-gray-600">
              PCI over {xLabel.toLowerCase()}
            </p>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="#1a1a1a" vertical={false} />
                <XAxis
                  dataKey="t"
                  stroke="#333"
                  tick={{ fill: "#555", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                  tickFormatter={(v: number) => chartData.length > 0 ? `${v}s` : `#${v}`}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#333"
                  tick={{ fill: "#555", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                  width={32}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={85} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.4} />
                <ReferenceLine y={70} stroke="#eab308" strokeDasharray="4 4" strokeOpacity={0.4} />
                <ReferenceLine y={55} stroke="#f97316" strokeDasharray="4 4" strokeOpacity={0.4} />
                <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.4} />
                <Line
                  type="monotone"
                  dataKey="pci"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  dot={(props: Record<string, unknown>) => (
                    <CustomDot
                      {...props}
                      selected={selectedFrame?.stem === (props.payload as ChartPoint)?.frame?.stem}
                      onClick={handleDotClick}
                    />
                  )}
                  activeDot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-2 text-center text-[11px] text-gray-700">
              Click any point to view crack overlay
            </p>
          </div>

          {/* Frame panel */}
          <div className="h-[440px]">
            {selectedFrame ? (
              <FramePanel frame={selectedFrame} onClose={() => setSelectedFrame(null)} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-[#1a1a1a] bg-[#0f0f0f]">
                <div className="text-center">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto mb-3 text-[#2a2a2a]">
                    <rect x="2" y="6" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M12 16l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M16 12v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <p className="text-xs text-gray-600">Click a point on the chart</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Crack type distribution */}
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
