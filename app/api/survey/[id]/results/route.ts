import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { RoadSectionFeatureCollection, RoadSectionProperties } from "@/types";

type DetectionRow = {
  section_id: string | null;
  crack_type: string | null;
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
      "id, geom, section_index, pci_score, condition_category, recommended_intervention, priority_rank, length_m",
    )
    .eq("survey_id", id)
    .order("section_index", { ascending: true })
    .geojson();

  const detectionsQuery = supabase
    .from("detections")
    .select("section_id, crack_type")
    .eq("survey_id", id);

  const [{ data: sectionsGeojson, error: sectionsError }, { data: detections, error: detectionsError }] =
    await Promise.all([sectionsQuery, detectionsQuery]);

  if (sectionsError) {
    return NextResponse.json({ error: sectionsError.message }, { status: 500 });
  }

  if (detectionsError) {
    return NextResponse.json({ error: detectionsError.message }, { status: 500 });
  }

  const summary = new Map<string, { count: number; types: Set<string> }>();
  const detectionsSummary: Record<string, number> = {};

  for (const detection of ((detections ?? []) as DetectionRow[])) {
    if (!detection.section_id) continue;
    const item = summary.get(detection.section_id) ?? { count: 0, types: new Set<string>() };
    item.count += 1;
    if (detection.crack_type) {
      item.types.add(detection.crack_type);
      detectionsSummary[detection.crack_type] = (detectionsSummary[detection.crack_type] ?? 0) + 1;
    }
    summary.set(detection.section_id, item);
  }

  const rawCollection = sectionsGeojson as unknown as RoadSectionFeatureCollection | null;
  const geojson: RoadSectionFeatureCollection = {
    type: "FeatureCollection",
    features: (rawCollection?.features ?? []).map((feature) => {
      const sectionFeature = feature as SectionFeature;
      const sectionId = sectionFeature.properties.id ?? "";
      const sectionSummary = summary.get(sectionId) ?? { count: 0, types: new Set<string>() };

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
          crack_count: sectionSummary.count,
          crack_types: Array.from(sectionSummary.types).sort(),
        },
      };
    }),
  };

  return NextResponse.json({ survey, geojson, detectionsSummary });
}
