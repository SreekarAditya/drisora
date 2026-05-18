import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Legacy survey ingest is retired. Use /api/jobs/create, /api/upload/presign, and /api/jobs/[id]/submit for drone and multi-video jobs.",
    },
    { status: 410 },
  );
}
