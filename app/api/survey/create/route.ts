import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    location?: string;
    engineer_name?: string;
    surveyed_at?: string;
  };
  const { name, location, engineer_name, surveyed_at } = body;

  if (!name || !location || !engineer_name || !surveyed_at) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("surveys")
    .insert({
      user_id: user.id,
      name,
      location,
      engineer_name,
      surveyed_at,
      status: "uploading",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create survey" }, { status: 500 });
  }

  return NextResponse.json({ survey_id: data.id }, { status: 201 });
}
