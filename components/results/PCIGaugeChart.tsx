"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

interface PCIGaugeChartProps {
  averagePci: number;
}

function pciColor(pci: number): string {
  if (pci >= 85) return "#22c55e";
  if (pci >= 70) return "#eab308";
  if (pci >= 55) return "#f97316";
  if (pci >= 40) return "#ef4444";
  return "#7f1d1d";
}

export default function PCIGaugeChart({ averagePci }: PCIGaugeChartProps) {
  const value = Math.max(0, Math.min(100, averagePci));

  return (
    <div className="relative h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={[{ name: "PCI", value }]}
          cx="50%"
          cy="78%"
          innerRadius="88%"
          outerRadius="116%"
          barSize={18}
          startAngle={180}
          endAngle={0}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar dataKey="value" cornerRadius={10} fill={pciColor(value)} background />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-x-0 bottom-5 text-center">
        <div className="text-5xl font-semibold text-white">{Math.round(value)}</div>
        <div className="mt-1 text-xs uppercase tracking-wide text-neutral-400">Average PCI</div>
      </div>
    </div>
  );
}
