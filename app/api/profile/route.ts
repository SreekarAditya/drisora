import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_ROLES = new Set([
  "PWD Engineer",
  "Municipal Corporation",
  "College Infrastructure Team",
  "Private Contractor",
  "Other",
]);

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const role = nullableText(body.role);
  if (role && !VALID_ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      user_id: user.id,
      full_name: nullableText(body.full_name),
      org_name: nullableText(body.org_name),
      organization: nullableText(body.org_name),
      role,
      phone: nullableText(body.phone),
      avatar_url: nullableText(body.avatar_url),
      notifications_enabled: body.notifications_enabled === true,
    })
    .select("full_name, org_name, role, phone, avatar_url, notifications_enabled")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update profile" },
      { status: 500 },
    );
  }

  return NextResponse.json({ profile: data });
}
