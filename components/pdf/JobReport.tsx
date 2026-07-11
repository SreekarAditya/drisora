import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { JOB_MODE_LABELS } from "@/types";
import type { JobResults, PartialPciSection } from "@/types";

const SCOPE =
  "Partial IRC:82-2023 PCI assessment: 2 of 6 functional parameters instrumented (cracking extent, pothole number; 28% of composite weight). Roughness, ravelling, patching, and rut depth require instrumented survey (ARSS/NSV or manual per IRC:82-2023 Appendix-1) and are not measured. PCI reported as bounds, not a point estimate.";

const s = StyleSheet.create({
  page: { padding: 38, fontFamily: "Helvetica", color: "#111827", backgroundColor: "#ffffff", fontSize: 9 },
  brand: { fontSize: 24, fontWeight: 700 },
  kicker: { marginTop: 5, fontSize: 8, color: "#b45309", letterSpacing: 1.4, textTransform: "uppercase" },
  title: { marginTop: 34, fontSize: 24, fontWeight: 700 },
  muted: { color: "#6b7280", lineHeight: 1.45 },
  scope: { marginTop: 18, border: "1px solid #f59e0b", backgroundColor: "#fffbeb", padding: 12, color: "#78350f", lineHeight: 1.5 },
  kpis: { marginTop: 18, flexDirection: "row", gap: 8 },
  kpi: { flex: 1, border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: 10 },
  kpiValue: { fontSize: 16, fontWeight: 700 },
  kpiLabel: { marginTop: 3, fontSize: 7, color: "#6b7280" },
  h2: { marginTop: 20, marginBottom: 8, fontSize: 14, fontWeight: 700 },
  table: { borderTop: "1px solid #d1d5db", borderLeft: "1px solid #d1d5db" },
  row: { flexDirection: "row", borderBottom: "1px solid #d1d5db" },
  th: { padding: 5, backgroundColor: "#f3f4f6", borderRight: "1px solid #d1d5db", fontSize: 7, fontWeight: 700 },
  td: { padding: 5, borderRight: "1px solid #d1d5db", fontSize: 7, lineHeight: 1.3 },
  footer: { position: "absolute", left: 38, right: 38, bottom: 20, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#6b7280" },
});

interface Props { results: JobResults; surveyDate: string; orgName: string }

export function JobReport({ results, surveyDate, orgName }: Props) {
  const bounds = results.summary.pci_bounds;
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>Drisora</Text>
        <Text style={s.kicker}>Evidence and partial PCI bounds report</Text>
        <Text style={s.title}>{JOB_MODE_LABELS[results.mode]}</Text>
        <Text style={[s.muted, { marginTop: 8 }]}>{surveyDate} · {orgName}</Text>
        <Text style={s.scope}>{SCOPE}</Text>

        <View style={s.kpis}>
          <Kpi value={bounds ? `${bounds.lower.toFixed(1)}–${bounds.upper.toFixed(1)}` : "Not computed"} label="PCI bounds (never a point score)" />
          <Kpi value={`${Math.round(results.summary.measured_weight_fraction * 100)}%`} label="Composite weight instrumented" />
          <Kpi value={String(results.summary.segment_count)} label="GPS-chainage sections" />
          <Kpi value={String(results.summary.frame_count)} label="Evidence frames" />
        </View>

        <Text style={s.h2}>Section measurements</Text>
        {results.sections.length ? <SectionTable sections={results.sections} /> : (
          <Text style={s.muted}>No calibrated GPS-chainage section assessment was produced. This job remains detection-only.</Text>
        )}

        <Text style={s.h2}>Measurement contract</Text>
        <Text style={s.muted}>
          Cracking extent and pothole number are derived only for drone sections with relative AGL telemetry, explicit camera calibration and uncertainty, explicit carriageway width, successful YOLO and SAM2 inference, and georeferenced cross-frame deduplication. Zero trained detections is recorded as detector evidence; it does not imply PCI 100. Relative monocular depth is not converted to rut depth, IRI, crack width, or metric scale.
        </Text>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Drisora · partial IRC:82-2023 assessment</Text>
          <Text style={s.footerText}>Job {results.job_id}</Text>
        </View>
      </Page>
    </Document>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return <View style={s.kpi}><Text style={s.kpiValue}>{value}</Text><Text style={s.kpiLabel}>{label}</Text></View>;
}

function SectionTable({ sections }: { sections: PartialPciSection[] }) {
  return (
    <View style={s.table}>
      <View style={s.row} fixed>
        <Text style={[s.th, { width: "12%" }]}>Section</Text>
        <Text style={[s.th, { width: "20%" }]}>Chainage</Text>
        <Text style={[s.th, { width: "18%" }]}>PCI bounds</Text>
        <Text style={[s.th, { width: "18%" }]}>Cracking %</Text>
        <Text style={[s.th, { width: "16%" }]}>Pothole no.</Text>
        <Text style={[s.th, { width: "16%" }]}>Raw / unique</Text>
      </View>
      {sections.map((section) => {
        const crack = section.assessment?.measured?.cracking?.extent_pct;
        const pothole = section.assessment?.measured?.pothole?.number;
        return (
          <View key={section.section_id} style={s.row} wrap={false}>
            <Text style={[s.td, { width: "12%" }]}>{section.section_id}{section.is_relative ? "*" : ""}</Text>
            <Text style={[s.td, { width: "20%" }]}>{section.start_distance_m.toFixed(0)}–{section.end_distance_m.toFixed(0)} m</Text>
            <Text style={[s.td, { width: "18%" }]}>{section.pci_bounds.lower.toFixed(1)}–{section.pci_bounds.upper.toFixed(1)}</Text>
            <Text style={[s.td, { width: "18%" }]}>{crack == null ? "—" : crack.toFixed(3)}</Text>
            <Text style={[s.td, { width: "16%" }]}>{pothole == null ? "—" : pothole.toFixed(2)}</Text>
            <Text style={[s.td, { width: "16%" }]}>{section.raw_detection_count} / {section.unique_detection_count}</Text>
          </View>
        );
      })}
    </View>
  );
}
