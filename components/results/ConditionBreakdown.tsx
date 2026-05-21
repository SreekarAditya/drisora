"use client";

import dynamic from "next/dynamic";
import type { RoadSectionProperties } from "@/types";

const ConditionBreakdownChart = dynamic(() => import("./ConditionBreakdownChart"), {
  ssr: false,
  loading: () => <div className="h-24 animate-skeleton rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#111116]" />,
});

interface ConditionBreakdownProps {
  sections: RoadSectionProperties[];
}

export function ConditionBreakdown({ sections }: ConditionBreakdownProps) {
  return <ConditionBreakdownChart sections={sections} />;
}
