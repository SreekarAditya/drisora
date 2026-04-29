"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface CrackTypePieChartClientProps {
  detectionsSummary: Record<string, number>;
}

const COLORS = ["#f59e0b", "#22c55e", "#ef4444", "#38bdf8", "#a855f7", "#f97316"];

export default function CrackTypePieChartClient({ detectionsSummary }: CrackTypePieChartClientProps) {
  const data = Object.entries(detectionsSummary).map(([name, value]) => ({ name, value }));

  if (data.length === 0) {
    return <p className="text-sm text-neutral-400">No cracks detected.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={86} innerRadius={44} paddingAngle={2}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#171717", border: "1px solid #404040", color: "#fff" }}
            itemStyle={{ color: "#fff" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
