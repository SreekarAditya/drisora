import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  TOS_VERSION,
  PRIVACY_VERSION,
  meetsAgeFloor,
} from "@/lib/legal/versions";

/**
 * Persists a consent audit record for the authenticated user.
 *
 * The age check is enforced HERE on the server (not just in the UI): a DOB that
 * fails the 18+ floor is rejected with 403 regardless of what the client sent.
 * The IP address is read from request headers, never trusted from the body.
 */
export async function POST(request: Request) {
  let body: {
    dob?: string;
    tos_version?: string;
    pp_version?: string;
    professional_capacity?: boolean;
    training_opt_in?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dob = body.dob ?? "";
  if (!dob) {
    return NextResponse.json({ error: "Date of birth is required" }, { status: 400 });
  }

  // Hard, server-side age gate.
  if (!meetsAgeFloor(dob)) {
    return NextResponse.json(
      { error: "You must be at least 18 years old to use Drisora." },
      { status: 403 }
    );
  }

  if (!body.professional_capacity) {
    return NextResponse.json(
      { error: "Professional-capacity confirmation is required." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]!.trim() : request.headers.get("x-real-ip");

  const now = new Date().toISOString();

  // Append a consent row for the current document versions. The unique index on
  // (user_id, tos_version, pp_version) makes re-submits idempotent.
  const { error } = await supabase.from("consent_records").upsert(
    {
      user_id: user.id,
      dob,
      age_verified: true,
      professional_capacity: true,
      tos_version: body.tos_version ?? TOS_VERSION,
      tos_accepted_at: now,
      pp_version: body.pp_version ?? PRIVACY_VERSION,
      pp_accepted_at: now,
      ip_at_registration: ip,
      training_opt_in: Boolean(body.training_opt_in),
    },
    { onConflict: "user_id,tos_version,pp_version", ignoreDuplicates: true }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
