"use client";

import { useEffect, useRef } from "react";
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

      // Draw polyline segments between consecutive GPS frames, colored by PCI band
      for (let i = 0; i < gpsFrames.length - 1; i++) {
        const a = gpsFrames[i];
        const b = gpsFrames[i + 1];
        const band = getPciBand(a.pci_score);

        L.polyline([[a.lat!, a.lon!], [b.lat!, b.lon!]], {
          color: band.color,
          weight: 5,
          opacity: 0.85,
        }).addTo(map);
      }

      // Draw clickable circle markers at each frame
      for (const frame of gpsFrames) {
        const band = getPciBand(frame.pci_score);
        const marker = L.circleMarker([frame.lat!, frame.lon!], {
          radius: 6,
          fillColor: band.color,
          color: "#000",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(map);

        marker.on("click", () => onSelect(frame));
      }

      // Fit bounds
      const bounds = L.latLngBounds(gpsFrames.map((f) => [f.lat!, f.lon!]));
      map.fitBounds(bounds, { padding: [40, 40] });
    })();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [frames, onSelect]);

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

  return <div ref={containerRef} className="h-full w-full rounded-xl" />;
}
