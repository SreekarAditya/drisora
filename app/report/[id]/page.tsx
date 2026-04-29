import { notFound, redirect } from "next/navigation";
import { verifyReportToken } from "@/lib/report-token";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

type SurveyRow = {
  id: string;
  user_id: string;
  name: string;
  location: string | null;
  engineer_name: string | null;
  surveyed_at: string | null;
  created_at: string;
  total_length_m: number | null;
  average_pci: number | null;
  coverage_area_m2: number | null;
};

type ProfileRow = {
  full_name: string | null;
  organization: string | null;
};

type RoadSectionRow = {
  id: string;
  section_index: number | null;
  pci_score: number | null;
  condition_category: string | null;
  recommended_intervention: string | null;
  priority_rank: number | null;
  length_m: number | null;
};

type DetectionRow = {
  section_id: string | null;
  frame_index: number | null;
  crack_type: string | null;
  severity: string | null;
};

interface ReportData {
  survey: SurveyRow;
  profile: ProfileRow | null;
  sections: RoadSectionRow[];
  detections: DetectionRow[];
}

const CONDITION_LABELS: Record<string, string> = {
  good: "Good",
  satisfactory: "Satisfactory",
  fair: "Fair",
  poor: "Poor",
  very_poor: "Very Poor",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatPci(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return Math.round(value).toString();
}

function conditionLabel(value: string | null | undefined) {
  if (!value) return "Unknown";
  return CONDITION_LABELS[value] ?? value.replaceAll("_", " ");
}

function urgency(rank: number | null) {
  if (rank == null) return "Not ranked";
  if (rank <= 3) return "Immediate";
  if (rank <= 10) return "High";
  if (rank <= 25) return "Medium";
  return "Routine";
}

function averagePci(survey: SurveyRow, sections: RoadSectionRow[]) {
  if (survey.average_pci != null) return survey.average_pci;
  const pciSections = sections.filter((section) => section.pci_score != null);
  if (pciSections.length === 0) return null;
  return pciSections.reduce((sum, section) => sum + (section.pci_score ?? 0), 0) / pciSections.length;
}

function totalLength(survey: SurveyRow, sections: RoadSectionRow[]) {
  return survey.total_length_m ?? sections.reduce((sum, section) => sum + (section.length_m ?? 0), 0);
}

function conditionBreakdown(sections: RoadSectionRow[]) {
  const total = sections.reduce((sum, section) => sum + (section.length_m ?? 0), 0);
  const conditions = ["good", "satisfactory", "fair", "poor", "very_poor"];

  return conditions.map((condition) => {
    const conditionSections = sections.filter((section) => section.condition_category === condition);
    const length = conditionSections.reduce((sum, section) => sum + (section.length_m ?? 0), 0);
    const pciValues = conditionSections
      .map((section) => section.pci_score)
      .filter((value): value is number => value != null);

    return {
      condition,
      sections: conditionSections.length,
      length,
      percent: total > 0 ? (length / total) * 100 : 0,
      averagePci:
        pciValues.length > 0
          ? pciValues.reduce((sum, value) => sum + value, 0) / pciValues.length
          : null,
    };
  });
}

function crackTypeCounts(detections: DetectionRow[]) {
  const counts = new Map<string, number>();
  for (const detection of detections) {
    const crackType = detection.crack_type ?? "Unknown";
    counts.set(crackType, (counts.get(crackType) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([crackType, count]) => ({ crackType, count }))
    .sort((a, b) => b.count - a.count);
}

function crackSeverityCounts(detections: DetectionRow[]) {
  const counts = new Map<string, { crackType: string; severity: string; count: number }>();
  for (const detection of detections) {
    const crackType = detection.crack_type ?? "Unknown";
    const severity = detection.severity ?? "Unknown";
    const key = `${crackType}-${severity}`;
    const item = counts.get(key) ?? { crackType, severity, count: 0 };
    item.count += 1;
    counts.set(key, item);
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

function frameRangeCounts(detections: DetectionRow[]) {
  const counts = new Map<string, number>();
  for (const detection of detections) {
    if (detection.frame_index == null) {
      counts.set("Unknown", (counts.get("Unknown") ?? 0) + 1);
      continue;
    }

    const start = Math.floor(detection.frame_index / 100) * 100;
    const label = `${start}-${start + 99}`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([range, count]) => ({ range, count }))
    .sort((a, b) => {
      if (a.range === "Unknown") return 1;
      if (b.range === "Unknown") return -1;
      return Number(a.range.split("-")[0]) - Number(b.range.split("-")[0]);
    });
}

async function loadReportData(id: string, token: string | string[] | undefined): Promise<ReportData> {
  const tokenValue = Array.isArray(token) ? token[0] : token;
  const hasValidToken = verifyReportToken(tokenValue, id);
  const supabase = hasValidToken ? createServiceRoleClient() : await createClient();

  if (!hasValidToken) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      redirect("/login");
    }

    const { data: ownedSurvey } = await supabase
      .from("surveys")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!ownedSurvey) {
      notFound();
    }
  }

  const { data: survey, error: surveyError } = await supabase
    .from("surveys")
    .select(
      "id, user_id, name, location, engineer_name, surveyed_at, created_at, total_length_m, average_pci, coverage_area_m2",
    )
    .eq("id", id)
    .single();

  if (surveyError || !survey) {
    notFound();
  }

  const [{ data: profile }, { data: sections }, { data: detections }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, organization")
      .eq("id", survey.user_id)
      .maybeSingle(),
    supabase
      .from("road_sections")
      .select("id, section_index, pci_score, condition_category, recommended_intervention, priority_rank, length_m")
      .eq("survey_id", id)
      .order("section_index", { ascending: true }),
    supabase
      .from("detections")
      .select("section_id, frame_index, crack_type, severity")
      .eq("survey_id", id)
      .order("frame_index", { ascending: true }),
  ]);

  return {
    survey: survey as SurveyRow,
    profile: profile as ProfileRow | null,
    sections: (sections ?? []) as RoadSectionRow[],
    detections: (detections ?? []) as DetectionRow[],
  };
}

export default async function PrintableReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  const { survey, profile, sections, detections } = await loadReportData(id, token);
  const generatedAt = new Date();
  const pci = averagePci(survey, sections);
  const length = totalLength(survey, sections);
  const conditionRows = conditionBreakdown(sections);
  const crackRows = crackTypeCounts(detections);
  const severityRows = crackSeverityCounts(detections);
  const frameRows = frameRangeCounts(detections);
  const prioritySections = [...sections]
    .filter((section) => section.priority_rank != null)
    .sort((a, b) => (a.priority_rank ?? Number.MAX_SAFE_INTEGER) - (b.priority_rank ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 10);

  return (
    <main>
      <style>{`
        @page { size: A4; margin: 10mm; }
        * { box-sizing: border-box; }
        body { margin: 0; background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; }
        main { background: #fff; color: #111; font-size: 12px; line-height: 1.45; }
        h1, h2, h3, p { margin: 0; }
        h1 { font-size: 34px; letter-spacing: -0.02em; }
        h2 { font-size: 22px; margin-bottom: 16px; }
        h3 { font-size: 15px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
        th { background: #f3f4f6; text-align: left; font-weight: 700; }
        th, td { border: 1px solid #d1d5db; padding: 7px 8px; vertical-align: top; }
        tr { page-break-inside: avoid; page-break-after: auto; }
        .page { min-height: 267mm; padding: 6mm 2mm; page-break-after: always; }
        .section { page-break-before: always; padding: 6mm 2mm; }
        .brand { display: flex; align-items: center; gap: 10px; color: #111; font-weight: 800; font-size: 28px; }
        .mark { width: 34px; height: 34px; border-radius: 7px; background: #f59e0b; display: inline-block; }
        .cover { display: flex; min-height: 252mm; flex-direction: column; justify-content: space-between; }
        .cover-grid { display: grid; grid-template-columns: 1fr 170px; gap: 28px; align-items: center; }
        .muted { color: #555; }
        .kicker { color: #92400e; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
        .pci-badge { width: 150px; height: 150px; border: 8px solid #f59e0b; border-radius: 999px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .pci-score { font-size: 46px; font-weight: 800; }
        .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 24px; margin-top: 26px; }
        .meta-label { color: #555; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
        .meta-value { margin-top: 2px; font-size: 14px; font-weight: 700; }
        .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
        .metric { border: 1px solid #d1d5db; padding: 14px; }
        .metric-value { font-size: 24px; font-weight: 800; }
        .map-placeholder { height: 135mm; border: 2px dashed #9ca3af; background: linear-gradient(135deg, #f9fafb 25%, #f3f4f6 25%, #f3f4f6 50%, #f9fafb 50%, #f9fafb 75%, #f3f4f6 75%); background-size: 28px 28px; display: flex; align-items: center; justify-content: center; text-align: center; color: #555; }
        .legend { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 14px; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; }
        .swatch { width: 16px; height: 16px; border-radius: 3px; display: inline-block; }
        .footer-note { color: #555; font-size: 10px; }
      `}</style>

      <section className="page cover">
        <div>
          <div className="brand">
            <span className="mark" />
            Drisora
          </div>

          <div className="cover-grid" style={{ marginTop: "54mm" }}>
            <div>
              <p className="kicker">Pavement Condition Survey Report</p>
              <h1 style={{ marginTop: 10 }}>{survey.name}</h1>
              <p className="muted" style={{ marginTop: 10, fontSize: 16 }}>
                {survey.location ?? "Location not recorded"}
              </p>
            </div>
            <div className="pci-badge">
              <div className="pci-score">{formatPci(pci)}</div>
              <div className="muted">Overall PCI</div>
            </div>
          </div>

          <div className="meta">
            <div>
              <div className="meta-label">Engineer</div>
              <div className="meta-value">{survey.engineer_name ?? profile?.full_name ?? "Not recorded"}</div>
            </div>
            <div>
              <div className="meta-label">Organization</div>
              <div className="meta-value">{profile?.organization ?? "Not recorded"}</div>
            </div>
            <div>
              <div className="meta-label">Survey Date</div>
              <div className="meta-value">{formatDate(survey.surveyed_at ?? survey.created_at)}</div>
            </div>
            <div>
              <div className="meta-label">Generated Date</div>
              <div className="meta-value">{formatDate(generatedAt.toISOString())}</div>
            </div>
          </div>
        </div>

        <p className="footer-note">
          Generated by Drisora from uploaded road survey data, section scoring, and crack detections.
        </p>
      </section>

      <section className="section">
        <h2>2. Executive Summary</h2>
        <div className="metric-grid">
          <div className="metric">
            <div className="muted">Total road length surveyed</div>
            <div className="metric-value">{formatNumber(length)} m</div>
          </div>
          <div className="metric">
            <div className="muted">Average PCI score</div>
            <div className="metric-value">{formatPci(pci)}</div>
          </div>
          <div className="metric">
            <div className="muted">Total detections</div>
            <div className="metric-value">{detections.length}</div>
          </div>
        </div>

        <h3>Condition Breakdown</h3>
        <table>
          <thead>
            <tr>
              <th>Condition</th>
              <th>Sections</th>
              <th>Length (m)</th>
              <th>% of Road</th>
              <th>Avg PCI</th>
            </tr>
          </thead>
          <tbody>
            {conditionRows.map((row) => (
              <tr key={row.condition}>
                <td>{conditionLabel(row.condition)}</td>
                <td>{row.sections}</td>
                <td>{formatNumber(row.length)}</td>
                <td>{formatNumber(row.percent)}%</td>
                <td>{formatPci(row.averagePci)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 style={{ marginTop: 18 }}>Detections by Crack Type</h3>
        <table>
          <thead>
            <tr>
              <th>Crack Type</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {crackRows.map((row) => (
              <tr key={row.crackType}>
                <td>{row.crackType}</td>
                <td>{row.count}</td>
              </tr>
            ))}
            {crackRows.length === 0 && (
              <tr>
                <td colSpan={2}>No detections recorded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="section">
        <h2>3. Road Condition Map</h2>
        <div className="map-placeholder">
          Static map placeholder
          <br />
          Interactive Leaflet map is intentionally omitted from PDF rendering.
        </div>
        <div className="legend">
          {[
            ["85-100", "#22c55e"],
            ["70-84", "#eab308"],
            ["55-69", "#f97316"],
            ["40-54", "#ef4444"],
            ["0-39", "#7f1d1d"],
          ].map(([label, color]) => (
            <div className="legend-item" key={label}>
              <span className="swatch" style={{ background: color }} />
              PCI {label}
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>4. PCI Scores by Section</h2>
        <table>
          <thead>
            <tr>
              <th>Section</th>
              <th>Length (m)</th>
              <th>PCI</th>
              <th>Condition</th>
              <th>Intervention</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <tr key={section.id}>
                <td>{section.section_index ?? "N/A"}</td>
                <td>{formatNumber(section.length_m)}</td>
                <td>{formatPci(section.pci_score)}</td>
                <td>{conditionLabel(section.condition_category)}</td>
                <td>{section.recommended_intervention ?? "Not assigned"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section">
        <h2>5. Priority Intervention Matrix</h2>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Section</th>
              <th>PCI</th>
              <th>Condition</th>
              <th>Recommended Intervention</th>
              <th>Estimated Urgency</th>
            </tr>
          </thead>
          <tbody>
            {prioritySections.map((section) => (
              <tr key={section.id}>
                <td>{section.priority_rank}</td>
                <td>{section.section_index ?? "N/A"}</td>
                <td>{formatPci(section.pci_score)}</td>
                <td>{conditionLabel(section.condition_category)}</td>
                <td>{section.recommended_intervention ?? "Not assigned"}</td>
                <td>{urgency(section.priority_rank)}</td>
              </tr>
            ))}
            {prioritySections.length === 0 && (
              <tr>
                <td colSpan={6}>No priority-ranked sections recorded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="section">
        <h2>6. Crack Detection Data</h2>
        <table>
          <thead>
            <tr>
              <th>Crack Type</th>
              <th>Severity</th>
              <th>Count</th>
              <th>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {severityRows.map((row) => (
              <tr key={`${row.crackType}-${row.severity}`}>
                <td>{row.crackType}</td>
                <td>{row.severity}</td>
                <td>{row.count}</td>
                <td>{detections.length > 0 ? formatNumber((row.count / detections.length) * 100) : "0.0"}%</td>
              </tr>
            ))}
            {severityRows.length === 0 && (
              <tr>
                <td colSpan={4}>No crack detection data recorded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="section">
        <h2>Appendix. Raw Detection Count by Frame Range</h2>
        <table>
          <thead>
            <tr>
              <th>Frame Range</th>
              <th>Detection Count</th>
            </tr>
          </thead>
          <tbody>
            {frameRows.map((row) => (
              <tr key={row.range}>
                <td>{row.range}</td>
                <td>{row.count}</td>
              </tr>
            ))}
            {frameRows.length === 0 && (
              <tr>
                <td colSpan={2}>No frame-level detections recorded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
