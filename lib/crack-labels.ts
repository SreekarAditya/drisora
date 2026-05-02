const CRACK_TYPE_LABELS: Record<string, string> = {
  D00: "Longitudinal crack",
  D10: "Transverse crack",
  D20: "Alligator crack",
  D40: "Pothole",
  longitudinal: "Longitudinal crack",
  transverse: "Transverse crack",
  alligator: "Alligator crack",
  pothole: "Pothole",
};

export function crackTypeLabel(type: string): string {
  return CRACK_TYPE_LABELS[type] ?? type;
}

export function normalizeCrackTypes(types: unknown): string[] {
  if (!Array.isArray(types)) return [];
  return Array.from(
    new Set(
      types
        .filter((type): type is string => typeof type === "string" && type.length > 0)
        .map(crackTypeLabel),
    ),
  );
}
