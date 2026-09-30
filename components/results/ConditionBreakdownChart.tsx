"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RoadSectionProperties } from "@/types";

interface ConditionBreakdownChartProps {
  sections: RoadSectionProperties[];
}

const CONDITION_ORDER = ["good", "satisfactory", "fair", "poor", "very_poor"];

const CONDITION_COLORS: Record<string, string> = {
  good: "#22c55e",
  satisfactory: "#eab308",
  fair: "#f97316",
  poor: "#ef4444",
  very_poor: "#7f1d1d",
};

const CONDITION_LABELS: Record<string, string> = {
  good: "Good",
  satisfactory: "Satisfactory",
  fair: "Fair",
  poor: "Poor",
  very_poor: "Very poor",
};

export default function ConditionBreakdownChart({ sections }: ConditionBreakdownChartProps) {
  const total = sections.reduce((sum, section) => sum + (section.length_m ?? 0), 0);
  const row = CONDITION_ORDER.reduce<Record<string, number | string>>((acc, condition) => {
    const length = sections
      .filter((section) => section.condition_category === condition)
      .reduce((sum, section) => sum + (section.length_m ?? 0), 0);
    acc[condition] = total > 0 ? (length / total) * 100 : 0;
    return acc;
  }, { name: "Road" });

  return (
    <div className="space-y-4">
      <div className="h-14 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[row]} layout="vertical" margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip
              cursor={false}
              contentStyle={{ background: "#1A1A22", border: "1px solid rgba(255,255,255,0.12)", color: "#F0F0F4", borderRadius: "10px" }}
              formatter={(value, name) => [
                `${Number(value ?? 0).toFixed(1)}%`,
                CONDITION_LABELS[String(name)] ?? String(name),
              ]}
            />
            {CONDITION_ORDER.map((condition) => (
              <Bar key={condition} dataKey={condition} stackId="condition" fill={CONDITION_COLORS[condition]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-[#F0F0F4]">
        {CONDITION_ORDER.map((condition) => (
          <div key={condition} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CONDITION_COLORS[condition] }} />
              {CONDITION_LABELS[condition]}
            </span>
            <span className="font-mono text-[#8A8A9A]">{Number(row[condition] ?? 0).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
