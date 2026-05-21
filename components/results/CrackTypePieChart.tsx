"use client";

import dynamic from "next/dynamic";

const CrackTypePieChartClient = dynamic(() => import("./CrackTypePieChartClient"), {
  ssr: false,
  loading: () => <div className="h-64 animate-skeleton rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#111116]" />,
});

interface CrackTypePieChartProps {
  detectionsSummary: Record<string, number>;
}

export function CrackTypePieChart({ detectionsSummary }: CrackTypePieChartProps) {
  return <CrackTypePieChartClient detectionsSummary={detectionsSummary} />;
}
