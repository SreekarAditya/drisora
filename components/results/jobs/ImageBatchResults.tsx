"use client";

import { useState } from "react";
import { DetectionFrameImage } from "./DetectionFrameImage";
import { NoDetectionsState, SummaryBar } from "./shared";
import type { FrameResult, JobResults } from "@/types";

interface Props { results: JobResults; jobId: string; surveyDate: string; orgName: string }
type Filter = "all" | "distress" | "clear";

export function ImageBatchResults({ results, jobId, surveyDate, orgName }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const frames = results.frames.filter((frame) => {
    const count = frame.final_detection_count ?? frame.yolo_detection_count ?? 0;
    return filter === "all" || (filter === "distress" ? count > 0 : count === 0);
  });
  return (
    <div className="min-h-screen bg-[#09090C]">
      <SummaryBar results={results} jobId={jobId} surveyDate={surveyDate} orgName={orgName} />
      {results.frames.length === 0 ? <NoDetectionsState jobId={jobId} /> : (
        <main className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex flex-wrap gap-2">
            {(["all", "distress", "clear"] as const).map((value) => (
              <button key={value} onClick={() => setFilter(value)} className={`rounded-md border px-3 py-1.5 text-xs ${filter === value ? "border-[#F5A623] text-[#F5A623]" : "border-[rgba(255,255,255,0.08)] text-[#8A8A9A]"}`}>
                {value === "all" ? "All evidence" : value === "distress" ? "Distress detected" : "No trained distress found"}
              </button>
            ))}
          </div>
          <p className="mb-5 text-sm text-[#8A8A9A]">Image batches are detection-only. Without GPS-chainage sections and calibrated area, no PCI bounds are computed.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {frames.map((frame) => <EvidenceCard key={frame.stem} frame={frame} />)}
          </div>
        </main>
      )}
    </div>
  );
}

function EvidenceCard({ frame }: { frame: FrameResult }) {
  const count = frame.final_detection_count ?? frame.yolo_detection_count ?? 0;
  return (
    <article className="overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116]">
      <div className="aspect-video bg-[#0D0D11]"><DetectionFrameImage frame={frame} alt={`Frame ${frame.index + 1}`} objectFit="cover" className="h-full w-full" sizes="(max-width: 768px) 100vw, 25vw" /></div>
      <div className="p-3 text-xs">
        <div className="flex justify-between gap-3"><span className="font-mono text-[#8A8A9A]">#{frame.index + 1}</span><span className={count ? "text-[#F5A623]" : "text-[#22C55E]"}>{count} detections</span></div>
        <p className="mt-2 text-[#8A8A9A]">{frame.crack_types.length ? frame.crack_types.join(", ") : "No trained distress found"}</p>
      </div>
    </article>
  );
}
