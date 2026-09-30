"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import L from "leaflet";
import type { RoadSectionFeature, RoadSectionFeatureCollection } from "@/types";
import { CRACK_WIDTH_BANDS, crackWidthBandLabel, crackWidthColor } from "@/lib/crack-metrics";
import { SectionPopup } from "./SectionPopup";

interface SurveyMapClientProps {
  geojson: RoadSectionFeatureCollection;
}

function pciColor(pci: number | null): string {
  if (pci == null) return "#737373";
  if (pci >= 85) return "#22c55e";
  if (pci >= 70) return "#eab308";
  if (pci >= 55) return "#f97316";
  if (pci >= 40) return "#ef4444";
  return "#7f1d1d";
}

function lineCoordinates(feature: RoadSectionFeature): L.LatLngExpression[] {
  if (!feature.geometry || feature.geometry.type !== "LineString") return [];

  return (feature.geometry.coordinates as number[][])
    .filter((coordinate) => coordinate.length >= 2)
    .map(([lng, lat]) => [lat, lng] as L.LatLngExpression);
}

export default function SurveyMapClient({ geojson }: SurveyMapClientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.FeatureGroup | null>(null);
  const popupRootsRef = useRef<Root[]>([]);
  const [overlayMode, setOverlayMode] = useState<"pci" | "width">("pci");

  const renderLines = useCallback((
    group: L.FeatureGroup,
    lines: Array<{ feature: RoadSectionFeature; coordinates: L.LatLngExpression[] }>,
    mode: "pci" | "width",
  ) => {
    for (const popupRoot of popupRootsRef.current) {
      popupRoot.unmount();
    }
    popupRootsRef.current = [];
    group.clearLayers();

    for (const { feature, coordinates } of lines) {
      const popupContainer = document.createElement("div");
      const popupRoot = createRoot(popupContainer);
      popupRoot.render(<SectionPopup properties={feature.properties} />);
      popupRootsRef.current.push(popupRoot);

      const widthValue = feature.properties.max_crack_width_mm ?? feature.properties.avg_crack_width_mm;
      L.polyline(coordinates, {
        color: mode === "width" ? crackWidthColor(widthValue) : pciColor(feature.properties.pci_score),
        weight: mode === "width" ? 8 : 6,
        opacity: 0.95,
      })
        .bindTooltip(sectionTooltip(feature), { sticky: true, className: "drisora-map-tooltip" })
        .bindPopup(popupContainer, {
          className: "drisora-section-popup",
        })
        .addTo(group);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const lines = geojson.features
      .map((feature) => ({ feature, coordinates: lineCoordinates(feature) }))
      .filter((item) => item.coordinates.length > 0);
    const center = lines[0]?.coordinates[0] ?? ([20.5937, 78.9629] as L.LatLngExpression);
    const map = L.map(containerRef.current, {
      center,
      zoom: 14,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
    }).addTo(map);

    const group = L.featureGroup().addTo(map);
    groupRef.current = group;

    renderLines(group, lines, "pci");

    if (lines.length > 0) {
      map.fitBounds(group.getBounds(), { padding: [32, 32], maxZoom: 18 });
    }

    return () => {
      for (const popupRoot of popupRootsRef.current) {
        popupRoot.unmount();
      }
      popupRootsRef.current = [];
      map.remove();
      mapRef.current = null;
      groupRef.current = null;
    };
  }, [geojson, renderLines]);

  useEffect(() => {
    if (!groupRef.current) return;
    const lines = geojson.features
      .map((feature) => ({ feature, coordinates: lineCoordinates(feature) }))
      .filter((item) => item.coordinates.length > 0);
    renderLines(groupRef.current, lines, overlayMode);
  }, [geojson, overlayMode, renderLines]);

  return (
    <div className="relative h-full min-h-[520px] w-full bg-[#09090C]">
      <div className="absolute right-4 top-4 z-[500] flex overflow-hidden rounded-md border border-[rgba(255,255,255,0.10)] bg-[#0b0c0d]/90 p-1 backdrop-blur">
        {[
          ["pci", "PCI"],
          ["width", "Width mm"],
        ].map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setOverlayMode(mode as "pci" | "width")}
            className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
              overlayMode === mode
                ? "bg-[#F5A623] text-[#09090C]"
                : "text-[#8A8A9A] hover:bg-white/5 hover:text-[#F0F0F4]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="absolute bottom-4 left-4 z-[500] max-w-[270px] rounded-lg border border-[rgba(255,255,255,0.10)] bg-[#0b0c0d]/90 p-3 text-xs shadow-xl backdrop-blur">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#8A8A9A]">
          {overlayMode === "width" ? "Crack width legend" : "PCI legend"}
        </p>
        <div className="space-y-1.5">
          {overlayMode === "width"
            ? CRACK_WIDTH_BANDS.map((band) => (
                <div key={band.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[#F0F0F4]">
                    <span className="h-2.5 w-6 rounded-sm" style={{ background: band.color }} />
                    {band.label}
                  </span>
                  <span className="text-[#4A4A5A]">{band.detail}</span>
                </div>
              ))
            : [
                ["Good 85-100", "#22c55e"],
                ["Satisfactory 70-84", "#eab308"],
                ["Fair 55-69", "#f97316"],
                ["Poor 40-54", "#ef4444"],
                ["Very poor 0-39", "#7f1d1d"],
              ].map(([label, color]) => (
                <div key={label} className="flex items-center gap-2 text-[#F0F0F4]">
                  <span className="h-2.5 w-6 rounded-sm" style={{ background: color }} />
                  {label}
                </div>
              ))}
        </div>
      </div>
      <div ref={containerRef} className="h-full min-h-[520px] w-full bg-[#09090C]" />
    </div>
  );
}

function sectionTooltip(feature: RoadSectionFeature) {
  const properties = feature.properties;
  const widthValue = properties.max_crack_width_mm ?? properties.avg_crack_width_mm;
  return `
    <div style="min-width: 180px">
      <div style="font-size: 11px; color: #9ca3af">Section ${properties.section_index ?? "N/A"}</div>
      <div style="margin-top: 3px; font-weight: 700; color: ${pciColor(properties.pci_score)}">PCI ${properties.pci_score == null ? "N/A" : Math.round(properties.pci_score)}</div>
      <div style="margin-top: 6px; color: #e5e7eb">Max width: ${widthValue == null ? "N/A" : `${widthValue.toFixed(1)} mm${properties.crack_metrics_estimated ? " (legacy estimate)" : ""}`}</div>
      <div style="margin-top: 2px; color: #9ca3af">${crackWidthBandLabel(widthValue)}</div>
    </div>
  `;
}
