import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadRedisJob, submitProcessingJob } from "@/lib/jobs/submit";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const job = await loadRedisJob(id);

  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status !== "uploading") {
    return NextResponse.json(
      { error: `Job cannot be submitted from ${job.status}` },
      { status: 409 },
    );
  }

  try {
    const submitted = await submitProcessingJob(job);
    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "queued",
        processed_count: 0,
        frame_count: 0,
        error_message: null,
        completed_at: null,
      })
      .eq("id", submitted.job_id)
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      ok: true,
      job_id: submitted.job_id,
      runpod_job_id: submitted.runpod_job_id,
      job: submitted,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "RunPod submission failed";

    await supabase
      .from("jobs")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.job_id)
      .eq("user_id", user.id);

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
