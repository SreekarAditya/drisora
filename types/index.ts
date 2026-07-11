// ─── Job types ───────────────────────────────────────────────────────────────

export type JobMode = "image_batch" | "handheld_video" | "drone_footage";

export type JobStatus =
  | "uploading"
  | "queued"
  | "extracting_frames"
  | "detecting"
  | "segmenting"
  | "scoring"
  | "complete"
  | "failed";

export const JOB_MODE_LABELS: Record<JobMode, string> = {
  image_batch: "Image Batch",
  handheld_video: "Handheld Video",
  drone_footage: "Drone Footage",
};

export function ircRecommendation(pci: number): string {
  if (pci > 90) return "Routine Maintenance";
  if (pci > 80) return "Preventive Maintenance";
  if (pci > 60) return "Renewal";
  if (pci > 40) return "Minor Rehabilitation (based on structural evaluation)";
  if (pci > 20) return "Major Rehabilitation / Structural Overlay";
  return "Reconstruction";
}

export interface PciBounds {
  lower: number;
  upper: number;
  width: number;
}

export interface JobRecord {
  id: string;
  user_id: string;
  project_id?: string | null;
  mode: JobMode;
  status: JobStatus;
  frame_count: number;
  processed_count: number;
  gps_available: boolean;
  average_pci: number | null;
  pci_lower?: number | null;
  pci_upper?: number | null;
  pci_complete?: number | null;
  partial_pci_sections_key?: string | null;
  r2_prefix: string | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  deleted_at?: string | null;
}

export interface ProcessingJobRecord {
  job_id: string;
  user_id: string;
  project_id?: string | null;
  runpod_job_id: string | null;
  mode: JobMode;
  status: JobStatus;
  frame_count: number;
  processed_count: number;
  gps_available: boolean;
  output_r2_prefix: string;
  last_updated: string;
  created_at: string;
  error_message: string | null;
  average_pci?: number | null;
  pci_complete?: null;
  pci_bounds?: PciBounds | null;
  partial_pci?: JobResultsSummary | null;
  partial_pci_sections_key?: string | null;
  completed_at?: string | null;
  options: Record<string, unknown>;
  file_names: string[];
  total_bytes: number;
}

export interface FrameResult {
  stem: string;
  index: number;
  pci_score: null;
  crack_types: string[];
  crack_type_lengths_m: Record<string, number>;
  overlay_url: string | null;
  image_url?: string | null;
  timestamp_ms: number | null;
  lat: number | null;
  lon: number | null;
  alt_m: number | null;
  depth_estimate: number | null;
  camera_surface_distance_m: number | null;
  avg_crack_width_mm: number | null;
  max_crack_width_mm: number | null;
  crack_metrics_estimated?: boolean;
  crack_metrics_source?: "none" | "measured";
  depth_available: boolean | null;
  depth_attempted: boolean | null;
  depth_skipped_reason: string | null;
  analysis_stage?: "yolo_no_distress_found" | "yolo_sam2" | string | null;
  degraded_reasons?: string[];
  sam2_attempted: boolean | null;
  yolo_detection_count: number | null;
  final_detection_count: number | null;
  processing_ms: number | null;
  image_width?: number | null;
  image_height?: number | null;
  detection_annotations?: DetectionAnnotation[];
}

export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  normalized: boolean;
}

export interface DetectionMaskPolygon {
  points: Array<[number, number]>;
  normalized: boolean;
}

export interface DetectionAnnotation {
  id: string;
  label: string;
  confidence: number | null;
  box: DetectionBox | null;
  mask_polygons: DetectionMaskPolygon[];
}

export interface JobResultsSummary {
  pci_complete: null;
  pci_bounds: PciBounds | null;
  measured_weight_fraction: number;
  unmeasured_weight_fraction: number;
  crack_type_counts: Record<string, number>;
  frame_count: number;
  segment_count: number;
  assessment_scope: string;
}

export interface PartialPciSection {
  segment_index: number;
  section_id: string;
  start_distance_m: number;
  end_distance_m: number;
  section_length_m: number;
  section_area_m2: number;
  start_lat: number;
  start_lon: number;
  end_lat: number;
  end_lon: number;
  frame_count: number;
  is_relative: boolean;
  raw_detection_count: number;
  unique_detection_count: number;
  pci_complete: null;
  pci_bounds: PciBounds;
  assessment?: {
    road_class?: string;
    surface_type?: string | null;
    measured?: {
      cracking?: { area_m2?: number; extent_pct?: number; sub_index?: number };
      pothole?: { area_m2?: number; number?: number; sub_index?: number };
    };
    unmeasured?: Record<string, null>;
    provenance?: Record<string, unknown>;
  };
}

export interface JobResults {
  job_id: string;
  mode: JobMode;
  summary: JobResultsSummary;
  frames: FrameResult[];
  sections: PartialPciSection[];
}

// ─── Survey types (legacy — do not extend) ───────────────────────────────────

export type SurveyStatus = "uploading" | "queued" | "processing" | "complete" | "failed";

export interface Survey {
  id: string;
  user_id: string;
  project_id?: string | null;
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
  deleted_at?: string | null;
}

export type ConditionCategory = "good" | "satisfactory" | "fair" | "poor" | "very_poor";

export interface RoadSectionProperties {
  id?: string;
  section_index: number | null;
  pci_score: number | null;
  pci_bounds?: PciBounds | null;
  condition_category: ConditionCategory | string | null;
  recommended_intervention: string | null;
  priority_rank: number | null;
  length_m: number | null;
  crack_count: number;
  crack_types: string[];
  avg_crack_width_mm?: number | null;
  max_crack_width_mm?: number | null;
  crack_length_m_by_type?: Record<string, number>;
  crack_metrics_estimated?: boolean;
  possible_causes?: string[];
  recommended_mitigation?: string | null;
  maintenance_priority?: "Immediate" | "Preventive" | "Routine" | null;
  civil_severity?: "Low" | "Medium" | "High" | null;
  distress_severity?: "Low" | "Medium" | "High" | null;
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
  { label: "Excellent",    range: ">90–100", min: 90, max: 100, color: "#22c55e", textColor: "#ffffff" },
  { label: "Good",         range: ">80–90",  min: 80, max: 90,  color: "#84cc16", textColor: "#000000" },
  { label: "Satisfactory", range: ">60–80",  min: 60, max: 80,  color: "#eab308", textColor: "#000000" },
  { label: "Fair",         range: ">40–60",  min: 40, max: 60,  color: "#f97316", textColor: "#ffffff" },
  { label: "Poor",         range: ">20–40",  min: 20, max: 40,  color: "#ef4444", textColor: "#ffffff" },
  { label: "Fail",         range: "0–20",    min: 0, max: 20, color: "#7f1d1d", textColor: "#ffffff" },
]

export function getPciBand(score: number): PCIBand {
  if (score > 90) return PCI_BANDS[0];
  if (score > 80) return PCI_BANDS[1];
  if (score > 60) return PCI_BANDS[2];
  if (score > 40) return PCI_BANDS[3];
  if (score > 20) return PCI_BANDS[4];
  return PCI_BANDS[5];
}

// ─── Project types ───────────────────────────────────────────────────────────

export interface ProjectRecord {
  id: string;
  user_id: string;
  name: string;
  road_name: string | null;
  package_code: string | null;
  agency: string | null;
  corridor: string | null;
  location: string | null;
  description: string | null;
  start_chainage_km: number | null;
  end_chainage_km: number | null;
  combined_report_path: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProjectLinkedSurvey {
  id: string;
  name: string;
  status: SurveyStatus | JobStatus;
  average_pci: number | null;
  created_at: string;
  completed_at?: string | null;
  mode?: JobMode;
  source: "survey" | "job";
}
