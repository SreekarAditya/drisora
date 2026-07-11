"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import L from "leaflet";
import type { ProjectMapFeature, ProjectMapFeatureCollection } from "@/lib/project-map";
import { ProjectSectionPopup } from "./ProjectSectionPopup";

export default function ProjectMapClient({ geojson }: { geojson: ProjectMapFeatureCollection }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootsRef = useRef<Root[]>([]);
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { center: [20.5937, 78.9629], zoom: 15 });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>', maxZoom: 20 }).addTo(map);
    const group = L.featureGroup().addTo(map);
    for (const feature of geojson.features) {
      const coordinates = lineCoordinates(feature);
      if (!coordinates.length) continue;
      const popup = document.createElement("div");
      const root = createRoot(popup);
      root.render(<ProjectSectionPopup properties={feature.properties} />);
      rootsRef.current.push(root);
      L.polyline(coordinates, {
        color: feature.properties.pci_bounds ? "#F5A623" : "#64748b",
        weight: feature.properties.is_relative ? 5 : 7,
        opacity: 0.94,
        dashArray: feature.properties.is_relative ? "10 8" : undefined,
      }).bindTooltip(sectionTooltip(feature), { sticky: true, className: "drisora-map-tooltip" }).bindPopup(popup, { className: "drisora-section-popup" }).addTo(group);
    }
    if (group.getLayers().length) map.fitBounds(group.getBounds(), { padding: [32, 32], maxZoom: 18 });
    return () => { rootsRef.current.forEach((root) => root.unmount()); rootsRef.current = []; map.remove(); };
  }, [geojson]);
  return <div className="relative h-full min-h-[520px] w-full bg-[#09090C]"><div className="absolute bottom-4 left-4 z-[500] rounded-lg border border-white/10 bg-[#0b0c0d]/90 p-3 text-xs text-[#8A8A9A]">Amber: current section bounds · Gray: legacy evidence with point score suppressed · Dashed: section under 100 m</div><div ref={containerRef} className="h-full min-h-[520px] w-full" /></div>;
}

function lineCoordinates(feature: ProjectMapFeature): L.LatLngExpression[] {
  if (!feature.geometry || feature.geometry.type !== "LineString") return [];
  return (feature.geometry.coordinates as number[][]).filter((value) => value.length >= 2).map(([lng, lat]) => [lat, lng] as L.LatLngExpression);
}

function sectionTooltip(feature: ProjectMapFeature) {
  const p = feature.properties;
  const interval = p.pci_bounds ? `${p.pci_bounds.lower.toFixed(1)}–${p.pci_bounds.upper.toFixed(1)}` : "not available";
  return `<div style="min-width:180px"><div style="font-size:11px;color:#9ca3af">${escapeHtml(p.source_label)}</div><div style="margin-top:4px;font-weight:700;color:#f59e0b">PCI bounds ${interval}</div><div style="margin-top:6px;color:#e5e7eb">Chainage ${p.segment_start_m?.toFixed(0) ?? "N/A"}–${p.segment_end_m?.toFixed(0) ?? "N/A"} m</div></div>`;
}

function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
