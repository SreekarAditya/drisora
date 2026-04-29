import type { RoadSectionProperties } from "@/types";

interface PrioritySectionsProps {
  sections: RoadSectionProperties[];
}

function pciBadgeClass(pci: number | null): string {
  if (pci == null) return "bg-neutral-800 text-neutral-300";
  if (pci >= 85) return "bg-green-500/20 text-green-300";
  if (pci >= 70) return "bg-yellow-500/20 text-yellow-300";
  if (pci >= 55) return "bg-orange-500/20 text-orange-300";
  if (pci >= 40) return "bg-red-500/20 text-red-300";
  return "bg-red-950 text-red-300";
}

export function PrioritySections({ sections }: PrioritySectionsProps) {
  const prioritySections = [...sections]
    .filter((section) => section.priority_rank != null)
    .sort((a, b) => (a.priority_rank ?? Number.MAX_SAFE_INTEGER) - (b.priority_rank ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 5);

  if (prioritySections.length === 0) {
    return <p className="text-sm text-neutral-400">No priority sections assigned.</p>;
  }

  return (
    <div className="space-y-3">
      {prioritySections.map((section) => (
        <div
          key={`${section.priority_rank}-${section.section_index}`}
          className="flex items-center justify-between gap-4 border-b border-neutral-800 pb-3 last:border-b-0 last:pb-0"
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-white">Section {section.section_index ?? "N/A"}</div>
            <div className="truncate text-xs text-neutral-400">
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
