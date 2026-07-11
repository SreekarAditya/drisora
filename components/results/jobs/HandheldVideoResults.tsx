"use client";

import { DetectionFrameImage } from "./DetectionFrameImage";
import { NoDetectionsState, SummaryBar } from "./shared";
import type { FrameResult, JobResults } from "@/types";

interface Props { results: JobResults; jobId: string; surveyDate: string; orgName: string }

export function HandheldVideoResults({ results, jobId, surveyDate, orgName }: Props) {
  return (
    <div className="min-h-screen bg-[#09090C]">
      <SummaryBar results={results} jobId={jobId} surveyDate={surveyDate} orgName={orgName} />
      {results.frames.length === 0 ? <NoDetectionsState jobId={jobId} /> : (
        <main className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 rounded-[14px] border border-[rgba(245,166,35,0.20)] bg-[rgba(245,166,35,0.05)] p-4 text-sm text-[#C9C9D2]">
            Handheld video is detection-only. Monocular relative depth is not converted to rut depth, crack width, metric area, or a PCI point estimate.
          </div>
          <div className="space-y-3">
            {results.frames.map((frame) => <TimelineRow key={frame.stem} frame={frame} />)}
          </div>
        </main>
      )}
    </div>
  );
}

function TimelineRow({ frame }: { frame: FrameResult }) {
  const count = frame.final_detection_count ?? frame.yolo_detection_count ?? 0;
  const seconds = frame.timestamp_ms == null ? null : frame.timestamp_ms / 1000;
  return (
    <article className="grid gap-4 rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116] p-3 sm:grid-cols-[180px_1fr_auto] sm:items-center">
      <div className="aspect-video overflow-hidden rounded-[8px] bg-[#0D0D11]"><DetectionFrameImage frame={frame} alt={`Frame ${frame.index + 1}`} objectFit="cover" className="h-full w-full" sizes="180px" /></div>
      <div>
        <p className="font-mono text-xs text-[#8A8A9A]">{seconds == null ? `Frame #${frame.index + 1}` : `${seconds.toFixed(1)} s · frame #${frame.index + 1}`}</p>
        <p className="mt-2 text-sm text-[#F0F0F4]">{frame.crack_types.length ? frame.crack_types.join(", ") : "No trained distress found"}</p>
        <p className="mt-1 text-xs text-[#4A4A5A]">Detector and segmentation status recorded; no physical PCI measurements inferred.</p>
      </div>
      <span className={count ? "text-sm text-[#F5A623]" : "text-sm text-[#22C55E]"}>{count} detections</span>
    </article>
  );
}
