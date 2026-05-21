import type { RoadSectionProperties } from "@/types";

interface PrioritySectionsProps {
  sections: RoadSectionProperties[];
}

function pciBadgeClass(pci: number | null): string {
  if (pci == null) return "bg-[rgba(255,255,255,0.04)] text-[#8A8A9A]";
  if (pci >= 85) return "bg-[rgba(34,197,94,0.12)] text-[#22C55E]";
  if (pci >= 70) return "bg-[rgba(245,166,35,0.10)] text-[#F5A623]";
  if (pci >= 55) return "bg-[rgba(249,115,22,0.12)] text-[#F97316]";
  if (pci >= 40) return "bg-[rgba(239,68,68,0.10)] text-[#EF4444]";
  return "bg-[rgba(239,68,68,0.15)] text-[#EF4444]";
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
          <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${pciBadgeClass(section.pci_score)}`}>
            PCI {section.pci_score == null ? "N/A" : Math.round(section.pci_score)}
          </span>
        </div>
      ))}
    </div>
  );
}
