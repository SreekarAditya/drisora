import { NextResponse } from "next/server";
import { analyzeDistress } from "@/lib/civil-intelligence";
import { crackTypeLabel } from "@/lib/crack-labels";
import { deriveCrackMetrics } from "@/lib/crack-metrics";
import { createClient } from "@/lib/supabase/server";
import type { RoadSectionFeatureCollection, RoadSectionProperties } from "@/types";

type DetectionRow = {
  section_id: string | null;
  crack_type: string | null;
  avg_width_mm: number | null;
  max_width_mm: number | null;
  length_m: number | null;
};

type SectionFeature = RoadSectionFeatureCollection["features"][number] & {
  properties: RoadSectionProperties & { id?: string | null };
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: survey, error: surveyError } = await supabase
    .from("surveys")
    .select(
      "id, user_id, name, location, engineer_name, surveyed_at, created_at, status, total_length_m, average_pci, coverage_area_m2, report_path",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (surveyError || !survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const sectionsQuery = supabase
    .from("road_sections")
    .select(
      "id, geom, section_index, pci_score, condition_category, recommended_intervention, priority_rank, length_m, avg_crack_width_mm, max_crack_width_mm, crack_length_m_by_type, possible_causes, recommended_mitigation, maintenance_priority, civil_severity",
    )
    .eq("survey_id", id)
    .order("section_index", { ascending: true })
    .geojson();

  const detectionsQuery = supabase
    .from("detections")
    .select("section_id, crack_type, avg_width_mm, max_width_mm, length_m")
    .eq("survey_id", id);

  const [{ data: sectionsGeojson, error: sectionsError }, { data: detections, error: detectionsError }] =
    await Promise.all([sectionsQuery, detectionsQuery]);

  if (sectionsError) {
    return NextResponse.json({ error: sectionsError.message }, { status: 500 });
  }

  if (detectionsError) {
    return NextResponse.json({ error: detectionsError.message }, { status: 500 });
  }

  const summary = new Map<string, {
    count: number;
    types: Set<string>;
    maxWidth: number | null;
    widthSum: number;
    widthCount: number;
    lengths: Record<string, number>;
  }>();
  const detectionsSummary: Record<string, number> = {};

  for (const detection of ((detections ?? []) as DetectionRow[])) {
    if (!detection.section_id) continue;
    const item = summary.get(detection.section_id) ?? {
      count: 0,
      types: new Set<string>(),
      maxWidth: null,
      widthSum: 0,
      widthCount: 0,
      lengths: {},
    };
    item.count += 1;
    if (detection.crack_type) {
      const label = crackTypeLabel(detection.crack_type);
      item.types.add(label);
      detectionsSummary[label] = (detectionsSummary[label] ?? 0) + 1;
      if (detection.length_m != null) {
        item.lengths[label] =
          (item.lengths[label] ?? 0) + detection.length_m;
      }
    }
    const width = detection.max_width_mm ?? detection.avg_width_mm;
    if (width != null) {
      item.maxWidth = item.maxWidth == null ? width : Math.max(item.maxWidth, width);
      item.widthSum += width;
      item.widthCount += 1;
    }
    summary.set(detection.section_id, item);
  }

  const rawCollection = sectionsGeojson as unknown as RoadSectionFeatureCollection | null;
  const geojson: RoadSectionFeatureCollection = {
    type: "FeatureCollection",
    features: (rawCollection?.features ?? []).map((feature) => {
      const sectionFeature = feature as SectionFeature;
      const sectionId = sectionFeature.properties.id ?? "";
      const sectionSummary = summary.get(sectionId) ?? {
        count: 0,
        types: new Set<string>(),
        maxWidth: null,
        widthSum: 0,
        widthCount: 0,
        lengths: {},
      };
      const crackTypes = Array.from(sectionSummary.types).sort();
      const detectionAvgWidth =
        sectionFeature.properties.avg_crack_width_mm ??
        (sectionSummary.widthCount > 0 ? sectionSummary.widthSum / sectionSummary.widthCount : null);
      const detectionMaxWidth = sectionFeature.properties.max_crack_width_mm ?? sectionSummary.maxWidth;
      const metrics = deriveCrackMetrics({
        crackTypes,
        pci: sectionFeature.properties.pci_score,
        avgWidthMm: detectionAvgWidth,
        maxWidthMm: detectionMaxWidth,
        crackTypeLengthsM:
          sectionFeature.properties.crack_length_m_by_type ?? sectionSummary.lengths,
        finalDetectionCount: sectionSummary.count,
        sectionLengthM: sectionFeature.properties.length_m,
      });
      const analysis = analyzeDistress({
        crackTypes,
        pci: sectionFeature.properties.pci_score,
        avgWidthMm: metrics.avgWidthMm,
        maxWidthMm: metrics.maxWidthMm,
        crackCount: metrics.crackCount,
        sectionLengthM: sectionFeature.properties.length_m,
      });

      return {
        type: "Feature",
        geometry: sectionFeature.geometry,
        properties: {
          section_index: sectionFeature.properties.section_index,
          pci_score: sectionFeature.properties.pci_score,
          condition_category: sectionFeature.properties.condition_category,
          recommended_intervention: sectionFeature.properties.recommended_intervention,
          priority_rank: sectionFeature.properties.priority_rank,
          length_m: sectionFeature.properties.length_m,
          crack_count: metrics.hasCracks ? metrics.crackCount : sectionSummary.count,
          crack_types: crackTypes,
          avg_crack_width_mm: metrics.avgWidthMm,
          max_crack_width_mm: metrics.maxWidthMm,
          crack_length_m_by_type: metrics.lengthByTypeM,
          crack_metrics_estimated: metrics.estimated,
          possible_causes: sectionFeature.properties.possible_causes ?? analysis.possibleCauses,
          recommended_mitigation:
            sectionFeature.properties.recommended_mitigation ?? analysis.recommendedMitigation,
          maintenance_priority:
            sectionFeature.properties.maintenance_priority ?? analysis.priority,
          distress_severity:
            sectionFeature.properties.civil_severity ?? analysis.severity,
        },
      };
    }),
  };

  return NextResponse.json({ survey, geojson, detectionsSummary });
}
