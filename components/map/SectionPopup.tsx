import type { RoadSectionProperties } from "@/types";

export function SectionPopup({ properties }: { properties: RoadSectionProperties }) {
  return <div className="min-w-52 space-y-2 text-sm text-[#F0F0F4]"><div className="text-xs uppercase tracking-wide text-[#8A8A9A]">Legacy section {properties.section_index ?? "N/A"}</div><div className="rounded bg-white/5 p-2 text-xs text-[#FFBE4D]">Historical point PCI and derived condition claims are suppressed.</div><div className="flex justify-between gap-4"><span className="text-[#8A8A9A]">Detections</span><span>{properties.crack_count}</span></div><div className="text-xs text-[#8A8A9A]">{properties.crack_types.length ? properties.crack_types.join(", ") : "No types recorded"}</div></div>;
}
