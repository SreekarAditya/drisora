import type { RoadSectionProperties } from "@/types";

interface PrioritySectionsProps {
  sections: RoadSectionProperties[];
}

export function PrioritySections({ sections }: PrioritySectionsProps) {
  const prioritySections = [...sections]
    .filter((section) => section.priority_rank != null)
    .sort((a, b) => (a.priority_rank ?? Number.MAX_SAFE_INTEGER) - (b.priority_rank ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 5);

  if (prioritySections.length === 0) {
    return <p className="text-sm text-[#8A8A9A]">No priority sections assigned.</p>;
  }

  return (
    <div className="space-y-3">
      {prioritySections.map((section) => (
        <div
          key={`${section.priority_rank}-${section.section_index}`}
          className="flex items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.05)] pb-3 last:border-b-0 last:pb-0"
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-[#F0F0F4]">Section {section.section_index ?? "N/A"}</div>
            <div className="truncate text-xs text-[#8A8A9A]">
              {section.recommended_intervention ?? "No intervention assigned"}
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-[rgba(255,255,255,0.04)] px-2 py-1 text-xs font-semibold text-[#8A8A9A]">
            Legacy point suppressed
          </span>
        </div>
      ))}
    </div>
  );
}
