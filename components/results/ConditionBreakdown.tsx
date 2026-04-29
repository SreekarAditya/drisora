"use client";

import dynamic from "next/dynamic";
import type { RoadSectionProperties } from "@/types";

const ConditionBreakdownChart = dynamic(() => import("./ConditionBreakdownChart"), {
  ssr: false,
  loading: () => <div className="h-24 rounded border border-neutral-800 bg-neutral-950" />,
});

interface ConditionBreakdownProps {
  sections: RoadSectionProperties[];
}

export function ConditionBreakdown({ sections }: ConditionBreakdownProps) {
  return <ConditionBreakdownChart sections={sections} />;
}
