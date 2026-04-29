import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const surveyId = request.nextUrl.searchParams.get("survey_id");
  if (!surveyId) {
    return NextResponse.json({ error: "Missing survey_id" }, { status: 400 });
  }

  const { data: survey } = await supabase
    .from("surveys")
    .select("r2_upload_id, r2_key")
    .eq("id", surveyId)
    .eq("user_id", user.id)
    .single();

  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const { data: parts } = await supabase
    .from("upload_parts")
    .select("part_number, etag")
    .eq("survey_id", surveyId)
    .order("part_number");

  return NextResponse.json({
    upload_id: survey.r2_upload_id,
    r2_key: survey.r2_key,
    completed_parts: parts ?? [],
  });
}
