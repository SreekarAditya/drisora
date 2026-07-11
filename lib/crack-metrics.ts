import { crackTypeLabel } from "@/lib/crack-labels";

export type CrackMetricSource = "none" | "measured";

export interface CrackMetricInput {
  crackTypes: string[];
  avgWidthMm?: number | null;
  maxWidthMm?: number | null;
  crackTypeLengthsM?: Record<string, number> | null;
  crackDetectionCount?: number | null;
  finalDetectionCount?: number | null;
  yoloDetectionCount?: number | null;
  cameraSurfaceDistanceM?: number | null;
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
  const distressTypes = input.crackTypes.map(crackTypeLabel);
  const crackTypes = distressTypes.filter(isCrackWidthApplicable);
  const normalizedLengths = normalizeLengths(input.crackTypeLengthsM);
  const measuredAvgWidthMm = crackTypes.length > 0 ? input.avgWidthMm : null;
  const measuredMaxWidthMm = crackTypes.length > 0 ? input.maxWidthMm : null;
  const rawCount =
    input.crackDetectionCount ??
    (crackTypes.length === 0 && distressTypes.length > 0
      ? 0
      : input.finalDetectionCount ?? input.yoloDetectionCount ?? null);
  const evidenceCount = Math.max(rawCount ?? 0, crackTypes.length, Object.keys(normalizedLengths).length);
  const hasCracks =
    evidenceCount > 0 ||
    crackTypes.length > 0 ||
    Object.values(normalizedLengths).some((value) => value > 0) ||
    measuredAvgWidthMm != null ||
    measuredMaxWidthMm != null;

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
  const avgWidthMm = finiteOrNull(measuredAvgWidthMm);
  const maxWidthMm = finiteOrNull(measuredMaxWidthMm);
  const lengthByTypeM = normalizedLengths;
  const hasPhysicalMeasurement =
    avgWidthMm != null || maxWidthMm != null || Object.keys(lengthByTypeM).length > 0;

  return {
    hasCracks: true,
    crackCount,
    avgWidthMm: avgWidthMm == null ? null : round1(avgWidthMm),
    maxWidthMm: maxWidthMm == null ? null : round1(maxWidthMm),
    lengthByTypeM,
    totalLengthM: round2(Object.values(lengthByTypeM).reduce((sum, value) => sum + value, 0)),
    source: hasPhysicalMeasurement ? "measured" : "none",
    estimated: false,
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
    if (!isCrackWidthApplicable(label)) continue;
    out[label] = round2((out[label] ?? 0) + rawLength);
  }
  return out;
}

function isCrackWidthApplicable(type: string) {
  const value = type.toLowerCase();
  return !value.includes("pothole");
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
