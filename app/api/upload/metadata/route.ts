import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const surveyId = form.get("survey_id");
  const file = form.get("file");

  if (typeof surveyId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing survey_id or file" }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".srt")) {
    return NextResponse.json({ error: "File must have .srt extension" }, { status: 400 });
  }

  const { data: survey } = await supabase
    .from("surveys")
    .select("id")
    .eq("id", surveyId)
    .eq("user_id", user.id)
    .single();

  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const srtPath = `${user.id}/${surveyId}/${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("survey-srt")
    .upload(srtPath, await file.arrayBuffer(), {
      contentType: "application/x-subrip",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("surveys")
    .update({ srt_path: srtPath })
    .eq("id", surveyId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ srt_path: srtPath });
}
