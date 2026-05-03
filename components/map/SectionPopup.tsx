import type { RoadSectionProperties } from "@/types";

interface SectionPopupProps {
  properties: RoadSectionProperties;
}

export function SectionPopup({ properties }: SectionPopupProps) {
  const crackTypes = properties.crack_types.length > 0 ? properties.crack_types : ["None recorded"];
  const lengthEntries = Object.entries(properties.crack_length_m_by_type ?? {});

  return (
    <div className="min-w-52 space-y-3 text-sm text-neutral-100">
      <div>
        <div className="text-xs uppercase tracking-wide text-neutral-400">PCI score</div>
        <div className="text-2xl font-semibold text-white">
          {properties.pci_score == null ? "N/A" : Math.round(properties.pci_score)}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-neutral-400">Condition</span>
          <span className="font-medium capitalize text-white">
            {properties.condition_category?.replace("_", " ") ?? "Unknown"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-400">Intervention</span>
          <span className="max-w-40 text-right font-medium text-white">
            {properties.recommended_intervention ?? "Not assigned"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-400">Cracks</span>
          <span className="font-medium text-white">{properties.crack_count}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-400">Max width</span>
          <span className="font-mono text-white">
            {properties.max_crack_width_mm == null ? "N/A" : `${properties.max_crack_width_mm.toFixed(1)} mm`}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-400">Avg width</span>
          <span className="font-mono text-white">
            {properties.avg_crack_width_mm == null ? "N/A" : `${properties.avg_crack_width_mm.toFixed(1)} mm`}
          </span>
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs uppercase tracking-wide text-neutral-400">Types</div>
        <div className="flex flex-wrap gap-1">
          {crackTypes.map((type) => (
            <span key={type} className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-200">
              {type}
            </span>
          ))}
        </div>
      </div>

      {lengthEntries.length > 0 && (
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-neutral-400">Length by type</div>
          <div className="space-y-1">
            {lengthEntries.map(([type, length]) => (
              <div key={type} className="flex justify-between gap-3 text-xs">
                <span className="text-neutral-400">{type}</span>
                <span className="font-mono text-neutral-100">{length.toFixed(2)} m</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 text-xs uppercase tracking-wide text-neutral-400">Recommended Action</div>
        <p className="text-xs leading-5 text-neutral-200">
          {properties.recommended_mitigation ?? properties.recommended_intervention ?? "Not assigned"}
        </p>
        {properties.maintenance_priority && (
          <span className="mt-2 inline-flex rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-200">
            {properties.maintenance_priority}
          </span>
        )}
      </div>
    </div>
  );
}
