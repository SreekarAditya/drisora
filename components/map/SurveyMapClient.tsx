"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import L from "leaflet";
import type { RoadSectionFeature, RoadSectionFeatureCollection } from "@/types";
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

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
    }).addTo(map);

    const group = L.featureGroup();
    const popupRoots: Root[] = [];

    for (const { feature, coordinates } of lines) {
      const popupContainer = document.createElement("div");
      const popupRoot = createRoot(popupContainer);
      popupRoot.render(<SectionPopup properties={feature.properties} />);
      popupRoots.push(popupRoot);

      L.polyline(coordinates, {
        color: pciColor(feature.properties.pci_score),
        weight: 6,
        opacity: 0.95,
      })
        .bindPopup(popupContainer, {
          className: "drisora-section-popup",
        })
        .addTo(group);
    }

    group.addTo(map);

    if (lines.length > 0) {
      map.fitBounds(group.getBounds(), { padding: [32, 32], maxZoom: 18 });
    }

    return () => {
      for (const popupRoot of popupRoots) {
        popupRoot.unmount();
      }
      map.remove();
    };
  }, [geojson]);

  return <div ref={containerRef} className="h-full min-h-[520px] w-full bg-neutral-950" />;
}
