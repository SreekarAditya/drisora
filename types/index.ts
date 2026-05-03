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
  if (pci >= 85) return "No maintenance required";
  if (pci >= 70) return "Preventive maintenance";
  if (pci >= 55) return "Minor rehabilitation";
  if (pci >= 40) return "Major rehabilitation";
  return "Reconstruction";
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
  options: Record<string, unknown>;
  file_names: string[];
  total_bytes: number;
}

export interface FrameResult {
  stem: string;
  index: number;
  pci_score: number;
  crack_types: string[];
  crack_type_lengths_m: Record<string, number>;
  overlay_url: string | null;
  timestamp_ms: number | null;
  lat: number | null;
  lon: number | null;
  alt_m: number | null;
  depth_estimate: number | null;
  camera_surface_distance_m: number | null;
  avg_crack_width_mm: number | null;
  max_crack_width_mm: number | null;
  crack_metrics_estimated?: boolean;
  crack_metrics_source?: "none" | "measured" | "estimated";
  depth_available: boolean | null;
  depth_attempted: boolean | null;
  depth_skipped_reason: string | null;
  sam2_attempted: boolean | null;
  yolo_detection_count: number | null;
  final_detection_count: number | null;
  processing_ms: number | null;
}

export interface JobResultsSummary {
  average_pci: number;
  worst_pci: number;
  best_pci: number;
  crack_type_counts: Record<string, number>;
  frame_count: number;
}

export interface JobResults {
  job_id: string;
  mode: JobMode;
  summary: JobResultsSummary;
  frames: FrameResult[];
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
  { label: "Good",         range: "85–100", min: 85, max: 100, color: "#22c55e", textColor: "#ffffff" },
  { label: "Satisfactory", range: "70–84",  min: 70, max: 84,  color: "#eab308", textColor: "#000000" },
  { label: "Fair",         range: "55–69",  min: 55, max: 69,  color: "#f97316", textColor: "#ffffff" },
  { label: "Poor",         range: "40–54",  min: 40, max: 54,  color: "#ef4444", textColor: "#ffffff" },
  { label: "Very Poor",    range: "0–39",   min: 0,  max: 39,  color: "#7f1d1d", textColor: "#ffffff" },
]

export function getPciBand(score: number): PCIBand {
  return PCI_BANDS.find((band) => score >= band.min && score <= band.max) ?? PCI_BANDS[PCI_BANDS.length - 1];
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
