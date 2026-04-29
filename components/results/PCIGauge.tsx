"use client";

import dynamic from "next/dynamic";

const PCIGaugeChart = dynamic(() => import("./PCIGaugeChart"), {
  ssr: false,
  loading: () => <div className="h-48 w-full rounded border border-neutral-800 bg-neutral-950" />,
});

interface PCIGaugeProps {
  averagePci: number;
}

export function PCIGauge({ averagePci }: PCIGaugeProps) {
  return <PCIGaugeChart averagePci={averagePci} />;
}
