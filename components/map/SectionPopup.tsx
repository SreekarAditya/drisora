import type { RoadSectionProperties } from "@/types";

interface SectionPopupProps {
  properties: RoadSectionProperties;
}

export function SectionPopup({ properties }: SectionPopupProps) {
  const crackTypes = properties.crack_types.length > 0 ? properties.crack_types : ["None recorded"];
  const lengthEntries = Object.entries(properties.crack_length_m_by_type ?? {});

  return (
    <div className="min-w-52 space-y-3 text-sm text-[#F0F0F4]">
      <div>
        <div className="text-xs uppercase tracking-wide text-[#8A8A9A]">PCI score</div>
        <div className="text-2xl font-semibold text-[#F0F0F4]">
          {properties.pci_score == null ? "N/A" : Math.round(properties.pci_score)}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-[#8A8A9A]">Condition</span>
          <span className="font-medium capitalize text-[#F0F0F4]">
            {properties.condition_category?.replace("_", " ") ?? "Unknown"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#8A8A9A]">Intervention</span>
          <span className="max-w-40 text-right font-medium text-[#F0F0F4]">
            {properties.recommended_intervention ?? "Not assigned"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#8A8A9A]">Cracks</span>
          <span className="font-medium text-[#F0F0F4]">{properties.crack_count}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#8A8A9A]">Max width</span>
          <span className="font-mono text-[#F0F0F4]">
            {properties.max_crack_width_mm == null ? "N/A" : `${properties.max_crack_width_mm.toFixed(1)} mm`}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#8A8A9A]">Avg width</span>
          <span className="font-mono text-[#F0F0F4]">
            {properties.avg_crack_width_mm == null ? "N/A" : `${properties.avg_crack_width_mm.toFixed(1)} mm`}
          </span>
        </div>
        {properties.crack_metrics_estimated && properties.crack_count > 0 && (
          <div className="rounded-md bg-[#F5A623]/10 px-2 py-1 text-xs text-[#FFBE4D]">
            Width and length metrics estimated for a legacy section.
          </div>
        )}
      </div>

      <div>
        <div className="mb-1 text-xs uppercase tracking-wide text-[#8A8A9A]">Types</div>
        <div className="flex flex-wrap gap-1">
          {crackTypes.map((type) => (
            <span key={type} className="rounded-full bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-xs text-[#F0F0F4]">
              {type}
            </span>
          ))}
        </div>
      </div>

      {lengthEntries.length > 0 && (
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-[#8A8A9A]">Length by type</div>
          <div className="space-y-1">
            {lengthEntries.map(([type, length]) => (
              <div key={type} className="flex justify-between gap-3 text-xs">
                <span className="text-[#8A8A9A]">{type}</span>
                <span className="font-mono text-[#F0F0F4]">{length.toFixed(2)} m</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 text-xs uppercase tracking-wide text-[#8A8A9A]">Recommended Action</div>
        <p className="text-xs leading-5 text-[#F0F0F4]">
          {properties.recommended_mitigation ?? properties.recommended_intervention ?? "Not assigned"}
        </p>
        {properties.maintenance_priority && (
          <span className="mt-2 inline-flex rounded-full bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-xs text-[#F0F0F4]">
            {properties.maintenance_priority}
          </span>
        )}
      </div>
    </div>
  );
}
