import { NextResponse } from "next/server";
import { createMultipartUpload } from "@/lib/r2";
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
    filename?: string;
    content_type?: string;
  };
  const { survey_id, filename, content_type } = body;

  if (!survey_id || !filename || !content_type) {
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

  const r2_key = `surveys/${survey_id}/${filename}`;
  const result = await createMultipartUpload(r2_key, content_type);
  const upload_id = result.UploadId;

  if (!upload_id) {
    return NextResponse.json({ error: "Failed to create multipart upload" }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("surveys")
    .update({ r2_key, r2_upload_id: upload_id })
    .eq("id", survey_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ upload_id, r2_key });
}
