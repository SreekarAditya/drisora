"use client";

import dynamic from "next/dynamic";
import type { ProjectMapFeatureCollection } from "@/lib/project-map";

const ProjectMapClient = dynamic(() => import("./ProjectMapClient"), {
  ssr: false,
  loading: () => <div className="h-full min-h-[520px] w-full bg-neutral-950" />,
});

interface ProjectMapProps {
  geojson: ProjectMapFeatureCollection;
}

export default function ProjectMap({ geojson }: ProjectMapProps) {
  return <ProjectMapClient geojson={geojson} />;
}
