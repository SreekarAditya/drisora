import type { ProjectMapProperties } from "@/lib/project-map";

export function ProjectSectionPopup({ properties }: { properties: ProjectMapProperties }) {
  const bounds = properties.pci_bounds;
  return <div className="min-w-56 space-y-3 text-sm text-[#F0F0F4]"><div><div className="text-xs uppercase tracking-wide text-[#8A8A9A]">Source</div><div>{properties.source_label}</div></div><div><div className="text-xs uppercase tracking-wide text-[#8A8A9A]">PCI bounds</div><div className="text-xl font-semibold text-[#F5A623]">{bounds ? `${bounds.lower.toFixed(1)}–${bounds.upper.toFixed(1)}` : "Not available"}</div></div><div className="text-xs text-[#8A8A9A]">Chainage {properties.segment_start_m?.toFixed(0) ?? "N/A"}–{properties.segment_end_m?.toFixed(0) ?? "N/A"} m · {properties.is_relative ? "partial section" : "100 m section"}</div><div className="text-xs">{properties.crack_count} spatially unique detections</div>{!bounds && <div className="rounded bg-white/5 p-2 text-xs text-[#FFBE4D]">Legacy point score suppressed.</div>}</div>;
}
