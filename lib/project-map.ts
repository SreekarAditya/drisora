import type { GeoJsonGeometry, JobMode, JobResults, RoadSectionProperties } from "@/types";

const SEGMENT_LENGTH_M = 100;

export type ProjectMapSourceKind = "job" | "survey";

export interface ProjectMapProperties extends RoadSectionProperties {
  source_id: string;
  source_kind: ProjectMapSourceKind;
  source_label: string;
  source_created_at: string;
  segment_start_m: number | null;
  segment_end_m: number | null;
  is_relative: boolean;
}

export interface ProjectMapFeature { type: "Feature"; geometry: GeoJsonGeometry | null; properties: ProjectMapProperties }
export interface ProjectMapFeatureCollection { type: "FeatureCollection"; features: ProjectMapFeature[] }

export interface SurveySectionRow {
  id?: string | null;
  survey_id?: string | null;
  geom?: GeoJsonGeometry | null;
  section_index?: number | null;
  length_m?: number | null;
  crack_count?: number | null;
  crack_types?: string[] | null;
  avg_crack_width_mm?: number | null;
  max_crack_width_mm?: number | null;
  crack_length_m_by_type?: Record<string, number> | null;
}

export interface SourceMeta { id: string; label: string; created_at: string }

export function buildProjectMapCollection(args: {
  surveySections: SurveySectionRow[];
  surveyMetaById: Map<string, SourceMeta>;
  jobResults: Array<{ meta: SourceMeta & { mode: JobMode }; results: JobResults }>;
}): ProjectMapFeatureCollection {
  const surveyFeatures = args.surveySections
    .map((section) => surveySectionToFeature(section, args.surveyMetaById))
    .filter((feature): feature is ProjectMapFeature => feature !== null);
  const jobFeatures = args.jobResults.flatMap(({ meta, results }) =>
    results.sections.map((section) => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString",
        coordinates: [[section.start_lon, section.start_lat], [section.end_lon, section.end_lat]],
      } satisfies GeoJsonGeometry,
      properties: {
        id: `${meta.id}-${section.section_id}`,
        section_index: section.segment_index,
        pci_score: null,
        pci_bounds: section.pci_bounds,
        condition_category: null,
        recommended_intervention: null,
        priority_rank: null,
        length_m: section.section_length_m,
        crack_count: section.unique_detection_count,
        crack_types: [],
        avg_crack_width_mm: null,
        max_crack_width_mm: null,
        crack_length_m_by_type: {},
        crack_metrics_estimated: false,
        possible_causes: [],
        recommended_mitigation: null,
        maintenance_priority: null,
        civil_severity: null,
        distress_severity: null,
        source_id: meta.id,
        source_kind: "job" as const,
        source_label: meta.label,
        source_created_at: meta.created_at,
        segment_start_m: section.start_distance_m,
        segment_end_m: section.end_distance_m,
        is_relative: section.is_relative,
      },
    } satisfies ProjectMapFeature)),
  );
  return { type: "FeatureCollection", features: [...surveyFeatures, ...jobFeatures] };
}

function surveySectionToFeature(section: SurveySectionRow, surveyMetaById: Map<string, SourceMeta>): ProjectMapFeature | null {
  const surveyId = section.survey_id;
  if (!surveyId || !section.geom) return null;
  const meta = surveyMetaById.get(surveyId);
  return {
    type: "Feature",
    geometry: section.geom,
    properties: {
      id: section.id ?? undefined,
      section_index: section.section_index ?? null,
      pci_score: null,
      pci_bounds: null,
      condition_category: null,
      recommended_intervention: null,
      priority_rank: null,
      length_m: section.length_m ?? null,
      crack_count: section.crack_count ?? 0,
      crack_types: section.crack_types ?? [],
      avg_crack_width_mm: section.avg_crack_width_mm ?? null,
      max_crack_width_mm: section.max_crack_width_mm ?? null,
      crack_length_m_by_type: section.crack_length_m_by_type ?? {},
      crack_metrics_estimated: false,
      possible_causes: [],
      recommended_mitigation: null,
      maintenance_priority: null,
      civil_severity: null,
      distress_severity: null,
      source_id: surveyId,
      source_kind: "survey",
      source_label: meta?.label ?? "Legacy survey",
      source_created_at: meta?.created_at ?? "",
      segment_start_m: section.section_index == null ? null : section.section_index * SEGMENT_LENGTH_M,
      segment_end_m: section.section_index == null || section.length_m == null ? null : section.section_index * SEGMENT_LENGTH_M + section.length_m,
      is_relative: (section.length_m ?? SEGMENT_LENGTH_M) < SEGMENT_LENGTH_M,
    },
  };
}
