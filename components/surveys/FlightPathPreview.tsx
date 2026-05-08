"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoPairForPreview {
  id: string;
  video: File | null;
  srt: File | null;
  videoName: string;
}

export interface FlightPathPreviewProps {
  pairs: VideoPairForPreview[];
  className?: string;
}

interface GpsPoint {
  lat: number;
  lon: number;
  alt: number | null;
  timestamp_ms: number;
}

interface ParsedTrack {
  id: string;
  videoName: string;
  points: GpsPoint[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRACK_COLORS = [
  "#f59e0b",
  "#3b82f6",
  "#10b981",
  "#f43f5e",
  "#8b5cf6",
  "#06b6d4",
];

// ---------------------------------------------------------------------------
// SRT parser (client-side, no backend)
// ---------------------------------------------------------------------------

const TIMECODE_RE = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/;
const LAT_RE = /latitude\s*[:=]\s*(-?\d+(?:\.\d+)?)/i;
const LON_RE = /longitude\s*[:=]\s*(-?\d+(?:\.\d+)?)/i;
const GPS_TUPLE_RE = /GPS\s*\(\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i;
const ABS_ALT_RE = /abs_alt\s*[:=]\s*(-?\d+(?:\.\d+)?)/i;
const REL_ALT_RE = /rel_alt\s*[:=]\s*(-?\d+(?:\.\d+)?)/i;

async function parseSrtFile(file: File): Promise<GpsPoint[]> {
  const text = await file.text();
  // Split into blocks by blank lines
  const blocks = text.split(/\n\s*\n/);
  const points: GpsPoint[] = [];

  for (const block of blocks) {
    const lines = block.trim().split(/\n/);
    if (lines.length < 2) continue;

    // Find timecode line — search all lines in block
    let timestamp_ms = 0;
    let foundTime = false;
    for (const line of lines) {
      const timeMatch = line.match(TIMECODE_RE);
      if (timeMatch) {
        const [, hh, mm, ss, ms] = timeMatch;
        timestamp_ms =
          (parseInt(hh, 10) * 3600 +
            parseInt(mm, 10) * 60 +
            parseInt(ss, 10)) *
            1000 +
          parseInt(ms, 10);
        foundTime = true;
        break;
      }
    }
    if (!foundTime) continue;

    const blockText = lines.join(" ");

    // Try named latitude/longitude first
    let lat: number | null = null;
    let lon: number | null = null;

    const latMatch = blockText.match(LAT_RE);
    const lonMatch = blockText.match(LON_RE);
    if (latMatch && lonMatch) {
      lat = parseFloat(latMatch[1]);
      lon = parseFloat(lonMatch[1]);
    } else {
      // Fallback: GPS tuple format
      const tupleMatch = blockText.match(GPS_TUPLE_RE);
      if (tupleMatch) {
        lat = parseFloat(tupleMatch[1]);
        lon = parseFloat(tupleMatch[2]);
      }
    }

    if (lat === null || lon === null) continue;
    // Basic sanity check
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    if (lat === 0 && lon === 0) continue;

    let alt: number | null = null;
    const absAltMatch = blockText.match(ABS_ALT_RE);
    if (absAltMatch) {
      alt = parseFloat(absAltMatch[1]);
    } else {
      const relAltMatch = blockText.match(REL_ALT_RE);
      if (relAltMatch) alt = parseFloat(relAltMatch[1]);
    }

    points.push({ lat, lon, alt, timestamp_ms });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Haversine distance (meters)
// ---------------------------------------------------------------------------

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function trackLengthMeters(points: GpsPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(
      points[i - 1].lat,
      points[i - 1].lon,
      points[i].lat,
      points[i].lon,
    );
  }
  return total;
}

/** Approximate total coverage by summing per-track lengths (rough dedup). */
function estimateCoverageMeters(tracks: ParsedTrack[]): number {
  return tracks.reduce((sum, t) => sum + trackLengthMeters(t.points), 0);
}

/** Check whether any two tracks share overlapping bounding boxes (very coarse). */
function detectOverlap(tracks: ParsedTrack[]): boolean {
  if (tracks.length < 2) return false;
  for (let i = 0; i < tracks.length; i++) {
    for (let j = i + 1; j < tracks.length; j++) {
      const a = tracks[i].points;
      const b = tracks[j].points;
      if (a.length === 0 || b.length === 0) continue;
      const aMinLat = Math.min(...a.map((p) => p.lat));
      const aMaxLat = Math.max(...a.map((p) => p.lat));
      const aMinLon = Math.min(...a.map((p) => p.lon));
      const aMaxLon = Math.max(...a.map((p) => p.lon));
      const bMinLat = Math.min(...b.map((p) => p.lat));
      const bMaxLat = Math.max(...b.map((p) => p.lat));
      const bMinLon = Math.min(...b.map((p) => p.lon));
      const bMaxLon = Math.max(...b.map((p) => p.lon));
      const latOverlap = aMinLat <= bMaxLat && bMinLat <= aMaxLat;
      const lonOverlap = aMinLon <= bMaxLon && bMinLon <= aMaxLon;
      if (latOverlap && lonOverlap) return true;
    }
  }
  return false;
}

/** Find midpoints of overlapping bounding boxes between track pairs. */
function overlapMidpoints(
  tracks: ParsedTrack[],
): Array<[number, number]> {
  const midpoints: Array<[number, number]> = [];
  for (let i = 0; i < tracks.length; i++) {
    for (let j = i + 1; j < tracks.length; j++) {
      const a = tracks[i].points;
      const b = tracks[j].points;
      if (a.length === 0 || b.length === 0) continue;
      const aMinLat = Math.min(...a.map((p) => p.lat));
      const aMaxLat = Math.max(...a.map((p) => p.lat));
      const aMinLon = Math.min(...a.map((p) => p.lon));
      const aMaxLon = Math.max(...a.map((p) => p.lon));
      const bMinLat = Math.min(...b.map((p) => p.lat));
      const bMaxLat = Math.max(...b.map((p) => p.lat));
      const bMinLon = Math.min(...b.map((p) => p.lon));
      const bMaxLon = Math.max(...b.map((p) => p.lon));
      const latOverlap = aMinLat <= bMaxLat && bMinLat <= aMaxLat;
      const lonOverlap = aMinLon <= bMaxLon && bMinLon <= aMaxLon;
      if (latOverlap && lonOverlap) {
        const midLat = (Math.max(aMinLat, bMinLat) + Math.min(aMaxLat, bMaxLat)) / 2;
        const midLon = (Math.max(aMinLon, bMinLon) + Math.min(aMaxLon, bMaxLon)) / 2;
        midpoints.push([midLat, midLon]);
      }
    }
  }
  return midpoints;
}

function formatMeters(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FlightPathPreview({ pairs, className }: FlightPathPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const [tracks, setTracks] = useState<ParsedTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState(false);

  const hasSrt = pairs.some((p) => p.srt !== null);

  // Parse SRT files when pairs change
  useEffect(() => {
    if (!hasSrt) {
      setTracks([]);
      setParsed(true);
      return;
    }

    setLoading(true);
    setParsed(false);

    const pairsWithSrt = pairs.filter((p) => p.srt !== null);

    Promise.all(
      pairsWithSrt.map(async (pair) => {
        try {
          const points = await parseSrtFile(pair.srt!);
          return { id: pair.id, videoName: pair.videoName, points };
        } catch {
          return { id: pair.id, videoName: pair.videoName, points: [] };
        }
      }),
    ).then((results) => {
      setTracks(results);
      setLoading(false);
      setParsed(true);
    });
  }, [pairs, hasSrt]);

  // Build/rebuild map when tracks change
  useEffect(() => {
    if (!parsed) return;
    if (!containerRef.current) return;

    // Tear down previous map instance
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const tracksWithPoints = tracks.filter((t) => t.points.length > 0);

    const map = L.map(containerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 14,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20,
      },
    ).addTo(map);

    if (tracksWithPoints.length === 0) {
      return () => {
        map.remove();
        mapRef.current = null;
      };
    }

    const allBounds: L.LatLngExpression[] = [];

    tracksWithPoints.forEach((track, idx) => {
      const color = TRACK_COLORS[idx % TRACK_COLORS.length];
      const latlngs: L.LatLngExpression[] = track.points.map((p) => [
        p.lat,
        p.lon,
      ]);

      allBounds.push(...latlngs);

      // Polyline
      L.polyline(latlngs, { color, weight: 3, opacity: 0.9 }).addTo(map);

      // Start marker (circle, larger)
      const first = track.points[0];
      L.circleMarker([first.lat, first.lon], {
        radius: 7,
        color,
        fillColor: color,
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip(`${track.videoName} — start`, { sticky: true })
        .addTo(map);

      // End marker (smaller circle with white fill to distinguish)
      const last = track.points[track.points.length - 1];
      L.circleMarker([last.lat, last.lon], {
        radius: 4,
        color,
        fillColor: "#ffffff",
        fillOpacity: 0.9,
        weight: 2,
      })
        .bindTooltip(`${track.videoName} — end`, { sticky: true })
        .addTo(map);
    });

    // Overlap highlight circles
    const midpoints = overlapMidpoints(tracksWithPoints);
    for (const [lat, lon] of midpoints) {
      L.circle([lat, lon], {
        radius: 80,
        color: "#f59e0b",
        fillColor: "#f59e0b",
        fillOpacity: 0.2,
        weight: 1,
        dashArray: "4 4",
      }).addTo(map);
    }

    // Fit bounds
    if (allBounds.length > 0) {
      map.fitBounds(L.latLngBounds(allBounds), { padding: [32, 32], maxZoom: 18 });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [tracks, parsed]);

  // Metrics
  const tracksWithPoints = tracks.filter((t) => t.points.length > 0);
  const totalCoverage = estimateCoverageMeters(tracksWithPoints);
  const hasOverlap = detectOverlap(tracksWithPoints);
  const srtCount = pairs.filter((p) => p.srt !== null).length;

  // States
  if (!hasSrt) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-white/10 bg-[#0b0c0d] ${className ?? ""}`}
        style={{ height: 320 }}
      >
        <p className="text-sm text-gray-500">
          No SRT files found — flight path preview unavailable
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-white/10 bg-[#0b0c0d] ${className ?? ""}`}
        style={{ height: 320 }}
      >
        <svg
          className="h-5 w-5 animate-spin text-amber-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
        <p className="text-sm text-gray-500">Parsing GPS data…</p>
      </div>
    );
  }

  if (parsed && tracksWithPoints.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-white/10 bg-[#0b0c0d] ${className ?? ""}`}
        style={{ height: 320 }}
      >
        <p className="text-sm text-gray-500">
          SRT files contained no GPS data — flight path preview unavailable
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      {/* Map */}
      <div
        className="relative overflow-hidden rounded-lg border border-white/10 bg-[#0b0c0d]"
        style={{ height: 320 }}
      >
        <div ref={containerRef} className="h-full w-full" />

        {/* Legend overlay */}
        {tracksWithPoints.length > 0 && (
          <div className="absolute bottom-3 left-3 z-[500] max-w-[220px] rounded-md border border-white/10 bg-[#0b0c0d]/90 p-2.5 text-xs backdrop-blur">
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-gray-500">
              Flight paths
            </p>
            <div className="space-y-1">
              {tracksWithPoints.map((track, idx) => (
                <div key={track.id} className="flex items-center gap-2 text-gray-300">
                  <span
                    className="h-2 w-5 shrink-0 rounded-sm"
                    style={{ background: TRACK_COLORS[idx % TRACK_COLORS.length] }}
                  />
                  <span className="truncate" title={track.videoName}>
                    {track.videoName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Metrics bar */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 px-1 text-sm text-gray-400">
        <span>
          Total coverage:{" "}
          <span className="font-semibold text-amber-400">
            ~{formatMeters(totalCoverage)} estimated
          </span>
        </span>
        <span>
          Videos:{" "}
          <span className="font-semibold text-amber-400">
            {pairs.length}
          </span>{" "}
          ({srtCount} with SRT)
        </span>
        <span>
          Overlap:{" "}
          <span className="font-semibold text-amber-400">
            {hasOverlap ? "detected" : "not detected"}
          </span>
        </span>
      </div>
    </div>
  );
}
