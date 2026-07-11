"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import L from "leaflet";
import type { RoadSectionFeature, RoadSectionFeatureCollection } from "@/types";
import { SectionPopup } from "./SectionPopup";

export default function SurveyMapClient({ geojson }: { geojson: RoadSectionFeatureCollection }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootsRef = useRef<Root[]>([]);
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { center: [20.5937, 78.9629], zoom: 14 });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>', maxZoom: 20 }).addTo(map);
    const group = L.featureGroup().addTo(map);
    for (const feature of geojson.features) {
      const coordinates = lineCoordinates(feature);
      if (!coordinates.length) continue;
      const popup = document.createElement("div");
      const root = createRoot(popup);
      root.render(<SectionPopup properties={feature.properties} />);
      rootsRef.current.push(root);
      L.polyline(coordinates, { color: "#64748b", weight: 6, opacity: 0.9 }).bindTooltip(`Legacy section ${feature.properties.section_index ?? "N/A"}: point PCI suppressed`, { sticky: true }).bindPopup(popup).addTo(group);
    }
    if (group.getLayers().length) map.fitBounds(group.getBounds(), { padding: [32, 32], maxZoom: 18 });
    return () => { rootsRef.current.forEach((root) => root.unmount()); rootsRef.current = []; map.remove(); };
  }, [geojson]);
  return <div className="relative h-full min-h-[520px] w-full bg-[#09090C]"><div className="absolute bottom-4 left-4 z-[500] rounded-lg border border-white/10 bg-[#0b0c0d]/90 p-3 text-xs text-[#8A8A9A]">Legacy evidence layer. Historical point PCI values are suppressed.</div><div ref={containerRef} className="h-full min-h-[520px] w-full" /></div>;
}

function lineCoordinates(feature: RoadSectionFeature): L.LatLngExpression[] {
  if (!feature.geometry || feature.geometry.type !== "LineString") return [];
  return (feature.geometry.coordinates as number[][]).filter((value) => value.length >= 2).map(([lng, lat]) => [lat, lng] as L.LatLngExpression);
}
