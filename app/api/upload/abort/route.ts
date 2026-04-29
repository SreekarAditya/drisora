import { NextResponse } from "next/server";
import { abortMultipartUpload } from "@/lib/r2";
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

  const body = (await request.json()) as {
    survey_id?: string;
    upload_id?: string;
    r2_key?: string;
  };
  const { survey_id, upload_id, r2_key } = body;

  if (!survey_id || !upload_id || !r2_key) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: survey } = await supabase
    .from("surveys")
    .select("id")
    .eq("id", survey_id)
    .eq("user_id", user.id)
    .single();

  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  await abortMultipartUpload(r2_key, upload_id);
  await supabase.from("surveys").update({ status: "failed" }).eq("id", survey_id);

  return NextResponse.json({ success: true });
}
