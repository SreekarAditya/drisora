import {
  Circle,
  Document,
  Page,
  Text,
  View,
  Line,
  Rect,
  StyleSheet,
  Svg,
} from "@react-pdf/renderer";
import { analyzeDistress } from "@/lib/civil-intelligence";
import { getPciBand, JOB_MODE_LABELS, PCI_BANDS } from "@/types";
import type { FrameResult, JobResults } from "@/types";

const C = {
  text: "#111827",
  muted: "#6b7280",
  border: "#d1d5db",
  light: "#f3f4f6",
  amber: "#b45309",
  dark: "#111827",
  white: "#ffffff",
  green: "#16a34a",
  yellow: "#ca8a04",
  orange: "#ea580c",
  red: "#dc2626",
} as const;

const s = StyleSheet.create({
  page: { padding: 34, backgroundColor: C.white, color: C.text, fontFamily: "Helvetica", fontSize: 8.5 },
  cover: { padding: 42, backgroundColor: C.white, color: C.text, fontFamily: "Helvetica" },
  brand: { fontSize: 28, fontWeight: 700, color: C.dark },
  kicker: { fontSize: 9, color: C.amber, letterSpacing: 1.8, textTransform: "uppercase" },
  title: { marginTop: 74, fontSize: 30, fontWeight: 700, color: C.dark, lineHeight: 1.12 },
  subtitle: { marginTop: 10, fontSize: 11, color: C.muted, lineHeight: 1.5 },
  h2: { fontSize: 15, fontWeight: 700, color: C.dark, marginBottom: 10 },
  h3: { fontSize: 10, fontWeight: 700, color: C.dark, marginBottom: 6 },
  small: { fontSize: 7.5, color: C.muted, lineHeight: 1.35 },
  metaGrid: { marginTop: 26, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  meta: { width: "48%", border: `1px solid ${C.border}`, padding: 10 },
  metaLabel: { fontSize: 7, color: C.muted, textTransform: "uppercase", letterSpacing: 0.7 },
  metaValue: { marginTop: 3, fontSize: 10, fontWeight: 700, color: C.dark },
  kpiRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  kpi: { flex: 1, border: `1px solid ${C.border}`, padding: 10, backgroundColor: C.light },
  kpiValue: { fontSize: 18, fontWeight: 700, color: C.dark },
  kpiLabel: { marginTop: 2, fontSize: 7.5, color: C.muted },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { fontSize: 7.5, fontWeight: 700 },
  table: { width: "100%", borderTop: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` },
  row: { flexDirection: "row", borderBottom: `1px solid ${C.border}`, minHeight: 28 },
  th: { backgroundColor: C.light, fontSize: 7, fontWeight: 700, color: C.dark, padding: 5, borderRight: `1px solid ${C.border}` },
  td: { fontSize: 7, color: C.text, padding: 5, borderRight: `1px solid ${C.border}`, lineHeight: 1.25 },
  colSection: { width: "7%" },
  colGps: { width: "12%" },
  colPci: { width: "7%" },
  colCracks: { width: "15%" },
  colWidth: { width: "10%" },
  colCause: { width: "18%" },
  colMitigation: { width: "23%" },
  colPriority: { width: "8%" },
  mapPanel: { border: `1px solid ${C.border}`, padding: 10, backgroundColor: "#f9fafb" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  swatch: { width: 18, height: 8 },
  footer: { position: "absolute", left: 34, right: 34, bottom: 20, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: C.muted },
  stamp: { marginTop: 20, border: `2px solid ${C.amber}`, padding: 12 },
  stampText: { fontSize: 11, fontWeight: 700, color: C.amber, textAlign: "center" },
});

interface Props {
  results: JobResults;
  surveyDate: string;
  orgName: string;
}

function formatGps(frame: FrameResult) {
  if (frame.lat == null || frame.lon == null) return "N/A";
  return `${frame.lat.toFixed(5)}, ${frame.lon.toFixed(5)}`;
}

function crackSummary(frame: FrameResult) {
  const count = frame.final_detection_count ?? frame.yolo_detection_count ?? frame.crack_types.length;
  const types = frame.crack_types.length > 0 ? frame.crack_types.join(", ") : "None";
  return `${types}${count > 0 ? ` (${count})` : ""}`;
}

function widthSummary(frame: FrameResult) {
  if (frame.max_crack_width_mm == null && frame.avg_crack_width_mm == null) return "N/A";
  const max = frame.max_crack_width_mm == null ? "N/A" : `${frame.max_crack_width_mm.toFixed(1)} max`;
  const avg = frame.avg_crack_width_mm == null ? "N/A" : `${frame.avg_crack_width_mm.toFixed(1)} avg`;
  return `${max} / ${avg} mm`;
}

function chunks<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function roadLengthMeters(frames: FrameResult[]) {
  return frames.reduce((total, frame, index) => {
    if (index === 0) return total;
    const prev = frames[index - 1];
    if (prev.lat == null || prev.lon == null || frame.lat == null || frame.lon == null) return total;
    const r = 6371000;
    const dLat = ((frame.lat - prev.lat) * Math.PI) / 180;
    const dLon = ((frame.lon - prev.lon) * Math.PI) / 180;
    const latA = (prev.lat * Math.PI) / 180;
    const latB = (frame.lat * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;
    return total + r * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }, 0);
}

function formatLength(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(0)} m`;
}

function mapPoint(
  frame: FrameResult,
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
) {
  const width = 500;
  const height = 290;
  const pad = 28;
  return {
    x: pad + (((frame.lon ?? bounds.minLon) - bounds.minLon) / (bounds.maxLon - bounds.minLon || 1)) * (width - pad * 2),
    y: pad + (1 - (((frame.lat ?? bounds.minLat) - bounds.minLat) / (bounds.maxLat - bounds.minLat || 1))) * (height - pad * 2),
  };
}

function ConditionMapPage({ frames, summary, jobId }: { frames: FrameResult[]; summary: JobResults["summary"]; jobId: string }) {
  const gpsFrames = frames.filter((frame) => frame.lat != null && frame.lon != null);
  const bounds = gpsFrames.length > 0
    ? {
        minLat: Math.min(...gpsFrames.map((frame) => frame.lat!)),
        maxLat: Math.max(...gpsFrames.map((frame) => frame.lat!)),
        minLon: Math.min(...gpsFrames.map((frame) => frame.lon!)),
        maxLon: Math.max(...gpsFrames.map((frame) => frame.lon!)),
      }
    : null;

  return (
    <Page size="A4" style={s.page}>
      <Text style={s.h2}>Pavement Condition Map</Text>
      <View style={s.kpiRow}>
        <View style={s.kpi}>
          <Text style={s.kpiValue}>{gpsFrames.length}</Text>
          <Text style={s.kpiLabel}>GPS sections</Text>
        </View>
        <View style={s.kpi}>
          <Text style={s.kpiValue}>{formatLength(roadLengthMeters(gpsFrames))}</Text>
          <Text style={s.kpiLabel}>Estimated route length</Text>
        </View>
        <View style={s.kpi}>
          <Text style={[s.kpiValue, { color: getPciBand(summary.average_pci).color }]}>{summary.average_pci.toFixed(1)}</Text>
          <Text style={s.kpiLabel}>Average PCI</Text>
        </View>
      </View>

      <View style={[s.mapPanel, { marginTop: 14 }]}>
        {bounds ? (
          <Svg width="500" height="290" viewBox="0 0 500 290">
            <Rect x="0" y="0" width="500" height="290" fill="#f9fafb" />
            <Line x1="0" y1="80" x2="500" y2="20" stroke="#e5e7eb" strokeWidth="2" />
            <Line x1="0" y1="210" x2="500" y2="255" stroke="#e5e7eb" strokeWidth="2" />
            {gpsFrames.slice(0, -1).map((frame, index) => {
              const next = gpsFrames[index + 1];
              const a = mapPoint(frame, bounds);
              const b = mapPoint(next, bounds);
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
              const point = mapPoint(frame, bounds);
              return (
                <Circle
                  key={frame.stem}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill={getPciBand(frame.pci_score).color}
                  stroke="#ffffff"
                  strokeWidth="1"
                />
              );
            })}
          </Svg>
        ) : (
          <View style={{ height: 290, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.muted }}>No GPS coordinates available for map rendering.</Text>
          </View>
        )}
      </View>

      <View style={s.legend}>
        {PCI_BANDS.map((band) => (
          <View key={band.label} style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: band.color }]} />
            <Text style={s.small}>{band.label} {band.range}</Text>
          </View>
        ))}
      </View>

      <Footer jobId={jobId} />
    </Page>
  );
}

function SectionTablePage({
  rows,
  pageIndex,
  pageCount,
  jobId,
}: {
  rows: FrameResult[];
  pageIndex: number;
  pageCount: number;
  jobId: string;
}) {
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.h2}>Section Summary Table</Text>
      <Text style={[s.small, { marginBottom: 8 }]}>
        10 m section summary. Page {pageIndex + 1} of {pageCount}.
      </Text>
      <View style={s.table}>
        <View style={s.row} fixed>
          <Text style={[s.th, s.colSection]}>Section</Text>
          <Text style={[s.th, s.colGps]}>GPS</Text>
          <Text style={[s.th, s.colPci]}>PCI</Text>
          <Text style={[s.th, s.colCracks]}>Crack Types + Count</Text>
          <Text style={[s.th, s.colWidth]}>Width</Text>
          <Text style={[s.th, s.colCause]}>Possible Cause(s)</Text>
          <Text style={[s.th, s.colMitigation]}>Recommended Mitigation</Text>
          <Text style={[s.th, s.colPriority]}>Priority</Text>
        </View>
        {rows.map((frame, index) => {
          const analysis = analyzeDistress({
            crackTypes: frame.crack_types,
            pci: frame.pci_score,
            avgWidthMm: frame.avg_crack_width_mm,
            maxWidthMm: frame.max_crack_width_mm,
            crackCount: frame.final_detection_count ?? frame.crack_types.length,
            sectionLengthM: 10,
          });
          return (
            <View key={frame.stem} style={s.row}>
              <Text style={[s.td, s.colSection]}>{pageIndex * 18 + index + 1}</Text>
              <Text style={[s.td, s.colGps]}>{formatGps(frame)}</Text>
              <Text style={[s.td, s.colPci, { color: getPciBand(frame.pci_score).color, fontWeight: 700 }]}>
                {frame.pci_score.toFixed(0)}
              </Text>
              <Text style={[s.td, s.colCracks]}>{crackSummary(frame)}</Text>
              <Text style={[s.td, s.colWidth]}>{widthSummary(frame)}</Text>
              <Text style={[s.td, s.colCause]}>{analysis.possibleCauses.slice(0, 2).join("; ")}</Text>
              <Text style={[s.td, s.colMitigation]}>{analysis.recommendedMitigation}</Text>
              <Text style={[s.td, s.colPriority]}>{analysis.priority}</Text>
            </View>
          );
        })}
      </View>
      <Footer jobId={jobId} />
    </Page>
  );
}

function Footer({ jobId }: { jobId: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Drisora - IRC:82-2023</Text>
      <Text style={s.footerText}>Job {jobId}</Text>
    </View>
  );
}

export function JobReport({ results, surveyDate, orgName }: Props) {
  const { summary, frames, mode, job_id } = results;
  const avgBand = getPciBand(summary.average_pci);
  const sampledRows = frames.slice(0, 216);
  const rowPages = chunks(sampledRows, 18);
  const crackEntries = Object.entries(summary.crack_type_counts).sort((a, b) => b[1] - a[1]);
  const analyses = frames
    .map((frame) =>
      analyzeDistress({
        crackTypes: frame.crack_types,
        pci: frame.pci_score,
        avgWidthMm: frame.avg_crack_width_mm,
        maxWidthMm: frame.max_crack_width_mm,
        crackCount: frame.final_detection_count ?? frame.crack_types.length,
        sectionLengthM: 10,
      }),
    )
    .filter((analysis) => analysis.primaryDistress != null);
  const immediate = analyses.filter((analysis) => analysis.priority === "Immediate").length;
  const maxWidth = frames
    .map((frame) => frame.max_crack_width_mm)
    .filter((value): value is number => value != null)
    .sort((a, b) => b - a)[0] ?? null;

  return (
    <Document>
      <Page size="A4" style={s.cover}>
        <Text style={s.brand}>Drisora</Text>
        <Text style={[s.kicker, { marginTop: 8 }]}>IRC:82-2023 Pavement Condition Assessment</Text>
        <Text style={s.title}>Road Condition Survey Report</Text>
        <Text style={s.subtitle}>
          Professional AI-assisted pavement condition report generated from {JOB_MODE_LABELS[mode]} using PCI scoring,
          crack detection, segmentation, depth-assisted crack width, and maintenance intelligence.
        </Text>

        <View style={s.metaGrid}>
          <View style={s.meta}>
            <Text style={s.metaLabel}>Organization</Text>
            <Text style={s.metaValue}>{orgName}</Text>
          </View>
          <View style={s.meta}>
            <Text style={s.metaLabel}>Survey date</Text>
            <Text style={s.metaValue}>{surveyDate}</Text>
          </View>
          <View style={s.meta}>
            <Text style={s.metaLabel}>Capture mode</Text>
            <Text style={s.metaValue}>{JOB_MODE_LABELS[mode]}</Text>
          </View>
          <View style={s.meta}>
            <Text style={s.metaLabel}>Job ID</Text>
            <Text style={s.metaValue}>{job_id}</Text>
          </View>
        </View>

        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <Text style={[s.kpiValue, { color: avgBand.color }]}>{summary.average_pci.toFixed(1)}</Text>
            <Text style={s.kpiLabel}>Average PCI - {avgBand.label}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={[s.kpiValue, { color: getPciBand(summary.worst_pci).color }]}>{summary.worst_pci.toFixed(0)}</Text>
            <Text style={s.kpiLabel}>Worst section PCI</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiValue}>{frames.length}</Text>
            <Text style={s.kpiLabel}>10 m sections / frames</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiValue}>{immediate}</Text>
            <Text style={s.kpiLabel}>Immediate priority sections</Text>
          </View>
        </View>

        <View style={s.pills}>
          {PCI_BANDS.map((band) => {
            const count = frames.filter((frame) => frame.pci_score >= band.min && frame.pci_score <= band.max).length;
            return (
              <View key={band.label} style={[s.pill, { backgroundColor: `${band.color}22` }]}>
                <Text style={[s.pillText, { color: band.color }]}>{band.label}: {count}</Text>
              </View>
            );
          })}
        </View>

        <View style={s.stamp}>
          <Text style={s.stampText}>IRC:82-2023 COMPLIANCE REVIEW FORMAT</Text>
          <Text style={[s.small, { marginTop: 7, textAlign: "center" }]}>
            Depth-derived crack width is an engineering estimate and should be field-verified for contractual acceptance.
          </Text>
        </View>

        <Footer jobId={job_id} />
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Executive Summary</Text>
        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <Text style={[s.kpiValue, { color: avgBand.color }]}>{summary.average_pci.toFixed(1)}</Text>
            <Text style={s.kpiLabel}>Average PCI</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiValue}>{Object.values(summary.crack_type_counts).reduce((sum, value) => sum + value, 0)}</Text>
            <Text style={s.kpiLabel}>Crack observations</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiValue}>{maxWidth == null ? "N/A" : `${maxWidth.toFixed(1)} mm`}</Text>
            <Text style={s.kpiLabel}>Max crack width</Text>
          </View>
        </View>

        <View style={{ marginTop: 18 }}>
          <Text style={s.h3}>Condition distribution</Text>
          <View style={s.pills}>
            {PCI_BANDS.map((band) => {
              const count = frames.filter((frame) => frame.pci_score >= band.min && frame.pci_score <= band.max).length;
              return (
                <View key={band.label} style={[s.pill, { backgroundColor: `${band.color}22` }]}>
                  <Text style={[s.pillText, { color: band.color }]}>{band.label} {band.range}: {count}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={s.h3}>Detected distress mix</Text>
          <View style={s.table}>
            <View style={s.row}>
              <Text style={[s.th, { width: "70%" }]}>Crack type</Text>
              <Text style={[s.th, { width: "30%" }]}>Count</Text>
            </View>
            {(crackEntries.length > 0 ? crackEntries : [["No cracks detected", 0] as [string, number]]).map(([type, count]) => (
              <View key={type} style={s.row}>
                <Text style={[s.td, { width: "70%" }]}>{type}</Text>
                <Text style={[s.td, { width: "30%" }]}>{count}</Text>
              </View>
            ))}
          </View>
        </View>

        <Footer jobId={job_id} />
      </Page>

      {mode === "drone_footage" && <ConditionMapPage frames={frames} summary={summary} jobId={job_id} />}

      {rowPages.map((rows, index) => (
        <SectionTablePage key={index} rows={rows} pageIndex={index} pageCount={rowPages.length} jobId={job_id} />
      ))}

      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Methodology and Accuracy Note</Text>
        <Text style={{ fontSize: 9.5, lineHeight: 1.6, color: C.text }}>
          Drisora processes uploaded imagery or video through YOLOv12s distress detection, SAM2 mask refinement,
          optional Depth Pro camera-to-surface estimation, and PCI scoring aligned to IRC:82-2023 reporting bands.
          Crack width in millimeters is estimated by converting pixel measurements using the available depth and camera geometry.
        </Text>
        <Text style={{ marginTop: 12, fontSize: 9.5, lineHeight: 1.6, color: C.text }}>
          Maintenance causes and mitigations are generated from a rule-based civil engineering knowledge base for
          longitudinal cracks, transverse cracks, alligator fatigue cracks, and potholes. Priority uses crack width,
          crack density proxies, and PCI. Field verification is recommended before BOQ preparation, payment approval,
          or contractual enforcement.
        </Text>
        {frames.length > sampledRows.length && (
          <Text style={{ marginTop: 12, fontSize: 8, color: C.muted }}>
            Section table capped at {sampledRows.length} rows to keep the report concise. Full frame-level data remains available in the dashboard.
          </Text>
        )}
        <View style={s.stamp}>
          <Text style={s.stampText}>DRISORA IRC:82-2023 COMPLIANCE STAMP</Text>
        </View>
        <Footer jobId={job_id} />
      </Page>
    </Document>
  );
}
