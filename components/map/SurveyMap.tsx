"use client";

import dynamic from "next/dynamic";
import type { RoadSectionFeatureCollection } from "@/types";

const SurveyMapClient = dynamic(() => import("./SurveyMapClient"), {
  ssr: false,
  loading: () => <div className="h-full min-h-[520px] w-full bg-[#09090C]" />,
});

interface SurveyMapProps {
  geojson: RoadSectionFeatureCollection;
}

export default function SurveyMap({ geojson }: SurveyMapProps) {
  return <SurveyMapClient geojson={geojson} />;
}
