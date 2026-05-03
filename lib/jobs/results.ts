import { listR2Objects, getR2ObjectText, getPresignedGetUrl } from "@/lib/r2";
import { crackTypeLabel, normalizeCrackTypes } from "@/lib/crack-labels";
import type { FrameResult, JobResults, JobMode, JobResultsSummary } from "@/types";

interface RawDetection {
  frame?: {
    index?: number;
    timestamp_ms?: number | null;
    lat?: number | null;
    lon?: number | null;
    alt_m?: number | null;
    alt?: number | null;
  };
  pci_score?: number;
  crack_types?: string[];
  index?: number;
  timestamp_ms?: number | null;
  lat?: number | null;
  lon?: number | null;
  alt_m?: number | null;
  depth_estimate?: number | null;
  camera_surface_distance_m?: number | null;
  avg_crack_width_mm?: number | null;
  max_crack_width_mm?: number | null;
  crack_type_lengths_m?: Record<string, number> | null;
  crack_lengths_m_by_type?: Record<string, number> | null;
  depth_available?: boolean | null;
  depth_attempted?: boolean | null;
  depth_skipped_reason?: string | null;
  sam2_attempted?: boolean | null;
  yolo_detection_count?: number | null;
  final_detection_count?: number | null;
  processing_ms?: number | null;
  [key: string]: unknown;
}

export async function loadJobResults(
  jobId: string,
  userId: string,
  mode: JobMode,
): Promise<JobResults> {
  const prefix = `results/${userId}/${jobId}`;
  const detectionPrefix = `${prefix}/detections/`;
  const overlayPrefix = `${prefix}/overlays/`;

  const detectionKeys = await listR2Objects(detectionPrefix);
  if (detectionKeys.length === 0) {
    return emptyResults(jobId, mode);
  }
  let overlayKeys = new Set<string>();
  try {
    overlayKeys = new Set(await listR2Objects(overlayPrefix));
  } catch {
    overlayKeys = new Set();
  }

  // Fetch all detection JSONs in parallel (batched to avoid overwhelming R2)
  const BATCH = 50;
  const frames: FrameResult[] = [];
  for (let i = 0; i < detectionKeys.length; i += BATCH) {
    const batch = detectionKeys.slice(i, i + BATCH);
    const parsed = await Promise.all(
      batch.map(async (key) => {
        const text = await getR2ObjectText(key);
        const stem = key.replace(detectionPrefix, "").replace(/\.json$/, "");
        try {
          return { stem, data: JSON.parse(text) as RawDetection };
        } catch {
          return null;
        }
      }),
    );

    const overlayPresigns = await Promise.all(
      batch.map(async (key) => {
        const stem = key.replace(detectionPrefix, "").replace(/\.json$/, "");
        const overlayKey = `${overlayPrefix}${stem}.png`;
        if (!overlayKeys.has(overlayKey)) return null;
        try {
          return await getPresignedGetUrl(overlayKey, 3600);
        } catch {
          return null;
        }
      }),
    );

    for (let j = 0; j < parsed.length; j++) {
      const item = parsed[j];
      if (!item) continue;
      const { stem, data } = item;
      frames.push({
        stem,
        index: data.index ?? data.frame?.index ?? i + j,
        pci_score: typeof data.pci_score === "number" ? data.pci_score : 0,
        crack_types: normalizeCrackTypes(data.crack_types),
        crack_type_lengths_m:
          data.crack_type_lengths_m ?? data.crack_lengths_m_by_type ?? {},
        overlay_url: overlayPresigns[j],
        timestamp_ms: data.timestamp_ms ?? data.frame?.timestamp_ms ?? null,
        lat: data.lat ?? data.frame?.lat ?? null,
        lon: data.lon ?? data.frame?.lon ?? null,
        alt_m: data.alt_m ?? data.frame?.alt_m ?? data.frame?.alt ?? null,
        depth_estimate: data.depth_estimate ?? null,
        camera_surface_distance_m: data.camera_surface_distance_m ?? data.depth_estimate ?? null,
        avg_crack_width_mm: data.avg_crack_width_mm ?? null,
        max_crack_width_mm: data.max_crack_width_mm ?? null,
        depth_available: data.depth_available ?? null,
        depth_attempted: data.depth_attempted ?? null,
        depth_skipped_reason: data.depth_skipped_reason ?? null,
        sam2_attempted: data.sam2_attempted ?? null,
        yolo_detection_count: data.yolo_detection_count ?? null,
        final_detection_count: data.final_detection_count ?? null,
        processing_ms: data.processing_ms ?? null,
      });
    }
  }

  frames.sort((a, b) => a.index - b.index);

  const summary = computeSummary(frames);

  return { job_id: jobId, mode, summary, frames };
}

function computeSummary(frames: FrameResult[]): JobResultsSummary {
  if (frames.length === 0) {
    return { average_pci: 0, worst_pci: 0, best_pci: 0, crack_type_counts: {}, frame_count: 0 };
  }
  const scores = frames.map((f) => f.pci_score);
  const crack_type_counts: Record<string, number> = {};
  for (const f of frames) {
    for (const ct of f.crack_types) {
      const label = crackTypeLabel(ct);
      crack_type_counts[label] = (crack_type_counts[label] ?? 0) + 1;
    }
  }
  return {
    average_pci: scores.reduce((a, b) => a + b, 0) / scores.length,
    worst_pci: Math.min(...scores),
    best_pci: Math.max(...scores),
    crack_type_counts,
    frame_count: frames.length,
  };
}

function emptyResults(jobId: string, mode: JobMode): JobResults {
  return {
    job_id: jobId,
    mode,
    summary: { average_pci: 0, worst_pci: 0, best_pci: 0, crack_type_counts: {}, frame_count: 0 },
    frames: [],
  };
}
