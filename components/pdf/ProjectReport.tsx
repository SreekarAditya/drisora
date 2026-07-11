import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ProjectRecord } from "@/types";

type LinkedReport = { id: string; label: string; source: "job" | "survey"; status: string; created_at: string };

const s = StyleSheet.create({
  page: { padding: 42, fontFamily: "Helvetica", color: "#111827", fontSize: 9 },
  brand: { fontSize: 26, fontWeight: 700 },
  kicker: { marginTop: 6, fontSize: 9, color: "#b45309", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { marginTop: 40, fontSize: 24, fontWeight: 700 },
  muted: { color: "#6b7280", lineHeight: 1.5 },
  notice: { marginTop: 20, padding: 12, border: "1px solid #f59e0b", backgroundColor: "#fffbeb", lineHeight: 1.5 },
  table: { marginTop: 22, borderTop: "1px solid #d1d5db", borderLeft: "1px solid #d1d5db" },
  row: { flexDirection: "row", borderBottom: "1px solid #d1d5db" },
  th: { padding: 6, backgroundColor: "#f3f4f6", fontSize: 8, fontWeight: 700, borderRight: "1px solid #d1d5db" },
  td: { padding: 6, fontSize: 8, borderRight: "1px solid #d1d5db" },
});

export function ProjectReport({ project, reports }: { project: ProjectRecord; reports: LinkedReport[] }) {
  return (
    <Document><Page size="A4" style={s.page}>
      <Text style={s.brand}>Drisora</Text>
      <Text style={s.kicker}>Combined project evidence index</Text>
      <Text style={s.title}>{project.name}</Text>
      <Text style={[s.muted, { marginTop: 8 }]}>{[project.road_name, project.corridor, project.location, project.agency].filter(Boolean).join(" · ") || "Project metadata not recorded."}</Text>
      <Text style={s.notice}>Project-level averaging of legacy point PCI values is disabled. Open each current job report for calibrated section bounds and its measurement provenance. Legacy survey rows remain evidence references only.</Text>
      <View style={s.table}>
        <View style={s.row}><Text style={[s.th, { width: "38%" }]}>Survey / report</Text><Text style={[s.th, { width: "16%" }]}>Source</Text><Text style={[s.th, { width: "22%" }]}>Date</Text><Text style={[s.th, { width: "24%" }]}>Status</Text></View>
        {reports.map((report) => <View key={`${report.source}-${report.id}`} style={s.row}><Text style={[s.td, { width: "38%" }]}>{report.label}</Text><Text style={[s.td, { width: "16%" }]}>{report.source}</Text><Text style={[s.td, { width: "22%" }]}>{new Date(report.created_at).toLocaleDateString("en-IN")}</Text><Text style={[s.td, { width: "24%" }]}>{report.status}</Text></View>)}
      </View>
    </Page></Document>
  );
}
