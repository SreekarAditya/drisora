import { NextResponse } from "next/server";
import { completeMultipartUpload } from "@/lib/r2";
import { createClient } from "@/lib/supabase/server";

interface CompletedPart {
  part_number: number;
  etag: string;
}

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
    parts?: unknown;
  };
  const { survey_id, upload_id, r2_key, parts } = body;

  if (!survey_id || !upload_id || !r2_key || !Array.isArray(parts)) {
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

  const completedParts = parts as CompletedPart[];
  await completeMultipartUpload(
    r2_key,
    upload_id,
    completedParts.map((part) => ({
      PartNumber: part.part_number,
      ETag: part.etag,
    })),
  );

  const { error: updateError } = await supabase
    .from("surveys")
    .update({ status: "queued" })
    .eq("id", survey_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
