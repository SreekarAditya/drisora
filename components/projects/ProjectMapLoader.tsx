"use client";

import { useEffect, useState } from "react";
import ProjectMap from "@/components/map/ProjectMap";
import type { ProjectMapFeatureCollection } from "@/lib/project-map";

interface ProjectMapLoaderProps {
  projectId: string;
  initialGeojson: ProjectMapFeatureCollection;
  completedGpsJobCount: number;
}

export function ProjectMapLoader({
  projectId,
  initialGeojson,
  completedGpsJobCount,
}: ProjectMapLoaderProps) {
  const [geojson, setGeojson] = useState(initialGeojson);
  const [loading, setLoading] = useState(completedGpsJobCount > 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (completedGpsJobCount === 0) return;

    const controller = new AbortController();
    async function loadMap() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/projects/${projectId}/map`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          geojson?: ProjectMapFeatureCollection;
          error?: string;
        };
        if (!response.ok || !data.geojson) {
          throw new Error(data.error ?? "Failed to load project map");
        }
        setGeojson(data.geojson);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load project map");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadMap();
    return () => controller.abort();
  }, [completedGpsJobCount, projectId]);

  if (geojson.features.length > 0) {
    return (
      <div className="space-y-3">
        <ProjectMap geojson={geojson} />
        {loading && (
          <p className="text-xs text-gray-600">
            Loading GPS-backed job geometry...
          </p>
        )}
        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-lg border border-white/10 bg-[#0b0c0d] text-center">
        <div className="px-6">
          <p className="text-sm font-semibold text-white">Loading project map geometry</p>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            The rest of the project page is ready while Drisora loads GPS-backed sections.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[520px] items-center justify-center rounded-lg border border-white/10 bg-[#0b0c0d] text-center">
      <div className="px-6">
        <p className="text-sm font-semibold text-white">No geospatial sections linked yet</p>
        <p className="mt-1 text-xs leading-5 text-gray-600">
          {error ?? "Link a completed GPS-backed survey or upload job to build the combined campus map."}
        </p>
      </div>
    </div>
  );
}
