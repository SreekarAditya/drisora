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
    <div className="min-w-56 space-y-3 text-sm text-neutral-100">
      <div>
        <div className="text-xs uppercase tracking-wide text-neutral-400">Source</div>
        <div className="text-sm font-medium text-white">{properties.source_label}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-400">
            {properties.is_relative ? "Relative PCI" : "PCI score"}
          </div>
          <div className="text-2xl font-semibold text-white">
            {properties.pci_score == null ? "N/A" : properties.pci_score.toFixed(1)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-400">Condition</div>
          <div className="text-sm font-medium capitalize text-white">
            {properties.condition_category?.replace("_", " ") ?? "Unknown"}
          </div>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-neutral-400">Section</span>
          <span className="font-medium text-white">
            {properties.section_index == null ? "N/A" : properties.section_index + 1}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-400">Start chainage</span>
          <span className="font-mono text-white">{formatMeters(properties.segment_start_m)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-400">End chainage</span>
          <span className="font-mono text-white">{formatMeters(properties.segment_end_m)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-400">Length</span>
          <span className="font-mono text-white">{formatMeters(properties.length_m)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-400">Segment type</span>
          <span className="font-medium text-white">
            {properties.is_relative ? "Relative (<100 m)" : "Standard 100 m"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-400">Cracks</span>
          <span className="font-medium text-white">{properties.crack_count}</span>
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
                <span className="font-mono text-neutral-100">{length.toFixed(1)} m</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 text-xs uppercase tracking-wide text-neutral-400">Recommended action</div>
        <p className="text-xs leading-5 text-neutral-200">
          {properties.recommended_mitigation ?? properties.recommended_intervention ?? "Not assigned"}
        </p>
      </div>
    </div>
  );
}
