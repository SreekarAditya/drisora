import {
  Circle,
  Document,
  Page,
  Text,
  View,
  Image,
  Line,
  Rect,
  StyleSheet,
  Svg,
} from "@react-pdf/renderer";
import type { JobResults, FrameResult } from "@/types";
import { getPciBand, ircRecommendation, JOB_MODE_LABELS, PCI_BANDS } from "@/types";

const C = {
  bg: "#0a0a0a",
  surface: "#111111",
  border: "#1e1e1e",
  amber: "#f59e0b",
  text: "#e5e5e5",
  muted: "#666666",
  good: "#22c55e",
  satisfactory: "#eab308",
  fair: "#f97316",
  poor: "#ef4444",
  veryPoor: "#7f1d1d",
} as const;

const s = StyleSheet.create({
  page: { backgroundColor: C.bg, fontFamily: "Helvetica", color: C.text, padding: 48 },
  coverTitle: { fontSize: 42, fontWeight: 600, color: "#ffffff", marginBottom: 4 },
  coverSub: { fontSize: 13, color: C.amber, letterSpacing: 2, textTransform: "uppercase" },
  coverMeta: { marginTop: 32, gap: 6 },
  coverMetaRow: { flexDirection: "row", gap: 8 },
  coverMetaLabel: { fontSize: 10, color: C.muted, width: 100 },
  coverMetaValue: { fontSize: 10, color: C.text },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 24 },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: C.amber, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 },
  statRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: C.surface, borderRadius: 6, padding: 14, border: `1px solid ${C.border}` },
  statValue: { fontSize: 22, fontWeight: 600, color: "#ffffff", marginBottom: 2 },
  statLabel: { fontSize: 9, color: C.muted },
  table: { width: "100%" },
  tableHeader: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 2 },
  tableRow: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 6, borderBottom: `1px solid ${C.border}` },
  colIndex: { width: 36, fontSize: 9, color: C.muted },
  colGps: { width: 100, fontSize: 9 },
  colPci: { width: 44, fontSize: 9 },
  colCracks: { flex: 1, fontSize: 9 },
  colAction: { width: 130, fontSize: 9 },
  headerText: { fontSize: 9, fontWeight: 600, color: C.muted },
  thumbGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  thumbCard: { width: "30%", backgroundColor: C.surface, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` },
  thumbImg: { width: "100%", height: 80, objectFit: "cover" },
  thumbMeta: { padding: 6 },
  thumbPci: { fontSize: 9, fontWeight: 600 },
  thumbCracks: { fontSize: 8, color: C.muted, marginTop: 2 },
  mapPanel: { backgroundColor: "#050505", borderRadius: 6, border: `1px solid ${C.border}`, padding: 12 },
  mapStats: { flexDirection: "row", gap: 10, marginBottom: 14 },
  mapStat: { flex: 1, backgroundColor: C.surface, borderRadius: 6, padding: 10, border: `1px solid ${C.border}` },
  mapStatValue: { fontSize: 16, fontWeight: 600, color: "#ffffff", marginBottom: 2 },
  mapStatLabel: { fontSize: 8, color: C.muted },
  mapLegend: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5, width: "31%" },
  legendSwatch: { width: 22, height: 8, borderRadius: 2 },
  legendText: { fontSize: 8, color: C.muted },
  emptyMap: { height: 300, alignItems: "center", justifyContent: "center", backgroundColor: "#050505", borderRadius: 6, border: `1px solid ${C.border}` },
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: C.muted },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontSize: 9, fontWeight: 600 },
});

function pciColor(score: number): string {
  const band = getPciBand(score);
  return band.color;
}

function ircCompliant(avgPci: number): string {
  return avgPci >= 70 ? "Compliant" : "Non-compliant";
}

function gpsStr(f: FrameResult): string {
  if (f.lat != null && f.lon != null) {
    return `${f.lat.toFixed(5)}, ${f.lon.toFixed(5)}`;
  }
  return "—";
}

function haversineMeters(a: FrameResult, b: FrameResult): number {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return 0;
  const r = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const latA = (a.lat * Math.PI) / 180;
  const latB = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function roadLengthMeters(frames: FrameResult[]): number {
  return frames.reduce((total, frame, index) => {
    if (index === 0) return total;
    return total + haversineMeters(frames[index - 1], frame);
  }, 0);
}

function formatRoadLength(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(0)} m`;
}

function projectFrame(
  frame: FrameResult,
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
) {
  const width = 499;
  const height = 300;
  const pad = 32;
  const lonRange = bounds.maxLon - bounds.minLon || 1;
  const latRange = bounds.maxLat - bounds.minLat || 1;
  return {
    x: pad + (((frame.lon ?? bounds.minLon) - bounds.minLon) / lonRange) * (width - pad * 2),
    y: pad + (1 - (((frame.lat ?? bounds.minLat) - bounds.minLat) / latRange)) * (height - pad * 2),
  };
}

function PavementConditionMapPage({
  frames,
  summary,
  jobId,
}: {
  frames: FrameResult[];
  summary: JobResults["summary"];
  jobId: string;
}) {
  const gpsFrames = frames.filter((f) => f.lat != null && f.lon != null);
  const bandCounts = PCI_BANDS.map((band) => ({
    band,
    count: frames.filter((f) => f.pci_score >= band.min && f.pci_score <= band.max).length,
  }));
  const routeLength = roadLengthMeters(gpsFrames);

  const bounds =
    gpsFrames.length > 0
      ? {
          minLat: Math.min(...gpsFrames.map((f) => f.lat!)),
          maxLat: Math.max(...gpsFrames.map((f) => f.lat!)),
          minLon: Math.min(...gpsFrames.map((f) => f.lon!)),
          maxLon: Math.max(...gpsFrames.map((f) => f.lon!)),
        }
      : null;

  return (
    <Page size="A4" style={s.page}>
      <Text style={s.sectionTitle}>Pavement Condition Map</Text>

      <View style={s.mapStats}>
        <View style={s.mapStat}>
          <Text style={s.mapStatValue}>{gpsFrames.length}</Text>
          <Text style={s.mapStatLabel}>GPS sections</Text>
        </View>
        <View style={s.mapStat}>
          <Text style={s.mapStatValue}>{formatRoadLength(routeLength)}</Text>
          <Text style={s.mapStatLabel}>Road length</Text>
        </View>
        <View style={s.mapStat}>
          <Text style={[s.mapStatValue, { color: getPciBand(summary.average_pci).color }]}>
            {summary.average_pci.toFixed(1)}
          </Text>
          <Text style={s.mapStatLabel}>Average PCI</Text>
        </View>
        <View style={s.mapStat}>
          <Text style={[s.mapStatValue, { color: getPciBand(summary.worst_pci).color }]}>
            {summary.worst_pci.toFixed(0)}
          </Text>
          <Text style={s.mapStatLabel}>Worst PCI</Text>
        </View>
      </View>

      {bounds ? (
        <View style={s.mapPanel}>
          <Svg width="499" height="300" viewBox="0 0 499 300">
            <Rect x="0" y="0" width="499" height="300" rx="6" fill="#030303" />
            <Line x1="15" y1="58" x2="484" y2="154" stroke="#141414" strokeWidth="2" />
            <Line x1="20" y1="218" x2="452" y2="266" stroke="#141414" strokeWidth="2" />
            <Line x1="80" y1="10" x2="35" y2="290" stroke="#171717" strokeWidth="2" />
            <Line x1="452" y1="10" x2="405" y2="290" stroke="#171717" strokeWidth="2" />
            {gpsFrames.slice(0, -1).map((frame, index) => {
              const next = gpsFrames[index + 1];
              const a = projectFrame(frame, bounds);
              const b = projectFrame(next, bounds);
              return (
                <Line
                  key={`${frame.stem}-${next.stem}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={getPciBand(frame.pci_score).color}
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              );
            })}
            {gpsFrames.map((frame) => {
              const point = projectFrame(frame, bounds);
              return (
                <Circle
                  key={frame.stem}
                  cx={point.x}
                  cy={point.y}
                  r="4.5"
                  fill={getPciBand(frame.pci_score).color}
                  stroke="#050505"
                  strokeWidth="1"
                />
              );
            })}
          </Svg>
        </View>
      ) : (
        <View style={s.emptyMap}>
          <Text style={{ fontSize: 12, color: C.text }}>No GPS coordinates available for this job</Text>
          <Text style={{ fontSize: 9, color: C.muted, marginTop: 6 }}>
            Frame-level PCI and crack results are still included in the summary tables.
          </Text>
        </View>
      )}

      <View style={s.mapLegend}>
        {bandCounts.map(({ band, count }) => (
          <View key={band.label} style={s.legendItem}>
            <View style={[s.legendSwatch, { backgroundColor: band.color }]} />
            <Text style={s.legendText}>
              {band.label} {band.range} ({count})
            </Text>
          </View>
        ))}
      </View>

      <View style={s.footer}>
        <Text style={s.footerText}>Drisora — IRC:82-2023</Text>
        <Text style={s.footerText}>Job {jobId}</Text>
      </View>
    </Page>
  );
}

interface Props {
  results: JobResults;
  surveyDate: string;
  orgName: string;
}

export function JobReport({ results, surveyDate, orgName }: Props) {
  const { summary, frames, mode, job_id } = results;
  const avgPci = summary.average_pci;
  const avgBand = getPciBand(avgPci);

  const worstFrames = [...frames]
    .sort((a, b) => a.pci_score - b.pci_score)
    .slice(0, 9)
    .filter((f) => f.overlay_url);

  const crackEntries = Object.entries(summary.crack_type_counts).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <Document>
      {/* Cover */}
      <Page size="A4" style={s.page}>
        <Text style={s.coverSub}>IRC:82-2023 Road Condition Report</Text>
        <Text style={[s.coverTitle, { marginTop: 16 }]}>Drisora</Text>

        <View style={s.divider} />

        <View style={s.coverMeta}>
          <View style={s.coverMetaRow}>
            <Text style={s.coverMetaLabel}>Survey date</Text>
            <Text style={s.coverMetaValue}>{surveyDate}</Text>
          </View>
          <View style={s.coverMetaRow}>
            <Text style={s.coverMetaLabel}>Organization</Text>
            <Text style={s.coverMetaValue}>{orgName}</Text>
          </View>
          <View style={s.coverMetaRow}>
            <Text style={s.coverMetaLabel}>Capture mode</Text>
            <Text style={s.coverMetaValue}>{JOB_MODE_LABELS[mode]}</Text>
          </View>
          <View style={s.coverMetaRow}>
            <Text style={s.coverMetaLabel}>Job ID</Text>
            <Text style={s.coverMetaValue}>{job_id}</Text>
          </View>
          <View style={s.coverMetaRow}>
            <Text style={s.coverMetaLabel}>IRC compliance</Text>
            <Text style={[s.coverMetaValue, { color: avgPci >= 70 ? C.good : C.poor }]}>
              {ircCompliant(avgPci)}
            </Text>
          </View>
        </View>

        <View style={[s.divider, { marginTop: 40 }]} />

        <View style={s.statRow}>
          <View style={s.statCard}>
            <Text style={s.statValue}>{summary.frame_count}</Text>
            <Text style={s.statLabel}>Sections analysed</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: avgBand.color }]}>{avgPci.toFixed(1)}</Text>
            <Text style={s.statLabel}>Average PCI — {avgBand.label}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: pciColor(summary.worst_pci) }]}>{summary.worst_pci.toFixed(1)}</Text>
            <Text style={s.statLabel}>Worst section PCI</Text>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Generated by Drisora</Text>
          <Text style={s.footerText}>{surveyDate}</Text>
        </View>
      </Page>

      {mode === "drone_footage" && (
        <PavementConditionMapPage frames={frames} summary={summary} jobId={job_id} />
      )}

      {/* Summary table */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>Summary</Text>

        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.headerText, s.colIndex]}>#</Text>
            <Text style={[s.headerText, s.colGps]}>GPS</Text>
            <Text style={[s.headerText, s.colPci]}>PCI</Text>
            <Text style={[s.headerText, s.colCracks]}>Crack types</Text>
            <Text style={[s.headerText, s.colAction]}>Recommendation</Text>
          </View>
          {frames.map((f, i) => {
            const band = getPciBand(f.pci_score);
            return (
              <View key={f.stem} style={s.tableRow}>
                <Text style={[s.colIndex, { color: C.muted }]}>{String(i + 1).padStart(3, "0")}</Text>
                <Text style={[s.colGps, { color: C.muted }]}>{gpsStr(f)}</Text>
                <Text style={[s.colPci, { color: band.color, fontWeight: 600 }]}>{f.pci_score.toFixed(0)}</Text>
                <Text style={[s.colCracks, { color: C.text }]}>
                  {f.crack_types.length > 0 ? f.crack_types.join(", ") : "—"}
                </Text>
                <Text style={[s.colAction, { color: C.muted }]}>{ircRecommendation(f.pci_score)}</Text>
              </View>
            );
          })}
        </View>

        {crackEntries.length > 0 && (
          <>
            <View style={[s.divider, { marginTop: 32 }]} />
            <Text style={s.sectionTitle}>Crack type distribution</Text>
            {crackEntries.map(([type, count]) => (
              <View key={type} style={[s.tableRow, { paddingVertical: 4 }]}>
                <Text style={{ fontSize: 9, flex: 1 }}>{type}</Text>
                <Text style={{ fontSize: 9, color: C.muted, width: 60 }}>{count} frames</Text>
              </View>
            ))}
          </>
        )}

        <View style={s.footer}>
          <Text style={s.footerText}>Drisora — IRC:82-2023</Text>
          <Text style={s.footerText}>Job {job_id}</Text>
        </View>
      </Page>

      {/* Worst-section thumbnails */}
      {worstFrames.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.sectionTitle}>Worst sections — crack overlays</Text>
          <View style={s.thumbGrid}>
            {worstFrames.map((f) => {
              const band = getPciBand(f.pci_score);
              return (
                <View key={f.stem} style={s.thumbCard}>
                  {f.overlay_url && (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image src={f.overlay_url} style={s.thumbImg} />
                  )}
                  <View style={s.thumbMeta}>
                    <Text style={[s.thumbPci, { color: band.color }]}>
                      PCI {f.pci_score.toFixed(0)} — {band.label}
                    </Text>
                    <Text style={s.thumbCracks}>
                      {f.crack_types.length > 0 ? f.crack_types.join(", ") : "No cracks detected"}
                    </Text>
                    <Text style={[s.thumbCracks, { marginTop: 2 }]}>
                      {ircRecommendation(f.pci_score)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>Drisora — IRC:82-2023</Text>
            <Text style={s.footerText}>Job {job_id}</Text>
          </View>
        </Page>
      )}
    </Document>
  );
}
