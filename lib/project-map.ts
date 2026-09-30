import { ircRecommendation, type FrameResult, type GeoJsonGeometry, type JobMode, type JobResults, type RoadSectionProperties } from "@/types";

const SEGMENT_LENGTH_M = 100;
const EARTH_RADIUS_M = 6371000;

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

export interface ProjectMapFeature {
  type: "Feature";
  geometry: GeoJsonGeometry | null;
  properties: ProjectMapProperties;
}

export interface ProjectMapFeatureCollection {
  type: "FeatureCollection";
  features: ProjectMapFeature[];
}

export interface SurveySectionRow {
  id?: string | null;
  survey_id?: string | null;
  geom?: GeoJsonGeometry | null;
  section_index?: number | null;
  pci_score?: number | null;
  condition_category?: string | null;
  recommended_intervention?: string | null;
  priority_rank?: number | null;
  length_m?: number | null;
  crack_count?: number | null;
  crack_types?: string[] | null;
  avg_crack_width_mm?: number | null;
  max_crack_width_mm?: number | null;
  crack_length_m_by_type?: Record<string, number> | null;
  crack_metrics_estimated?: boolean | null;
  possible_causes?: string[] | null;
  recommended_mitigation?: string | null;
  maintenance_priority?: "Immediate" | "Preventive" | "Routine" | null;
  civil_severity?: "Low" | "Medium" | "High" | null;
  distress_severity?: "Low" | "Medium" | "High" | null;
}

export interface SourceMeta {
  id: string;
  label: string;
  created_at: string;
}

export function buildProjectMapCollection(args: {
  surveySections: SurveySectionRow[];
  surveyMetaById: Map<string, SourceMeta>;
  jobResults: Array<{ meta: SourceMeta & { mode: JobMode }; results: JobResults }>;
}): ProjectMapFeatureCollection {
  const surveyFeatures = args.surveySections
    .map((section) => surveySectionToFeature(section, args.surveyMetaById))
    .filter((feature): feature is ProjectMapFeature => feature !== null);

  const jobFeatures = args.jobResults.flatMap(({ meta, results }) =>
    jobResultsToFeatures(results, meta),
  );

  return {
    type: "FeatureCollection",
    features: [...surveyFeatures, ...jobFeatures],
  };
}

function surveySectionToFeature(
  section: SurveySectionRow,
  surveyMetaById: Map<string, SourceMeta>,
): ProjectMapFeature | null {
  const surveyId = section.survey_id;
  if (!surveyId || !section.geom) return null;

  const meta = surveyMetaById.get(surveyId);
  return {
    type: "Feature",
    geometry: section.geom,
    properties: {
      id: section.id ?? undefined,
      section_index: section.section_index ?? null,
      pci_score: section.pci_score ?? null,
      condition_category: normalizeConditionCategory(section.condition_category, section.pci_score ?? null),
      recommended_intervention:
        section.recommended_intervention ?? defaultIntervention(section.pci_score ?? null),
      priority_rank: section.priority_rank ?? null,
      length_m: section.length_m ?? null,
      crack_count: section.crack_count ?? 0,
      crack_types: section.crack_types ?? [],
      avg_crack_width_mm: section.avg_crack_width_mm ?? null,
      max_crack_width_mm: section.max_crack_width_mm ?? null,
      crack_length_m_by_type: section.crack_length_m_by_type ?? {},
      crack_metrics_estimated: section.crack_metrics_estimated ?? false,
      possible_causes: section.possible_causes ?? [],
      recommended_mitigation: section.recommended_mitigation ?? null,
      maintenance_priority: section.maintenance_priority ?? null,
      civil_severity: section.civil_severity ?? null,
      distress_severity: section.distress_severity ?? null,
      source_id: surveyId,
      source_kind: "survey",
      source_label: meta?.label ?? "Survey",
      source_created_at: meta?.created_at ?? "",
      segment_start_m:
        section.section_index != null ? section.section_index * SEGMENT_LENGTH_M : null,
      segment_end_m:
        section.section_index != null && section.length_m != null
          ? section.section_index * SEGMENT_LENGTH_M + section.length_m
          : null,
      is_relative: (section.length_m ?? SEGMENT_LENGTH_M) < SEGMENT_LENGTH_M,
    },
  };
}

function jobResultsToFeatures(
  results: JobResults,
  meta: SourceMeta & { mode: JobMode },
): ProjectMapFeature[] {
  const gpsFrames = results.frames.filter(
    (frame) => frame.lat != null && frame.lon != null,
  );
  if (gpsFrames.length === 0) return [];

  const cumulativeDistances = computeCumulativeDistances(gpsFrames);
  const segments = new Map<number, Array<{ frame: FrameResult; distance: number }>>();

  for (let index = 0; index < gpsFrames.length; index += 1) {
    const frame = gpsFrames[index];
    const distance = cumulativeDistances[index];
    const segmentIndex = Math.floor(distance / SEGMENT_LENGTH_M);
    const entry = segments.get(segmentIndex) ?? [];
    entry.push({ frame, distance });
    segments.set(segmentIndex, entry);
  }

  return Array.from(segments.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([segmentIndex, entries]) => {
      const firstDistance = entries[0]?.distance ?? 0;
      const lastDistance = entries.at(-1)?.distance ?? firstDistance;
      const totalLength = Math.max(0, lastDistance - firstDistance);
      const pci = average(entries.map((entry) => entry.frame.pci_score));
      const crackTypes = Array.from(
        new Set(entries.flatMap((entry) => entry.frame.crack_types)),
      ).sort();
      const avgWidth = averageNullable(
        entries.map((entry) => entry.frame.avg_crack_width_mm),
      );
      const maxWidth = maxNullable(
        entries.map((entry) => entry.frame.max_crack_width_mm ?? entry.frame.avg_crack_width_mm),
      );
      const crackLengthByType = mergeLengths(
        entries.map((entry) => entry.frame.crack_type_lengths_m),
      );
      const crackCount = entries.reduce(
        (sum, entry) => sum + (entry.frame.final_detection_count ?? entry.frame.yolo_detection_count ?? 0),
        0,
      );
      const coordinates = entries.map((entry) => [entry.frame.lon!, entry.frame.lat!] as [number, number]);
      if (coordinates.length === 1) {
        coordinates.push([...coordinates[0]] as [number, number]);
      }

      return {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates,
        },
        properties: {
          id: `${meta.id}-segment-${segmentIndex}`,
          section_index: segmentIndex,
          pci_score: round(pci),
          condition_category: pciBandLabel(round(pci)),
          recommended_intervention: defaultIntervention(pci),
          priority_rank: null,
          length_m: round(totalLength),
          crack_count: crackCount,
          crack_types: crackTypes,
          avg_crack_width_mm: avgWidth == null ? null : round(avgWidth),
          max_crack_width_mm: maxWidth == null ? null : round(maxWidth),
          crack_length_m_by_type: crackLengthByType,
          crack_metrics_estimated: entries.some((entry) => entry.frame.crack_metrics_estimated === true),
          possible_causes: [],
          recommended_mitigation: defaultIntervention(pci),
          maintenance_priority: maintenancePriority(pci),
          civil_severity: severityFromPci(pci),
          distress_severity: severityFromPci(pci),
          source_id: meta.id,
          source_kind: "job",
          source_label: meta.label,
          source_created_at: meta.created_at,
          segment_start_m: round(segmentIndex * SEGMENT_LENGTH_M),
          segment_end_m: round(segmentIndex * SEGMENT_LENGTH_M + totalLength),
          is_relative: totalLength < SEGMENT_LENGTH_M,
        },
      } satisfies ProjectMapFeature;
    });
}

function computeCumulativeDistances(frames: FrameResult[]) {
  if (frames.length === 0) return [];

  const distances = [0];
  let cumulative = 0;
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    if (
      previous.lat != null &&
      previous.lon != null &&
      current.lat != null &&
      current.lon != null
    ) {
      cumulative += haversineMeters(previous.lat, previous.lon, current.lat, current.lon);
    }
    distances.push(cumulative);
  }
  return distances;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function averageNullable(values: Array<number | null | undefined>) {
  const present = values.filter((value): value is number => value != null);
  return present.length > 0 ? average(present) : null;
}

function maxNullable(values: Array<number | null | undefined>) {
  const present = values.filter((value): value is number => value != null);
  return present.length > 0 ? Math.max(...present) : null;
}

function mergeLengths(lengths: Array<Record<string, number>>) {
  const merged: Record<string, number> = {};
  for (const entry of lengths) {
    for (const [type, value] of Object.entries(entry)) {
      merged[type] = (merged[type] ?? 0) + value;
    }
  }
  return Object.fromEntries(
    Object.entries(merged).map(([type, value]) => [type, round(value)]),
  );
}

function normalizeConditionCategory(value: string | null | undefined, pci: number | null) {
  if (value === "good" || value === "satisfactory" || value === "fair" || value === "poor" || value === "very_poor") {
    return value;
  }
  return pciBandLabel(pci);
}

function pciBandLabel(pci: number | null) {
  if (pci == null) return null;
  if (pci >= 85) return "good";
  if (pci >= 70) return "satisfactory";
  if (pci >= 55) return "fair";
  if (pci >= 40) return "poor";
  return "very_poor";
}

function severityFromPci(pci: number | null): "Low" | "Medium" | "High" | null {
  if (pci == null) return null;
  if (pci >= 70) return "Low";
  if (pci >= 40) return "Medium";
  return "High";
}

function maintenancePriority(pci: number | null): "Immediate" | "Preventive" | "Routine" | null {
  if (pci == null) return null;
  if (pci < 40) return "Immediate";
  if (pci < 70) return "Preventive";
  return "Routine";
}

function defaultIntervention(pci: number | null) {
  if (pci == null) return "Not assigned";
  return ircRecommendation(pci);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
