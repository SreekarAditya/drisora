import { crackTypeLabel } from "@/lib/crack-labels";

export type CrackMetricSource = "none" | "measured" | "estimated";

export interface CrackMetricInput {
  crackTypes: string[];
  pci?: number | null;
  avgWidthMm?: number | null;
  maxWidthMm?: number | null;
  crackTypeLengthsM?: Record<string, number> | null;
  finalDetectionCount?: number | null;
  yoloDetectionCount?: number | null;
  cameraSurfaceDistanceM?: number | null;
  sectionLengthM?: number | null;
}

export interface DerivedCrackMetrics {
  hasCracks: boolean;
  crackCount: number;
  avgWidthMm: number | null;
  maxWidthMm: number | null;
  lengthByTypeM: Record<string, number>;
  totalLengthM: number;
  source: CrackMetricSource;
  estimated: boolean;
}

export const CRACK_WIDTH_BANDS = [
  { label: "< 3 mm", detail: "Fine / seal watch", min: 0, max: 3, color: "#22c55e" },
  { label: "3-5 mm", detail: "Seal priority", min: 3, max: 5, color: "#eab308" },
  { label: "5-8 mm", detail: "Rehab watch", min: 5, max: 8, color: "#f97316" },
  { label: ">= 8 mm", detail: "Immediate action", min: 8, max: Number.POSITIVE_INFINITY, color: "#ef4444" },
] as const;

export function deriveCrackMetrics(input: CrackMetricInput): DerivedCrackMetrics {
  const crackTypes = input.crackTypes.map(crackTypeLabel);
  const normalizedLengths = normalizeLengths(input.crackTypeLengthsM);
  const rawCount = input.finalDetectionCount ?? input.yoloDetectionCount ?? null;
  const evidenceCount = Math.max(rawCount ?? 0, crackTypes.length, Object.keys(normalizedLengths).length);
  const hasCracks =
    evidenceCount > 0 ||
    crackTypes.length > 0 ||
    Object.values(normalizedLengths).some((value) => value > 0) ||
    input.avgWidthMm != null ||
    input.maxWidthMm != null;

  if (!hasCracks) {
    return {
      hasCracks: false,
      crackCount: 0,
      avgWidthMm: null,
      maxWidthMm: null,
      lengthByTypeM: {},
      totalLengthM: 0,
      source: "none",
      estimated: false,
    };
  }

  const crackCount = Math.max(1, evidenceCount);
  const estimatedWidths = estimateWidths(crackTypes, input.pci, crackCount);
  const avgWidthMm = finiteOrNull(input.avgWidthMm) ?? estimatedWidths.avgWidthMm;
  const maxWidthMm =
    finiteOrNull(input.maxWidthMm) ??
    Math.max(avgWidthMm, estimatedWidths.maxWidthMm);
  const lengthByTypeM =
    Object.keys(normalizedLengths).length > 0
      ? normalizedLengths
      : estimateLengths(crackTypes, crackCount, input.sectionLengthM);
  const estimated =
    input.avgWidthMm == null ||
    input.maxWidthMm == null ||
    Object.keys(normalizedLengths).length === 0;

  return {
    hasCracks: true,
    crackCount,
    avgWidthMm: round1(avgWidthMm),
    maxWidthMm: round1(maxWidthMm),
    lengthByTypeM,
    totalLengthM: round2(Object.values(lengthByTypeM).reduce((sum, value) => sum + value, 0)),
    source: estimated ? "estimated" : "measured",
    estimated,
  };
}

export function crackWidthColor(value: number | null | undefined) {
  if (value == null) return "#64748b";
  return CRACK_WIDTH_BANDS.find((band) => value >= band.min && value < band.max)?.color ?? "#ef4444";
}

export function crackWidthBandLabel(value: number | null | undefined) {
  if (value == null) return "No width";
  const band = CRACK_WIDTH_BANDS.find((item) => value >= item.min && value < item.max);
  return band ? `${band.label} - ${band.detail}` : ">= 8 mm - Immediate action";
}

function normalizeLengths(value: Record<string, number> | null | undefined) {
  const out: Record<string, number> = {};
  for (const [rawType, rawLength] of Object.entries(value ?? {})) {
    if (!Number.isFinite(rawLength) || rawLength <= 0) continue;
    const label = crackTypeLabel(rawType);
    out[label] = round2((out[label] ?? 0) + rawLength);
  }
  return out;
}

function estimateWidths(crackTypes: string[], pci: number | null | undefined, crackCount: number) {
  const types = crackTypes.length > 0 ? crackTypes : ["Detected distress"];
  const base = Math.max(...types.map((type) => typeWidth(type).avgWidthMm));
  const pciFactor = pci == null ? 1 : pci < 40 ? 1.45 : pci < 55 ? 1.28 : pci < 70 ? 1.12 : pci < 85 ? 1 : 0.82;
  const densityFactor = crackCount >= 8 ? 1.18 : crackCount >= 4 ? 1.08 : 1;
  const avgWidthMm = Math.max(1.2, base * pciFactor * densityFactor);
  const maxWidthMm = Math.max(avgWidthMm * 1.35, avgWidthMm + 0.8, Math.max(...types.map((type) => typeWidth(type).maxWidthMm)) * pciFactor);
  return { avgWidthMm, maxWidthMm };
}

function estimateLengths(crackTypes: string[], crackCount: number, sectionLengthM: number | null | undefined) {
  const types = crackTypes.length > 0 ? crackTypes : ["Detected distress"];
  const countPerType = Math.max(1, Math.ceil(Math.max(crackCount, types.length) / types.length));
  const sectionScale = Math.max(0.75, Math.min(1.5, (sectionLengthM ?? 10) / 10));
  const out: Record<string, number> = {};

  for (const type of types) {
    const label = crackTypeLabel(type);
    const estimate = typeWidth(label).lengthM * countPerType * sectionScale;
    out[label] = round2((out[label] ?? 0) + estimate);
  }

  return out;
}

function typeWidth(type: string) {
  const value = type.toLowerCase();
  if (value.includes("pothole")) return { avgWidthMm: 12, maxWidthMm: 18, lengthM: 0.8 };
  if (value.includes("alligator") || value.includes("fatigue")) return { avgWidthMm: 4.5, maxWidthMm: 7, lengthM: 5.4 };
  if (value.includes("transverse")) return { avgWidthMm: 2.8, maxWidthMm: 4.2, lengthM: 2.6 };
  if (value.includes("longitudinal")) return { avgWidthMm: 2.4, maxWidthMm: 3.6, lengthM: 4.2 };
  return { avgWidthMm: 2.5, maxWidthMm: 3.8, lengthM: 2.2 };
}

function finiteOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
