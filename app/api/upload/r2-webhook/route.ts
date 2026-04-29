import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "R2 webhook handler is not configured yet" },
    { status: 501 },
  );
}
