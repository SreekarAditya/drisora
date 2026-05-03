import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function nullableNumber(value: unknown) {
  if (value === "" || value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const update = {
    name: nullableText(body.name),
    road_name: nullableText(body.road_name),
    package_code: nullableText(body.package_code),
    agency: nullableText(body.agency),
    corridor: nullableText(body.corridor),
    location: nullableText(body.location),
    description: nullableText(body.description),
    start_chainage_km: nullableNumber(body.start_chainage_km),
    end_chainage_km: nullableNumber(body.end_chainage_km),
    updated_at: new Date().toISOString(),
  };

  if (!update.name) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Project not found" },
      { status: error ? 500 : 404 },
    );
  }

  return NextResponse.json({ project: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
