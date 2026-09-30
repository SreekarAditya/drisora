"use client";

import dynamic from "next/dynamic";

const PCIGaugeChart = dynamic(() => import("./PCIGaugeChart"), {
  ssr: false,
  loading: () => <div className="h-48 w-full animate-skeleton rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#111116]" />,
});

interface PCIGaugeProps {
  averagePci: number;
}

export function PCIGauge({ averagePci }: PCIGaugeProps) {
  return <PCIGaugeChart averagePci={averagePci} />;
}
