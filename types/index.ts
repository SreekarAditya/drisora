export type SurveyStatus = "uploading" | "queued" | "processing" | "complete" | "failed";

export interface Survey {
  id: string;
  user_id: string;
  name: string;
  location: string | null;
  engineer_name: string | null;
  surveyed_at: string | null;
  created_at: string;
  status: SurveyStatus;
  r2_key?: string | null;
  r2_upload_id?: string | null;
  srt_path?: string | null;
  report_path?: string | null;
  total_length_m?: number | null;
  average_pci?: number | null;
  coverage_area_m2?: number | null;
}

export type ConditionCategory = "good" | "satisfactory" | "fair" | "poor" | "very_poor";

export interface RoadSectionProperties {
  id?: string;
  section_index: number | null;
  pci_score: number | null;
  condition_category: ConditionCategory | string | null;
  recommended_intervention: string | null;
  priority_rank: number | null;
  length_m: number | null;
  crack_count: number;
  crack_types: string[];
}

export interface RoadSectionFeature {
  type: "Feature";
  geometry: GeoJsonGeometry | null;
  properties: RoadSectionProperties;
}

export interface RoadSectionFeatureCollection {
  type: "FeatureCollection";
  features: RoadSectionFeature[];
}

export type GeoJsonGeometry =
  | {
      type: "LineString";
      coordinates: [number, number][] | [number, number, number][];
    }
  | {
      type: string;
      coordinates: unknown;
    };

export type PCIBand = {
  label: string
  range: string
  min: number
  max: number
  color: string
  textColor: string
}

export const PCI_BANDS: PCIBand[] = [
  { label: "Good",         range: "85–100", min: 85, max: 100, color: "#22c55e", textColor: "#ffffff" },
  { label: "Satisfactory", range: "70–84",  min: 70, max: 84,  color: "#eab308", textColor: "#000000" },
  { label: "Fair",         range: "55–69",  min: 55, max: 69,  color: "#f97316", textColor: "#ffffff" },
  { label: "Poor",         range: "40–54",  min: 40, max: 54,  color: "#ef4444", textColor: "#ffffff" },
  { label: "Very Poor",    range: "0–39",   min: 0,  max: 39,  color: "#7f1d1d", textColor: "#ffffff" },
]

export function getPciBand(score: number): PCIBand {
  return PCI_BANDS.find((band) => score >= band.min && score <= band.max) ?? PCI_BANDS[PCI_BANDS.length - 1];
}
