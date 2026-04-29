import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Job callback handler is not configured yet" },
    { status: 501 },
  );
}
