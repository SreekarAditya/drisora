"use client";

import { useEffect, useRef, useState } from "react";
import type { FrameResult } from "@/types";
import { getPciBand } from "@/types";
import { CRACK_WIDTH_BANDS, crackWidthBandLabel, crackWidthColor } from "@/lib/crack-metrics";

interface Props {
  frames: FrameResult[];
  onSelect: (frame: FrameResult) => void;
  selectedStem: string | null;
}

export function DroneMapClient({ frames, onSelect, selectedStem }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layersRef = useRef<import("leaflet").LayerGroup | null>(null);
  const [overlayMode, setOverlayMode] = useState<"pci" | "width">("pci");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const gpsFrames = frames.filter((f) => f.lat != null && f.lon != null);
    if (gpsFrames.length === 0) return;

    void (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      const lats = gpsFrames.map((f) => f.lat!);
      const lons = gpsFrames.map((f) => f.lon!);
      const center: [number, number] = [
        (Math.min(...lats) + Math.max(...lats)) / 2,
        (Math.min(...lons) + Math.max(...lons)) / 2,
      ];

      const map = L.map(containerRef.current!, {
        center,
        zoom: 17,
        zoomControl: true,
        attributionControl: false,
      });
      mapRef.current = map;

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 22 },
      ).addTo(map);

      const layers = L.layerGroup().addTo(map);
      layersRef.current = layers;

      // Fit bounds
      const bounds = L.latLngBounds(gpsFrames.map((f) => [f.lat!, f.lon!]));
      map.fitBounds(bounds, { padding: [40, 40] });
    })();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [frames]);

  useEffect(() => {
    if (!mapRef.current || !layersRef.current) return;

    void (async () => {
      const L = (await import("leaflet")).default;
      const gpsFrames = frames.filter((f) => f.lat != null && f.lon != null);
      const layers = layersRef.current!;
      layers.clearLayers();

      for (let i = 0; i < gpsFrames.length - 1; i++) {
        const a = gpsFrames[i];
        const b = gpsFrames[i + 1];

        const widthValue = a.max_crack_width_mm ?? a.avg_crack_width_mm;
        L.polyline([[a.lat!, a.lon!], [b.lat!, b.lon!]], {
          color: overlayMode === "width" ? crackWidthColor(widthValue) : getPciBand(a.pci_score).color,
          weight: overlayMode === "width" ? 7 : 5,
          opacity: 0.88,
        })
          .bindTooltip(segmentTooltip(a), {
            sticky: true,
            className: "drisora-map-tooltip",
          })
          .addTo(layers);
      }

      for (const frame of gpsFrames) {
        const widthValue = frame.max_crack_width_mm ?? frame.avg_crack_width_mm;
        const marker = L.circleMarker([frame.lat!, frame.lon!], {
          radius: 6,
          fillColor: overlayMode === "width" ? crackWidthColor(widthValue) : getPciBand(frame.pci_score).color,
          color: "#000",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.9,
        })
          .bindTooltip(segmentTooltip(frame), {
            sticky: true,
            className: "drisora-map-tooltip",
          })
          .addTo(layers);

        marker.on("click", () => onSelect(frame));
      }
    })();
  }, [frames, onSelect, overlayMode]);

  // Highlight selected marker by panning — re-run when selection changes
  useEffect(() => {
    if (!mapRef.current || !selectedStem) return;
    const frame = frames.find((f) => f.stem === selectedStem);
    if (frame?.lat != null && frame.lon != null) {
      mapRef.current.panTo([frame.lat, frame.lon]);
    }
  }, [selectedStem, frames]);

  const gpsCount = frames.filter((f) => f.lat != null && f.lon != null).length;

  if (gpsCount === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] text-sm text-gray-600">
        No GPS coordinates available in this job
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute right-3 top-3 z-[500] flex overflow-hidden rounded-md border border-white/10 bg-[#0b0c0d]/90 p-1 backdrop-blur">
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
      <div className="absolute bottom-3 left-3 z-[500] max-w-[260px] rounded-lg border border-white/10 bg-[#0b0c0d]/90 p-3 text-xs shadow-xl backdrop-blur">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-gray-500">
          {overlayMode === "width" ? "Crack width legend" : "PCI legend"}
        </p>
        <div className="space-y-1.5">
          {overlayMode === "width"
            ? CRACK_WIDTH_BANDS.map((band) => (
                <div key={band.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-gray-300">
                    <span className="h-2.5 w-6 rounded-sm" style={{ background: band.color }} />
                    {band.label}
                  </span>
                  <span className="text-gray-600">{band.detail}</span>
                </div>
              ))
            : ["Good 85-100", "Satisfactory 70-84", "Fair 55-69", "Poor 40-54", "Very poor 0-39"].map((label, index) => {
                const colors = ["#22c55e", "#eab308", "#f97316", "#ef4444", "#7f1d1d"];
                return (
                  <div key={label} className="flex items-center gap-2 text-gray-300">
                    <span className="h-2.5 w-6 rounded-sm" style={{ background: colors[index] }} />
                    {label}
                  </div>
                );
              })}
        </div>
        {overlayMode === "width" && (
          <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-4 text-gray-600">
            Legacy surveys are estimated from crack type, PCI, and detection density when depth metrics were not stored.
          </p>
        )}
      </div>
      <div ref={containerRef} className="h-full w-full rounded-xl" />
    </div>
  );
}

function segmentTooltip(frame: FrameResult) {
  const widthValue = frame.max_crack_width_mm ?? frame.avg_crack_width_mm;
  const crackTypes = frame.crack_types.length > 0 ? frame.crack_types.join(", ") : "No cracks detected";
  const estimate = frame.crack_metrics_estimated ? " (legacy estimate)" : "";
  return `
    <div style="min-width: 180px">
      <div style="font-size: 11px; color: #9ca3af">Section ${frame.index + 1}</div>
      <div style="margin-top: 3px; font-weight: 700; color: ${getPciBand(frame.pci_score).color}">PCI ${frame.pci_score.toFixed(0)} - ${getPciBand(frame.pci_score).label}</div>
      <div style="margin-top: 6px; color: #e5e7eb">Max width: ${widthValue == null ? "N/A" : `${widthValue.toFixed(1)} mm${estimate}`}</div>
      <div style="margin-top: 2px; color: #9ca3af">${crackWidthBandLabel(widthValue)}</div>
      <div style="margin-top: 6px; color: #9ca3af">${escapeHtml(crackTypes)}</div>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
