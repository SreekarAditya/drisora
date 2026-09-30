import { listR2Objects, getR2ObjectText, getPresignedGetUrl } from "@/lib/r2";
import { crackTypeLabel, normalizeCrackTypes } from "@/lib/crack-labels";
import { deriveCrackMetrics } from "@/lib/crack-metrics";
import { parseDetectionAnnotations, parseImageSize } from "@/lib/detection-annotations";
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
  alt?: number | null;
  depth_estimate?: number | null;
  camera_surface_distance_m?: number | null;
  avg_crack_width_mm?: number | null;
  max_crack_width_mm?: number | null;
  crack_type_lengths_m?: Record<string, number> | null;
  crack_lengths_m_by_type?: Record<string, number> | null;
  depth_available?: boolean | null;
  depth_attempted?: boolean | null;
  depth_skipped_reason?: string | null;
  analysis_stage?: string | null;
  degraded_reasons?: string[] | null;
  sam2_attempted?: boolean | null;
  yolo_detection_count?: number | null;
  final_detection_count?: number | null;
  detections?: Array<{ class?: string | null; crack_type?: string | null }>;
  processing_ms?: number | null;
  [key: string]: unknown;
}

interface LoadJobResultsOptions {
  includeMediaUrls?: boolean;
  hydrateGpsFromSrt?: boolean;
}

interface SrtGpsEntry {
  timestamp_ms: number;
  lat: number;
  lon: number;
  alt_m: number | null;
}

const SRT_TIMECODE_RE =
  /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/;
const SRT_LAT_RE = /latitude\s*[:=]\s*(-?\d+(?:\.\d+)?)/i;
const SRT_LON_RE = /longitude\s*[:=]\s*(-?\d+(?:\.\d+)?)/i;
const SRT_GPS_TUPLE_RE =
  /GPS\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*(-?\d+(?:\.\d+)?))?\s*\)/i;
const SRT_ABS_ALT_RE = /abs_alt\s*[:=]\s*(-?\d+(?:\.\d+)?)/i;
const SRT_REL_ALT_RE = /rel_alt\s*[:=]\s*(-?\d+(?:\.\d+)?)/i;
const SRT_ALT_RE = /(?:^|\s|\[)alt(?:itude)?\s*[:=]\s*(-?\d+(?:\.\d+)?)/i;

export async function loadJobResults(
  jobId: string,
  userId: string,
  mode: JobMode,
  options: LoadJobResultsOptions = {},
): Promise<JobResults> {
  const includeMediaUrls = options.includeMediaUrls ?? true;
  const hydrateGpsFromSrtOption = options.hydrateGpsFromSrt ?? true;
  const prefix = `results/${userId}/${jobId}`;
  const detectionPrefix = `${prefix}/detections/`;
  const overlayPrefix = `${prefix}/overlays/`;
  const framePrefix = `${prefix}/frames/`;
  const rawPrefix = `uploads/${userId}/${jobId}/raw/`;

  const detectionKeys = await listR2Objects(detectionPrefix);
  if (detectionKeys.length === 0) {
    return emptyResults(jobId, mode);
  }
  let overlayKeys = new Set<string>();
  let frameKeys = new Set<string>();
  let rawKeys = new Set<string>();
  if (includeMediaUrls) {
    try {
      overlayKeys = new Set(await listR2Objects(overlayPrefix));
    } catch {
      overlayKeys = new Set();
    }
    try {
      frameKeys = new Set(await listR2Objects(framePrefix));
    } catch {
      frameKeys = new Set();
    }
    if (mode === "image_batch") {
      try {
        rawKeys = new Set(await listR2Objects(rawPrefix));
      } catch {
        rawKeys = new Set();
      }
    }
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

    const overlayPresigns = includeMediaUrls
      ? await Promise.all(
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
        )
      : batch.map(() => null);
    const framePresigns = includeMediaUrls
      ? await Promise.all(
          batch.map(async (key) => {
            const stem = key.replace(detectionPrefix, "").replace(/\.json$/, "");
            const frameKey =
              findFrameKeyForStem(frameKeys, framePrefix, stem) ??
              (mode === "image_batch" ? findFrameKeyForStem(rawKeys, rawPrefix, stem) : null);
            if (!frameKey) return null;
            try {
              return await getPresignedGetUrl(frameKey, 3600);
            } catch {
              return null;
            }
          }),
        )
      : batch.map(() => null);

    for (let j = 0; j < parsed.length; j++) {
      const item = parsed[j];
      if (!item) continue;
      const { stem, data } = item;
      const imageSize = parseImageSize(data);
      const crackTypes = normalizeCrackTypes(data.crack_types);
      const crackDetectionCount = countCrackDetections(data.detections);
      const cameraSurfaceDistanceM = data.camera_surface_distance_m ?? data.depth_estimate ?? null;
      const metrics = deriveCrackMetrics({
        crackTypes,
        pci: typeof data.pci_score === "number" ? data.pci_score : 0,
        avgWidthMm: data.avg_crack_width_mm ?? null,
        maxWidthMm: data.max_crack_width_mm ?? null,
        crackTypeLengthsM: data.crack_type_lengths_m ?? data.crack_lengths_m_by_type ?? {},
        crackDetectionCount,
        finalDetectionCount: data.final_detection_count ?? null,
        yoloDetectionCount: data.yolo_detection_count ?? null,
        cameraSurfaceDistanceM,
        sectionLengthM: 10,
      });
      frames.push({
        stem,
        index: data.index ?? data.frame?.index ?? i + j,
        pci_score: typeof data.pci_score === "number" ? data.pci_score : 0,
        crack_types: crackTypes,
        crack_type_lengths_m: metrics.lengthByTypeM,
        overlay_url: overlayPresigns[j],
        image_url: framePresigns[j],
        timestamp_ms: data.timestamp_ms ?? data.frame?.timestamp_ms ?? null,
        lat: data.lat ?? data.frame?.lat ?? null,
        lon: data.lon ?? data.frame?.lon ?? null,
        alt_m: data.alt_m ?? data.alt ?? data.frame?.alt_m ?? data.frame?.alt ?? null,
        depth_estimate: data.depth_estimate ?? null,
        camera_surface_distance_m: cameraSurfaceDistanceM,
        avg_crack_width_mm: metrics.avgWidthMm,
        max_crack_width_mm: metrics.maxWidthMm,
        crack_metrics_estimated: metrics.estimated,
        crack_metrics_source: metrics.source,
        depth_available: data.depth_available ?? null,
        depth_attempted: data.depth_attempted ?? null,
        depth_skipped_reason: data.depth_skipped_reason ?? null,
        analysis_stage: data.analysis_stage ?? null,
        degraded_reasons: Array.isArray(data.degraded_reasons) ? data.degraded_reasons : [],
        sam2_attempted: data.sam2_attempted ?? null,
        yolo_detection_count: data.yolo_detection_count ?? null,
        final_detection_count: data.final_detection_count ?? null,
        processing_ms: data.processing_ms ?? null,
        image_width: imageSize.width,
        image_height: imageSize.height,
        detection_annotations: parseDetectionAnnotations(data),
      });
    }
  }

  frames.sort((a, b) => a.index - b.index);
  if (hydrateGpsFromSrtOption) {
    await hydrateGpsFromUploadedSrt(jobId, userId, mode, frames);
  }

  const summary = computeSummary(frames);

  return { job_id: jobId, mode, summary, frames };
}

function countCrackDetections(detections: RawDetection["detections"]) {
  if (!Array.isArray(detections)) return null;
  let count = 0;
  for (const detection of detections) {
    const label = crackTypeLabel(String(detection.class ?? detection.crack_type ?? ""));
    if (label && !label.toLowerCase().includes("pothole")) {
      count += 1;
    }
  }
  return count;
}

function findFrameKeyForStem(frameKeys: Set<string>, framePrefix: string, stem: string) {
  for (const key of frameKeys) {
    const filename = key.replace(framePrefix, "");
    if (filename.replace(/\.[^.]+$/, "") === stem) {
      return key;
    }
  }
  return null;
}

async function hydrateGpsFromUploadedSrt(
  jobId: string,
  userId: string,
  mode: JobMode,
  frames: FrameResult[],
) {
  if (mode !== "drone_footage" && mode !== "handheld_video") return;
  if (frames.length === 0) return;
  if (frames.some((frame) => frame.lat != null && frame.lon != null)) return;

  let rawKeys: string[];
  try {
    rawKeys = await listR2Objects(`uploads/${userId}/${jobId}/raw/`);
  } catch {
    return;
  }

  const srtKey = rawKeys.find((key) => key.toLowerCase().endsWith(".srt"));
  if (!srtKey) return;

  let entries: SrtGpsEntry[];
  try {
    entries = parseSrtGps(await getR2ObjectText(srtKey));
  } catch {
    return;
  }
  if (entries.length === 0) return;

  for (const frame of frames) {
    const timestamp = frame.timestamp_ms ?? frame.index * 1000;
    const entry = nearestSrtGps(entries, timestamp);
    frame.timestamp_ms = frame.timestamp_ms ?? timestamp;
    frame.lat = entry.lat;
    frame.lon = entry.lon;
    frame.alt_m = frame.alt_m ?? entry.alt_m;
  }
}

function parseSrtGps(text: string): SrtGpsEntry[] {
  const entries: SrtGpsEntry[] = [];
  for (const block of text.trim().split(/\r?\n\r?\n/)) {
    const timecode = SRT_TIMECODE_RE.exec(block);
    if (!timecode) continue;

    const timestamp_ms = timecodeToMs(
      timecode[1],
      timecode[2],
      timecode[3],
      timecode[4],
    );

    const tupleMatch = SRT_GPS_TUPLE_RE.exec(block);
    const latMatch = SRT_LAT_RE.exec(block);
    const lonMatch = SRT_LON_RE.exec(block);

    let lat: number;
    let lon: number;
    let alt_m: number | null = null;

    if (tupleMatch) {
      lon = Number(tupleMatch[1]);
      lat = Number(tupleMatch[2]);
      alt_m = tupleMatch[3] == null ? null : Number(tupleMatch[3]);
    } else if (latMatch && lonMatch) {
      lat = Number(latMatch[1]);
      lon = Number(lonMatch[1]);
    } else {
      continue;
    }

    for (const pattern of [SRT_ABS_ALT_RE, SRT_REL_ALT_RE, SRT_ALT_RE]) {
      const match = pattern.exec(block);
      if (match) {
        alt_m = Number(match[1]);
        break;
      }
    }

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      entries.push({
        timestamp_ms,
        lat,
        lon,
        alt_m: alt_m != null && Number.isFinite(alt_m) ? alt_m : null,
      });
    }
  }

  return entries.sort((a, b) => a.timestamp_ms - b.timestamp_ms);
}

function timecodeToMs(hours: string, minutes: string, seconds: string, ms: string) {
  return ((Number(hours) * 3600) + (Number(minutes) * 60) + Number(seconds)) * 1000 + Number(ms);
}

function nearestSrtGps(entries: SrtGpsEntry[], timestamp_ms: number) {
  let nearest = entries[0];
  let bestDistance = Math.abs(nearest.timestamp_ms - timestamp_ms);
  for (const entry of entries) {
    const distance = Math.abs(entry.timestamp_ms - timestamp_ms);
    if (distance < bestDistance) {
      nearest = entry;
      bestDistance = distance;
    }
  }
  return nearest;
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
