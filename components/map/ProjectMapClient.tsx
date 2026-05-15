"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { getPciBand, PCI_BANDS } from "@/types";
import { crackWidthBandLabel, crackWidthColor } from "@/lib/crack-metrics";
import type { ProjectMapFeature, ProjectMapFeatureCollection } from "@/lib/project-map";

interface ProjectMapClientProps {
  geojson: ProjectMapFeatureCollection;
}

function lineCoordinates(feature: ProjectMapFeature): L.LatLngExpression[] {
  if (!feature.geometry || feature.geometry.type !== "LineString") return [];

  return (feature.geometry.coordinates as number[][])
    .filter((coordinate) => coordinate.length >= 2)
    .map(([lng, lat]) => [lat, lng] as L.LatLngExpression);
}

export default function ProjectMapClient({ geojson }: ProjectMapClientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.FeatureGroup | null>(null);
  const [overlayMode, setOverlayMode] = useState<"pci" | "width">("pci");

  const renderLines = useCallback((
    group: L.FeatureGroup,
    lines: Array<{ feature: ProjectMapFeature; coordinates: L.LatLngExpression[] }>,
    mode: "pci" | "width",
  ) => {
    group.clearLayers();

    for (const { feature, coordinates } of lines) {
      const widthValue = feature.properties.max_crack_width_mm ?? feature.properties.avg_crack_width_mm;
      L.polyline(coordinates, {
        color: mode === "width" ? crackWidthColor(widthValue) : getPciBand(feature.properties.pci_score ?? 0).color,
        weight: feature.properties.is_relative ? 5 : 7,
        opacity: feature.properties.is_relative ? 0.82 : 0.94,
        dashArray: feature.properties.is_relative ? "10 8" : undefined,
      })
        .bindTooltip(sectionTooltip(feature), { sticky: true, className: "drisora-map-tooltip" })
        .bindPopup(sectionPopup(feature), { className: "drisora-section-popup" })
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
      zoom: 15,
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

  const relativeCount = geojson.features.filter((feature) => feature.properties.is_relative).length;

  return (
    <div className="relative h-full min-h-[520px] w-full bg-neutral-950">
      <div className="absolute right-4 top-4 z-[500] flex overflow-hidden rounded-md border border-white/10 bg-[#0b0c0d]/90 p-1 backdrop-blur">
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
                ? "bg-amber-500 text-black"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="absolute bottom-4 left-4 z-[500] max-w-[300px] rounded-lg border border-white/10 bg-[#0b0c0d]/90 p-3 text-xs shadow-xl backdrop-blur">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-gray-500">
          {overlayMode === "width" ? "Crack width legend" : "PCI legend"}
        </p>
        <div className="space-y-1.5">
          {(overlayMode === "width"
            ? [
                { label: "Measured / estimated widths", color: "#64748b", detail: `${relativeCount} relative sections shown dashed when under 100 m` },
              ].concat(
                [
                  ["Fine", "#3b82f6"],
                  ["Moderate", "#f59e0b"],
                  ["Wide", "#ef4444"],
                ].map(([label, color]) => ({ label, color, detail: crackWidthBandLabel(null) })),
              )
            : PCI_BANDS.map((band) => ({
                label: `${band.label} ${band.range}`,
                color: band.color,
                detail: "",
              })))
            .map((entry) => (
            <div key={entry.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-gray-300">
                <span className="h-2.5 w-6 rounded-sm" style={{ background: entry.color }} />
                {entry.label}
              </span>
              {entry.detail ? <span className="text-gray-600">{entry.detail}</span> : null}
            </div>
          ))}
        </div>
        <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-4 text-gray-600">
          Dashed segments are shorter than 100 m and treated as relative PCI.
        </p>
      </div>
      <div ref={containerRef} className="h-full min-h-[520px] w-full bg-neutral-950" />
    </div>
  );
}

function sectionTooltip(feature: ProjectMapFeature) {
  const properties = feature.properties;
  const widthValue = properties.max_crack_width_mm ?? properties.avg_crack_width_mm;
  return `
    <div style="min-width: 190px">
      <div style="font-size: 11px; color: #9ca3af">${escapeHtml(properties.source_label)}</div>
      <div style="margin-top: 3px; font-weight: 700; color: ${getPciBand(properties.pci_score ?? 0).color}">
        ${properties.is_relative ? "Relative PCI" : "PCI"} ${properties.pci_score == null ? "N/A" : properties.pci_score.toFixed(1)}
      </div>
      <div style="margin-top: 6px; color: #e5e7eb">
        Chainage ${properties.segment_start_m == null ? "N/A" : properties.segment_start_m.toFixed(0)}–${properties.segment_end_m == null ? "N/A" : properties.segment_end_m.toFixed(0)} m
      </div>
      <div style="margin-top: 2px; color: #9ca3af">
        ${properties.is_relative ? "Relative segment under 100 m" : "Standard 100 m segment"}
      </div>
      <div style="margin-top: 6px; color: #e5e7eb">
        Max width: ${widthValue == null ? "N/A" : `${widthValue.toFixed(1)} mm`}
      </div>
    </div>
  `;
}

function sectionPopup(feature: ProjectMapFeature) {
  const properties = feature.properties;
  const crackTypes = properties.crack_types.length > 0 ? properties.crack_types : ["None recorded"];
  const lengthEntries = Object.entries(properties.crack_length_m_by_type ?? {});
  return `
    <div style="min-width: 240px; max-width: 320px; color: #f5f5f5; font-size: 13px">
      <div style="margin-bottom: 12px">
        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #a3a3a3">Source</div>
        <div style="font-weight: 600; color: #fff">${escapeHtml(properties.source_label)}</div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px">
        <div>
          <div style="font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #a3a3a3">
            ${properties.is_relative ? "Relative PCI" : "PCI score"}
          </div>
          <div style="font-size: 24px; font-weight: 700; color: #fff">
            ${properties.pci_score == null ? "N/A" : properties.pci_score.toFixed(1)}
          </div>
        </div>
        <div>
          <div style="font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #a3a3a3">Condition</div>
          <div style="font-weight: 600; color: #fff; text-transform: capitalize">
            ${escapeHtml(properties.condition_category?.replace("_", " ") ?? "Unknown")}
          </div>
        </div>
      </div>
      <div style="display: grid; gap: 5px; margin-bottom: 12px; font-size: 12px">
        ${popupRow("Section", properties.section_index == null ? "N/A" : String(properties.section_index + 1))}
        ${popupRow("Start chainage", formatMeters(properties.segment_start_m))}
        ${popupRow("End chainage", formatMeters(properties.segment_end_m))}
        ${popupRow("Length", formatMeters(properties.length_m))}
        ${popupRow("Segment type", properties.is_relative ? "Relative (<100 m)" : "Standard 100 m")}
        ${popupRow("Cracks", String(properties.crack_count))}
      </div>
      <div style="margin-bottom: 12px">
        <div style="margin-bottom: 5px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #a3a3a3">Types</div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px">
          ${crackTypes.map((type) => `<span style="border-radius: 999px; background: #262626; padding: 2px 8px; font-size: 11px; color: #e5e5e5">${escapeHtml(type)}</span>`).join("")}
        </div>
      </div>
      ${
        lengthEntries.length > 0
          ? `<div style="margin-bottom: 12px">
              <div style="margin-bottom: 5px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #a3a3a3">Length by type</div>
              <div style="display: grid; gap: 4px; font-size: 12px">
                ${lengthEntries.map(([type, length]) => popupRow(type, `${length.toFixed(1)} m`)).join("")}
              </div>
            </div>`
          : ""
      }
      <div>
        <div style="margin-bottom: 5px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #a3a3a3">Recommended action</div>
        <div style="line-height: 1.55; color: #e5e5e5">
          ${escapeHtml(properties.recommended_mitigation ?? properties.recommended_intervention ?? "Not assigned")}
        </div>
      </div>
    </div>
  `;
}

function popupRow(label: string, value: string) {
  return `
    <div style="display: flex; justify-content: space-between; gap: 16px">
      <span style="color: #a3a3a3">${escapeHtml(label)}</span>
      <span style="font-weight: 600; color: #fff">${escapeHtml(value)}</span>
    </div>
  `;
}

function formatMeters(value: number | null | undefined) {
  if (value == null) return "N/A";
  return `${value.toFixed(1)} m`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
