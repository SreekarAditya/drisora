import { listR2Objects, getR2ObjectText, getPresignedGetUrl } from "@/lib/r2";
import type { FrameResult, JobResults, JobMode, JobResultsSummary } from "@/types";

interface RawDetection {
  pci_score?: number;
  crack_types?: string[];
  index?: number;
  timestamp_ms?: number | null;
  lat?: number | null;
  lon?: number | null;
  alt_m?: number | null;
  depth_estimate?: number | null;
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
        index: data.index ?? i + j,
        pci_score: typeof data.pci_score === "number" ? data.pci_score : 0,
        crack_types: Array.isArray(data.crack_types) ? data.crack_types : [],
        overlay_url: overlayPresigns[j],
        timestamp_ms: data.timestamp_ms ?? null,
        lat: data.lat ?? null,
        lon: data.lon ?? null,
        alt_m: data.alt_m ?? null,
        depth_estimate: data.depth_estimate ?? null,
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
      crack_type_counts[ct] = (crack_type_counts[ct] ?? 0) + 1;
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
