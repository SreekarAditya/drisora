"use client";

import { useEffect, useRef, useState } from "react";
import type { FrameResult } from "@/types";
import { getPciBand } from "@/types";

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

        L.polyline([[a.lat!, a.lon!], [b.lat!, b.lon!]], {
          color: overlayMode === "width" ? widthColor(a.max_crack_width_mm ?? a.avg_crack_width_mm) : getPciBand(a.pci_score).color,
          weight: overlayMode === "width" ? 7 : 5,
          opacity: 0.88,
        }).addTo(layers);
      }

      for (const frame of gpsFrames) {
        const marker = L.circleMarker([frame.lat!, frame.lon!], {
          radius: 6,
          fillColor: overlayMode === "width" ? widthColor(frame.max_crack_width_mm ?? frame.avg_crack_width_mm) : getPciBand(frame.pci_score).color,
          color: "#000",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(layers);

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
      <div ref={containerRef} className="h-full w-full rounded-xl" />
    </div>
  );
}

function widthColor(value: number | null | undefined) {
  if (value == null) return "#64748b";
  if (value < 3) return "#22c55e";
  if (value < 5) return "#eab308";
  if (value < 8) return "#f97316";
  return "#ef4444";
}
