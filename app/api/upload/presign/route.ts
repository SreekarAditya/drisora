import { NextResponse } from "next/server";
import { getUploadPartUrl } from "@/lib/r2";
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
    part_numbers?: unknown;
  };
  const { survey_id, upload_id, r2_key, part_numbers } = body;

  if (!survey_id || !upload_id || !r2_key || !Array.isArray(part_numbers)) {
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

  const parts = await Promise.all(
    part_numbers.map(async (partNumber) => {
      if (typeof partNumber !== "number") {
        throw new Error("Invalid part number");
      }

      return {
        part_number: partNumber,
        url: await getUploadPartUrl(r2_key, upload_id, partNumber),
      };
    }),
  );

  return NextResponse.json({ parts });
}
