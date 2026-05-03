import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ProjectBody {
  name?: string;
  road_name?: string | null;
  package_code?: string | null;
  agency?: string | null;
  corridor?: string | null;
  location?: string | null;
  description?: string | null;
  start_chainage_km?: number | null;
  end_chainage_km?: number | null;
}

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function nullableNumber(value: unknown) {
  if (value === "" || value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ProjectBody;
  try {
    body = (await request.json()) as ProjectBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = nullableText(body.name);
  if (!name) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name,
      road_name: nullableText(body.road_name),
      package_code: nullableText(body.package_code),
      agency: nullableText(body.agency),
      corridor: nullableText(body.corridor),
      location: nullableText(body.location),
      description: nullableText(body.description),
      start_chainage_km: nullableNumber(body.start_chainage_km),
      end_chainage_km: nullableNumber(body.end_chainage_km),
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create project" },
      { status: 500 },
    );
  }

  return NextResponse.json({ project: data }, { status: 201 });
}
