import { crackTypeLabel } from "@/lib/crack-labels";

export type DistressKey = "longitudinal" | "transverse" | "alligator" | "pothole";
export type DistressSeverity = "Low" | "Medium" | "High";
export type MaintenancePriority = "Immediate" | "Preventive" | "Routine";

export interface CivilKnowledgeEntry {
  label: string;
  possibleCauses: string[];
  lowMitigation: string;
  mediumMitigation: string;
  highMitigation: string;
}

export interface DistressAnalysisInput {
  crackTypes: string[];
  pci: number | null | undefined;
  avgWidthMm?: number | null;
  maxWidthMm?: number | null;
  crackCount?: number | null;
  sectionLengthM?: number | null;
}

export interface DistressAnalysis {
  primaryDistress: DistressKey | null;
  distressLabel: string;
  severity: DistressSeverity;
  priority: MaintenancePriority;
  possibleCauses: string[];
  recommendedMitigation: string;
  summary: string;
}

export const CIVIL_KNOWLEDGE_BASE: Record<DistressKey, CivilKnowledgeEntry> = {
  longitudinal: {
    label: "Longitudinal Crack",
    possibleCauses: [
      "Poor longitudinal construction joint",
      "Differential settlement of subgrade or shoulder",
      "Fatigue in wheel path",
      "Alternate wetting-drying",
    ],
    lowMitigation: "Crack sealing with rubberized bitumen because the measured opening is below 3 mm.",
    mediumMitigation: "Crack sealing with rubberized bitumen followed by slurry seal or micro-surfacing where density is increasing.",
    highMitigation: "Thin bituminous overlay is recommended because the distress is in the higher-severity range or PCI is below 75.",
  },
  transverse: {
    label: "Transverse Crack",
    possibleCauses: [
      "Thermal shrinkage",
      "Reflection cracking",
      "Oxidized binder",
    ],
    lowMitigation: "Immediate crack sealing to prevent water ingress.",
    mediumMitigation: "Crack sealing followed by slurry seal or micro-surfacing if the cracking is widespread.",
    highMitigation: "Thin bituminous overlay is recommended where severe transverse cracking is widespread.",
  },
  alligator: {
    label: "Alligator (Fatigue) Crack",
    possibleCauses: [
      "Structural failure from inadequate pavement thickness",
      "Weak subgrade",
      "Traffic overloading",
      "Moisture ingress",
    ],
    lowMitigation: "Crack sealing plus micro-surfacing for early-stage fatigue cracking.",
    mediumMitigation: "Milling and bituminous overlay after localized structural correction.",
    highMitigation: "Full-depth reclamation or milling and overlay because the pattern indicates structural failure.",
  },
  pothole: {
    label: "Pothole",
    possibleCauses: [
      "Progression of untreated cracks",
      "Water ingress under traffic",
      "Poor drainage",
    ],
    lowMitigation: "Proper pothole patching with edge cutting and compaction.",
    mediumMitigation: "Immediate pothole patching followed by surface treatment to prevent recurrence.",
    highMitigation: "Immediate patching with drainage correction and structural repair around the failed area.",
  },
};

const DISTRESS_ORDER: DistressKey[] = ["pothole", "alligator", "longitudinal", "transverse"];

export function normalizeDistressType(value: string | null | undefined): DistressKey | null {
  if (!value) return null;
  const normalized = crackTypeLabel(value).toLowerCase();
  if (normalized.includes("pothole")) return "pothole";
  if (normalized.includes("alligator") || normalized.includes("fatigue")) return "alligator";
  if (normalized.includes("longitudinal")) return "longitudinal";
  if (normalized.includes("transverse")) return "transverse";
  return null;
}

export function analyzeDistress(input: DistressAnalysisInput): DistressAnalysis {
  const keys = input.crackTypes
    .map(normalizeDistressType)
    .filter((key): key is DistressKey => key != null);
  const primaryDistress =
    DISTRESS_ORDER.find((key) => keys.includes(key)) ?? keys[0] ?? null;
  const severity = computeSeverity(input, primaryDistress);
  const priority = computePriority(input.pci, severity, primaryDistress);

  if (!primaryDistress) {
    return {
      primaryDistress: null,
      distressLabel: "No distress recorded",
      severity,
      priority,
      possibleCauses: ["No visible distress pattern was recorded for this section."],
      recommendedMitigation:
        priority === "Routine"
          ? "Routine monitoring and scheduled inspection are sufficient."
          : "Field verification is recommended because PCI indicates deterioration without a mapped crack type.",
      summary: "No dominant distress type was available from the detection payload.",
    };
  }

  const entry = CIVIL_KNOWLEDGE_BASE[primaryDistress];
  const recommendedMitigation =
    severity === "High"
      ? entry.highMitigation
      : severity === "Medium"
        ? entry.mediumMitigation
        : entry.lowMitigation;

  return {
    primaryDistress,
    distressLabel: entry.label,
    severity,
    priority,
    possibleCauses: entry.possibleCauses,
    recommendedMitigation,
    summary: `${entry.label} is rated ${severity.toLowerCase()} priority ${priority.toLowerCase()} based on PCI, crack density, and measured crack width.`,
  };
}

function computeSeverity(input: DistressAnalysisInput, primary: DistressKey | null): DistressSeverity {
  const pci = input.pci ?? 100;
  const maxWidth = input.maxWidthMm ?? input.avgWidthMm ?? 0;
  const crackCount = input.crackCount ?? input.crackTypes.length;
  const length = input.sectionLengthM ?? 10;
  const density = length > 0 ? crackCount / length : crackCount;

  if (primary === "pothole") return pci < 75 || crackCount > 0 ? "High" : "Medium";
  if (primary === "alligator" && (pci < 75 || maxWidth >= 3 || density >= 0.3)) return "High";
  if (pci < 55 || maxWidth >= 5 || density >= 0.5) return "High";
  if (pci < 75 || maxWidth >= 3 || density >= 0.2) return "Medium";
  return "Low";
}

function computePriority(
  pci: number | null | undefined,
  severity: DistressSeverity,
  primary: DistressKey | null,
): MaintenancePriority {
  const score = pci ?? 100;
  if (severity === "High" || primary === "pothole" || (primary === "alligator" && score < 75)) {
    return "Immediate";
  }
  if (severity === "Medium" || score < 75) {
    return "Preventive";
  }
  return "Routine";
}
