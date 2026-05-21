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
import { CRACK_WIDTH_BANDS, crackWidthColor } from "@/lib/crack-metrics";
import { getPciBand, JOB_MODE_LABELS, PCI_BANDS } from "@/types";
import type { FrameResult, JobResults } from "@/types";

const ROWS_PER_PAGE = 20;
const MAX_SECTION_ROWS = 180;

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
  slate: "#0f172a",
} as const;

const s = StyleSheet.create({
  page: { padding: 34, backgroundColor: C.white, color: C.text, fontFamily: "Helvetica", fontSize: 8.5 },
  cover: { padding: 42, backgroundColor: C.white, color: C.text, fontFamily: "Helvetica" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  brand: { fontSize: 28, fontWeight: 700, color: C.dark },
  brandSmall: { fontSize: 14, fontWeight: 700, color: C.dark },
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
  colSection: { width: "6%" },
  colGps: { width: "11%" },
  colPci: { width: "6%" },
  colCracks: { width: "14%" },
  colWidth: { width: "7%" },
  colCause: { width: "17%" },
  colMitigation: { width: "24%" },
  colPriority: { width: "8%" },
  mapPanel: { border: `1px solid ${C.border}`, padding: 10, backgroundColor: "#f9fafb" },
  mapDark: { border: "1px solid #1f2937", padding: 12, backgroundColor: "#0b0c0d" },
  mapCaptionGrid: { flexDirection: "row", gap: 10, marginTop: 10 },
  mapCaption: { flex: 1, border: "1px solid #e5e7eb", padding: 8, backgroundColor: "#ffffff" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  swatch: { width: 18, height: 8 },
  footer: { position: "absolute", left: 34, right: 34, bottom: 20, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: C.muted },
  stamp: { marginTop: 20, border: `2px solid ${C.amber}`, padding: 12 },
  stampText: { fontSize: 11, fontWeight: 700, color: C.amber, textAlign: "center" },
});

interface PciSegmentData {
  segment_index: number;
  start_distance_m: number;
  end_distance_m: number;
  total_length_m: number;
  pci_score: number | null;
  pci_grade: string | null;
  is_relative: boolean;
  detection_count: number;
}

interface Props {
  results: JobResults;
  surveyDate: string;
  orgName: string;
  pciSegments?: PciSegmentData[];
  surveySummary?: {
    weighted_pci: number;
    total_length_m: number;
    segment_count: number;
    rpci_segment_count: number;
  };
}

function pciGradeColor(grade: string | null): string {
  switch (grade) {
    case "Good": return "#16a34a";
    case "Satisfactory": return "#ca8a04";
    case "Fair": return "#ea580c";
    case "Poor": return "#dc2626";
    case "Very Poor": return "#991b1b";
    case "Serious": return "#7f1d1d";
    case "Failed": return "#450a0a";
    default: return "#374151";
  }
}

function PdfLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={s.brandRow}>
      <Svg width={compact ? 24 : 32} height={compact ? 24 : 32} viewBox="0 0 36 36">
        <Rect x="1" y="1" width="34" height="34" rx="8" fill="#111214" stroke="#e5e7eb" strokeWidth="0.8" />
        <Rect x="10" y="7.5" width="15" height="21" rx="6" fill="none" stroke="#f8fafc" strokeWidth="2" />
        <Line x1="18.4" y1="9.4" x2="18.4" y2="26.6" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
        <Line x1="18.4" y1="13.6" x2="18.4" y2="15.8" stroke="#111214" strokeWidth="0.9" strokeLinecap="round" />
        <Line x1="18.4" y1="20.1" x2="18.4" y2="22.3" stroke="#111214" strokeWidth="0.9" strokeLinecap="round" />
      </Svg>
      <Text style={compact ? s.brandSmall : s.brand}>Drisora</Text>
    </View>
  );
}

function formatGps(frame: FrameResult) {
  if (frame.lat == null || frame.lon == null) return "N/A";
  return `${frame.lat.toFixed(5)}, ${frame.lon.toFixed(5)}`;
}

function crackSummary(frame: FrameResult) {
  const count = Math.max(
    frame.final_detection_count ?? 0,
    frame.yolo_detection_count ?? 0,
    frame.crack_types.length,
    frame.max_crack_width_mm != null || frame.avg_crack_width_mm != null ? 1 : 0,
  );
  const types = frame.crack_types.length > 0 ? frame.crack_types.join(", ") : "None";
  return `${types}${count > 0 ? ` (${count})` : ""}`;
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
  const start = gpsFrames[0] ?? null;
  const end = gpsFrames.at(-1) ?? null;
  const worst = frames.reduce<FrameResult | null>(
    (current, frame) => (!current || frame.pci_score < current.pci_score ? frame : current),
    null,
  );
  const maxWidth = frames
    .map((frame) => frame.max_crack_width_mm ?? frame.avg_crack_width_mm)
    .filter((value): value is number => value != null)
    .sort((a, b) => b - a)[0] ?? null;
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
      <PdfLogo compact />
      <Text style={[s.kicker, { marginTop: 8 }]}>Geospatial assessment</Text>
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
        <View style={s.kpi}>
          <Text style={[s.kpiValue, { color: maxWidth == null ? C.dark : crackWidthColor(maxWidth) }]}>{maxWidth == null ? "N/A" : `${maxWidth.toFixed(1)}`}</Text>
          <Text style={s.kpiLabel}>Max crack width mm</Text>
        </View>
      </View>

      <View style={[s.mapDark, { marginTop: 14 }]}>
        {bounds ? (
          <Svg width="500" height="310" viewBox="0 0 500 310">
            <Rect x="0" y="0" width="500" height="310" fill="#0b0c0d" />
            {Array.from({ length: 8 }).map((_, index) => (
              <Line key={`h-${index}`} x1="0" y1={30 + index * 35} x2="500" y2={30 + index * 35} stroke="#1f2937" strokeWidth="0.7" />
            ))}
            {Array.from({ length: 10 }).map((_, index) => (
              <Line key={`v-${index}`} x1={30 + index * 48} y1="0" x2={30 + index * 48} y2="310" stroke="#1f2937" strokeWidth="0.7" />
            ))}
            <Rect x="12" y="12" width="476" height="286" rx="10" fill="none" stroke="#334155" strokeWidth="1" />
            <Line x1="450" y1="34" x2="450" y2="64" stroke="#f8fafc" strokeWidth="1.4" />
            <Line x1="450" y1="34" x2="444" y2="44" stroke="#f8fafc" strokeWidth="1.4" />
            <Line x1="450" y1="34" x2="456" y2="44" stroke="#f8fafc" strokeWidth="1.4" />
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
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              );
            })}
            {gpsFrames.map((frame) => {
              const point = mapPoint(frame, bounds);
              const widthValue = frame.max_crack_width_mm ?? frame.avg_crack_width_mm;
              return (
                <Circle
                  key={frame.stem}
                  cx={point.x}
                  cy={point.y}
                  r="4.6"
                  fill={crackWidthColor(widthValue)}
                  stroke="#ffffff"
                  strokeWidth="0.8"
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
      <View style={s.legend}>
        {CRACK_WIDTH_BANDS.map((band) => (
          <View key={band.label} style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: band.color }]} />
            <Text style={s.small}>Width {band.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.mapCaptionGrid}>
        <View style={s.mapCaption}>
          <Text style={s.metaLabel}>Start GPS</Text>
          <Text style={s.metaValue}>{start ? formatGps(start) : "N/A"}</Text>
        </View>
        <View style={s.mapCaption}>
          <Text style={s.metaLabel}>End GPS</Text>
          <Text style={s.metaValue}>{end ? formatGps(end) : "N/A"}</Text>
        </View>
        <View style={s.mapCaption}>
          <Text style={s.metaLabel}>Worst section</Text>
          <Text style={[s.metaValue, { color: worst ? getPciBand(worst.pci_score).color : C.dark }]}>
            {worst ? `#${worst.index + 1} PCI ${worst.pci_score.toFixed(0)}` : "N/A"}
          </Text>
        </View>
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
      <PdfLogo compact />
      <Text style={[s.kicker, { marginTop: 8 }]}>Section schedule</Text>
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
          <Text style={[s.th, s.colWidth]}>Max Width mm</Text>
          <Text style={[s.th, s.colWidth]}>Avg Width mm</Text>
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
            crackCount: frame.final_detection_count ?? frame.yolo_detection_count ?? frame.crack_types.length,
            sectionLengthM: 10,
          });
          return (
            <View key={frame.stem} style={s.row}>
              <Text style={[s.td, s.colSection]}>{pageIndex * ROWS_PER_PAGE + index + 1}</Text>
              <Text style={[s.td, s.colGps]}>{formatGps(frame)}</Text>
              <Text style={[s.td, s.colPci, { color: getPciBand(frame.pci_score).color, fontWeight: 700 }]}>
                {frame.pci_score.toFixed(0)}
              </Text>
              <Text style={[s.td, s.colCracks]}>{crackSummary(frame)}</Text>
              <Text style={[s.td, s.colWidth]}>
                {frame.max_crack_width_mm == null ? "N/A" : `${frame.max_crack_width_mm.toFixed(1)}${frame.crack_metrics_estimated ? " est." : ""}`}
              </Text>
              <Text style={[s.td, s.colWidth]}>
                {frame.avg_crack_width_mm == null ? "N/A" : `${frame.avg_crack_width_mm.toFixed(1)}${frame.crack_metrics_estimated ? " est." : ""}`}
              </Text>
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

function PciSegmentPage({
  segments,
  surveySummary,
  jobId,
  pageIndex,
  pageCount,
}: {
  segments: PciSegmentData[];
  surveySummary: Props["surveySummary"];
  jobId: string;
  pageIndex: number;
  pageCount: number;
}) {
  return (
    <Page size="A4" style={s.page}>
      <PdfLogo compact />
      <Text style={[s.kicker, { marginTop: 8 }]}>IRC:82-2023 PCI Segment Schedule</Text>
      <Text style={s.h2}>PCI Segment Schedule</Text>
      {surveySummary && (
        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <Text style={[s.kpiValue, { color: pciGradeColor(null) }]}>{surveySummary.weighted_pci.toFixed(1)}</Text>
            <Text style={s.kpiLabel}>Weighted PCI</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiValue}>{formatLength(surveySummary.total_length_m)}</Text>
            <Text style={s.kpiLabel}>Total length</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiValue}>{surveySummary.segment_count}</Text>
            <Text style={s.kpiLabel}>Segments</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiValue}>{surveySummary.rpci_segment_count}</Text>
            <Text style={s.kpiLabel}>RPCI segments</Text>
          </View>
        </View>
      )}
      <Text style={[s.small, { marginBottom: 8, marginTop: surveySummary ? 8 : 0 }]}>
        Segment table. Page {pageIndex + 1} of {pageCount}.
      </Text>
      <View style={s.table}>
        <View style={s.row} fixed>
          <Text style={[s.th, { width: "7%" }]}>Seg #</Text>
          <Text style={[s.th, { width: "18%" }]}>Distance Range</Text>
          <Text style={[s.th, { width: "10%" }]}>Coverage</Text>
          <Text style={[s.th, { width: "10%" }]}>PCI Score</Text>
          <Text style={[s.th, { width: "12%" }]}>Grade</Text>
          <Text style={[s.th, { width: "15%" }]}>Status</Text>
          <Text style={[s.th, { width: "10%" }]}>Detections</Text>
        </View>
        {segments.map((seg) => {
          const color = pciGradeColor(seg.pci_grade);
          return (
            <View key={seg.segment_index} style={s.row}>
              <Text style={[s.td, { width: "7%" }]}>{seg.segment_index + 1}</Text>
              <Text style={[s.td, { width: "18%" }]}>
                {seg.start_distance_m.toFixed(0)}m – {seg.end_distance_m.toFixed(0)}m
              </Text>
              <Text style={[s.td, { width: "10%" }]}>{seg.total_length_m.toFixed(0)}m</Text>
              <Text style={[s.td, { width: "10%", color, fontWeight: 700 }]}>
                {seg.pci_score == null ? "N/A" : seg.pci_score.toFixed(1)}
              </Text>
              <Text style={[s.td, { width: "12%", color }]}>{seg.pci_grade ?? "N/A"}</Text>
              <Text style={[s.td, { width: "15%" }]}>{seg.is_relative ? "RPCI *" : "Standard"}</Text>
              <Text style={[s.td, { width: "10%" }]}>{seg.detection_count}</Text>
            </View>
          );
        })}
      </View>
      {pageIndex === pageCount - 1 && (
        <Text style={[s.small, { marginTop: 10 }]}>
          * RPCI: Relative PCI computed for road section {"<"} 100m coverage. Not directly comparable to standard IRC:82-2023 PCI values.
        </Text>
      )}
      <Footer jobId={jobId} />
    </Page>
  );
}

function Footer({ jobId }: { jobId: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Drisora - IRC:82-2023</Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages} - Job ${jobId.slice(0, 8)}`}
      />
    </View>
  );
}

export function JobReport({ results, surveyDate, orgName, pciSegments, surveySummary }: Props) {
  const { summary, frames, mode, job_id } = results;
  const avgBand = getPciBand(summary.average_pci);
  const sampledRows = frames.slice(0, MAX_SECTION_ROWS);
  const rowPages = chunks(sampledRows, ROWS_PER_PAGE);
  const crackEntries = Object.entries(summary.crack_type_counts).sort((a, b) => b[1] - a[1]);
  const analyses = frames
    .map((frame) =>
      analyzeDistress({
        crackTypes: frame.crack_types,
        pci: frame.pci_score,
        avgWidthMm: frame.avg_crack_width_mm,
        maxWidthMm: frame.max_crack_width_mm,
        crackCount: frame.final_detection_count ?? frame.yolo_detection_count ?? frame.crack_types.length,
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
        <PdfLogo />
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
          {surveySummary && (
            <View style={s.kpi}>
              <Text style={[s.kpiValue, { color: pciGradeColor(null) }]}>{surveySummary.weighted_pci.toFixed(1)}</Text>
              <Text style={s.kpiLabel}>Weighted PCI</Text>
            </View>
          )}
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
        <PdfLogo compact />
        <Text style={[s.kicker, { marginTop: 8 }]}>Chief engineer brief</Text>
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

      {pciSegments && pciSegments.length > 0 && chunks(pciSegments, ROWS_PER_PAGE).map((segPage, index, all) => (
        <PciSegmentPage
          key={index}
          segments={segPage}
          surveySummary={surveySummary}
          jobId={job_id}
          pageIndex={index}
          pageCount={all.length}
        />
      ))}

      {rowPages.map((rows, index) => (
        <SectionTablePage key={index} rows={rows} pageIndex={index} pageCount={rowPages.length} jobId={job_id} />
      ))}

      <Page size="A4" style={s.page}>
        <PdfLogo compact />
        <Text style={[s.kicker, { marginTop: 8 }]}>Methodology</Text>
        <Text style={s.h2}>Methodology and Accuracy Note</Text>
        <Text style={{ fontSize: 9.5, lineHeight: 1.6, color: C.text }}>
          Drisora processes uploaded imagery or video through AI-powered distress detection, pixel-level mask refinement,
          optional depth estimation for camera-to-surface measurement, and PCI scoring aligned to IRC:82-2023 reporting bands.
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
