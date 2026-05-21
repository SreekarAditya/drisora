import type { ProjectMapProperties } from "@/lib/project-map";

interface ProjectSectionPopupProps {
  properties: ProjectMapProperties;
}

function formatMeters(value: number | null | undefined) {
  if (value == null) return "N/A";
  return `${value.toFixed(1)} m`;
}

export function ProjectSectionPopup({ properties }: ProjectSectionPopupProps) {
  const crackTypes = properties.crack_types.length > 0 ? properties.crack_types : ["None recorded"];
  const lengthEntries = Object.entries(properties.crack_length_m_by_type ?? {});

  return (
    <div className="min-w-56 space-y-3 text-sm text-[#F0F0F4]">
      <div>
        <div className="text-xs uppercase tracking-wide text-[#8A8A9A]">Source</div>
        <div className="text-sm font-medium text-[#F0F0F4]">{properties.source_label}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-[#8A8A9A]">
            {properties.is_relative ? "Relative PCI" : "PCI score"}
          </div>
          <div className="text-2xl font-semibold text-[#F0F0F4]">
            {properties.pci_score == null ? "N/A" : properties.pci_score.toFixed(1)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-[#8A8A9A]">Condition</div>
          <div className="text-sm font-medium capitalize text-[#F0F0F4]">
            {properties.condition_category?.replace("_", " ") ?? "Unknown"}
          </div>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-[#8A8A9A]">Section</span>
          <span className="font-medium text-[#F0F0F4]">
            {properties.section_index == null ? "N/A" : properties.section_index + 1}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#8A8A9A]">Start chainage</span>
          <span className="font-mono text-[#F0F0F4]">{formatMeters(properties.segment_start_m)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#8A8A9A]">End chainage</span>
          <span className="font-mono text-[#F0F0F4]">{formatMeters(properties.segment_end_m)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#8A8A9A]">Length</span>
          <span className="font-mono text-[#F0F0F4]">{formatMeters(properties.length_m)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#8A8A9A]">Segment type</span>
          <span className="font-medium text-[#F0F0F4]">
            {properties.is_relative ? "Relative (<100 m)" : "Standard 100 m"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#8A8A9A]">Cracks</span>
          <span className="font-medium text-[#F0F0F4]">{properties.crack_count}</span>
        </div>
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
                <span className="font-mono text-[#F0F0F4]">{length.toFixed(1)} m</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 text-xs uppercase tracking-wide text-[#8A8A9A]">Recommended action</div>
        <p className="text-xs leading-5 text-[#F0F0F4]">
          {properties.recommended_mitigation ?? properties.recommended_intervention ?? "Not assigned"}
        </p>
      </div>
    </div>
  );
}
