"use client";

import dynamic from "next/dynamic";

const CrackTypePieChartClient = dynamic(() => import("./CrackTypePieChartClient"), {
  ssr: false,
  loading: () => <div className="h-64 rounded border border-neutral-800 bg-neutral-950" />,
});

interface CrackTypePieChartProps {
  detectionsSummary: Record<string, number>;
}

export function CrackTypePieChart({ detectionsSummary }: CrackTypePieChartProps) {
  return <CrackTypePieChartClient detectionsSummary={detectionsSummary} />;
}
