import { Document, Line, Page, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { getPciBand, type ProjectRecord } from "@/types";

type LinkedReport = {
  id: string;
  label: string;
  source: "job" | "survey";
  status: string;
  average_pci: number | null;
  created_at: string;
};

const s = StyleSheet.create({
  page: { padding: 42, fontFamily: "Helvetica", color: "#111827", backgroundColor: "#ffffff", fontSize: 9 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  brand: { fontSize: 26, fontWeight: 700 },
  kicker: { marginTop: 6, fontSize: 9, color: "#b45309", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { marginTop: 40, fontSize: 24, fontWeight: 700, lineHeight: 1.2 },
  muted: { color: "#6b7280", lineHeight: 1.5 },
  kpis: { marginTop: 24, flexDirection: "row", gap: 10 },
  kpi: { flex: 1, border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: 10 },
  kpiValue: { fontSize: 18, fontWeight: 700 },
  kpiLabel: { marginTop: 3, fontSize: 7.5, color: "#6b7280" },
  table: { marginTop: 22, borderTop: "1px solid #d1d5db", borderLeft: "1px solid #d1d5db" },
  row: { flexDirection: "row", borderBottom: "1px solid #d1d5db" },
  th: { padding: 6, backgroundColor: "#f3f4f6", fontSize: 8, fontWeight: 700, borderRight: "1px solid #d1d5db" },
  td: { padding: 6, fontSize: 8, borderRight: "1px solid #d1d5db" },
  footer: { position: "absolute", bottom: 24, left: 42, right: 42, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#6b7280" },
});

function PdfLogo() {
  return (
    <View style={s.brandRow}>
      <Svg width="30" height="30" viewBox="0 0 36 36">
        <Rect x="1" y="1" width="34" height="34" rx="8" fill="#111214" stroke="#e5e7eb" strokeWidth="0.8" />
        <Rect x="10" y="7.5" width="15" height="21" rx="6" fill="none" stroke="#f8fafc" strokeWidth="2" />
        <Line x1="18.4" y1="9.4" x2="18.4" y2="26.6" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
      </Svg>
      <Text style={s.brand}>Drisora</Text>
    </View>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ProjectReport({
  project,
  reports,
}: {
  project: ProjectRecord;
  reports: LinkedReport[];
}) {
  const pciValues = reports.map((report) => report.average_pci).filter((value): value is number => value != null);
  const averagePci = pciValues.length > 0 ? pciValues.reduce((sum, value) => sum + value, 0) / pciValues.length : null;
  const band = averagePci == null ? null : getPciBand(averagePci);
  const completed = reports.filter((report) => report.status === "complete").length;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <PdfLogo />
        <Text style={s.kicker}>Combined Project Report</Text>
        <Text style={s.title}>{project.name}</Text>
        <Text style={[s.muted, { marginTop: 8 }]}>
          {[project.road_name, project.corridor, project.location, project.agency].filter(Boolean).join(" - ") || "Project metadata not recorded."}
        </Text>

        <View style={s.kpis}>
          <View style={s.kpi}>
            <Text style={[s.kpiValue, { color: band?.color ?? "#111827" }]}>{averagePci == null ? "N/A" : averagePci.toFixed(1)}</Text>
            <Text style={s.kpiLabel}>Aggregated PCI {band ? `- ${band.label}` : ""}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiValue}>{reports.length}</Text>
            <Text style={s.kpiLabel}>Linked surveys/reports</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiValue}>{completed}</Text>
            <Text style={s.kpiLabel}>Completed reports</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.row}>
            <Text style={[s.th, { width: "33%" }]}>Survey / Report</Text>
            <Text style={[s.th, { width: "14%" }]}>Source</Text>
            <Text style={[s.th, { width: "18%" }]}>Date</Text>
            <Text style={[s.th, { width: "12%" }]}>PCI</Text>
            <Text style={[s.th, { width: "23%" }]}>Status</Text>
          </View>
          {reports.map((report) => {
            const reportBand = report.average_pci == null ? null : getPciBand(report.average_pci);
            return (
              <View key={`${report.source}-${report.id}`} style={s.row}>
                <Text style={[s.td, { width: "33%" }]}>{report.label}</Text>
                <Text style={[s.td, { width: "14%" }]}>{report.source}</Text>
                <Text style={[s.td, { width: "18%" }]}>{formatDate(report.created_at)}</Text>
                <Text style={[s.td, { width: "12%", color: reportBand?.color ?? "#6b7280" }]}>
                  {report.average_pci == null ? "N/A" : report.average_pci.toFixed(1)}
                </Text>
                <Text style={[s.td, { width: "23%" }]}>{report.status}</Text>
              </View>
            );
          })}
        </View>

        <Text style={[s.muted, { marginTop: 22 }]}>
          This combined export is intended for project-level review. Open individual survey reports for section-level crack width,
          possible causes, recommended mitigation, and priority treatment tables.
        </Text>

        <View style={s.footer}>
          <Text style={s.footerText}>Drisora - IRC:82-2023</Text>
          <Text style={s.footerText}>Project {project.id}</Text>
        </View>
      </Page>
    </Document>
  );
}
