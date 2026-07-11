"use client";

import { DetectionFrameImage } from "./DetectionFrameImage";
import { NoDetectionsState, PciBoundsChip, SummaryBar } from "./shared";
import type { FrameResult, JobResults, PartialPciSection } from "@/types";

interface Props {
  results: JobResults;
  jobId: string;
  surveyDate: string;
  orgName: string;
}

export function DroneJobResults({ results, jobId, surveyDate, orgName }: Props) {
  const { frames, sections } = results;
  return (
    <div className="min-h-screen bg-[#09090C]">
      <SummaryBar results={results} jobId={jobId} surveyDate={surveyDate} orgName={orgName} />
      {frames.length === 0 && sections.length === 0 ? (
        <NoDetectionsState jobId={jobId} />
      ) : (
        <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
          <section className="overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116]">
            <div className="border-b border-[rgba(255,255,255,0.07)] px-5 py-4">
              <h2 className="font-semibold text-[#F0F0F4]">100 m chainage sections</h2>
              <p className="mt-1 text-xs text-[#8A8A9A]">
                Bounds use spatially deduplicated SAM2 mask area. The final section may be shorter than 100 m and is marked partial.
              </p>
            </div>
            {sections.length === 0 ? (
              <p className="px-5 py-8 text-sm text-[#8A8A9A]">No section assessment was produced for this job.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-[rgba(255,255,255,0.025)] font-mono text-[10px] uppercase tracking-wider text-[#4A4A5A]">
                    <tr>
                      <th className="px-5 py-3">Section</th>
                      <th className="px-5 py-3">Chainage</th>
                      <th className="px-5 py-3">PCI bounds</th>
                      <th className="px-5 py-3">Cracking extent</th>
                      <th className="px-5 py-3">Pothole number</th>
                      <th className="px-5 py-3">Dedup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((section) => <SectionRow key={section.section_id} section={section} />)}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[#F0F0F4]">Frame evidence</h2>
                <p className="mt-1 text-xs text-[#8A8A9A]">Frames are evidence inputs, not PCI sections.</p>
              </div>
              <span className="font-mono text-xs text-[#4A4A5A]">{frames.length} frames</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {frames.map((frame) => <FrameCard key={frame.stem} frame={frame} />)}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

function SectionRow({ section }: { section: PartialPciSection }) {
  const crack = section.assessment?.measured?.cracking;
  const pothole = section.assessment?.measured?.pothole;
  return (
    <tr className="border-t border-[rgba(255,255,255,0.06)] text-[#F0F0F4]">
      <td className="px-5 py-4 font-medium">
        {section.section_id}
        {section.is_relative && <span className="ml-2 text-[10px] uppercase text-[#F5A623]">partial</span>}
      </td>
      <td className="px-5 py-4 font-mono text-xs text-[#8A8A9A]">
        {section.start_distance_m.toFixed(0)}–{section.end_distance_m.toFixed(0)} m
      </td>
      <td className="px-5 py-4"><PciBoundsChip bounds={section.pci_bounds} /></td>
      <td className="px-5 py-4 font-mono">{crack?.extent_pct == null ? "—" : `${crack.extent_pct.toFixed(3)}%`}</td>
      <td className="px-5 py-4 font-mono">{pothole?.number == null ? "—" : pothole.number.toFixed(2)}</td>
      <td className="px-5 py-4 font-mono text-xs text-[#8A8A9A]">{section.raw_detection_count} → {section.unique_detection_count}</td>
    </tr>
  );
}

function FrameCard({ frame }: { frame: FrameResult }) {
  const count = frame.final_detection_count ?? frame.yolo_detection_count ?? 0;
  return (
    <article className="overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111116]">
      <div className="aspect-video bg-[#0D0D11]">
        <DetectionFrameImage frame={frame} alt={`Frame ${frame.index + 1}`} objectFit="cover" className="h-full w-full" sizes="(max-width: 768px) 100vw, 25vw" />
      </div>
      <div className="space-y-2 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[#8A8A9A]">Frame #{frame.index + 1}</span>
          <span className={count > 0 ? "text-[#F5A623]" : "text-[#22C55E]"}>{count} detections</span>
        </div>
        <p className="text-[#8A8A9A]">{frame.crack_types.length ? frame.crack_types.join(", ") : "No trained distress found"}</p>
        {frame.lat != null && frame.lon != null && (
          <p className="font-mono text-[10px] text-[#4A4A5A]">{frame.lat.toFixed(6)}, {frame.lon.toFixed(6)}</p>
        )}
      </div>
    </article>
  );
}
