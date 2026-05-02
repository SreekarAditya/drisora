import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { JobResults, FrameResult } from "@/types";
import { getPciBand, ircRecommendation, JOB_MODE_LABELS } from "@/types";

Font.register({
  family: "IBM Plex Sans",
  fonts: [
    { src: "https://fonts.gstatic.com/s/ibmplexsans/v19/zYXgKVElMYYaJe8bpLHnCwDKjR7_AI5sdP3pBmtF8A.woff2", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/ibmplexsans/v19/zYX9KVElMYYaJe8bpLHnCwDKjQ76AI5sdO_q.woff2", fontWeight: 600 },
  ],
});

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
  page: { backgroundColor: C.bg, fontFamily: "IBM Plex Sans", color: C.text, padding: 48 },
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
