import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRedisClient } from "@/lib/redis";
import { loadJobResults } from "@/lib/jobs/results";
import { ImageBatchResults } from "@/components/results/jobs/ImageBatchResults";
import { HandheldVideoResults } from "@/components/results/jobs/HandheldVideoResults";
import { DroneJobResults } from "@/components/results/jobs/DroneJobResults";
import { ResultsSkeleton } from "@/components/results/jobs/ResultsSkeleton";
import type { JobMode, ProcessingJobRecord } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function ResultsContent({ id, userId }: { id: string; userId: string }) {
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, user_id, mode, status, frame_count, gps_available, created_at, r2_prefix")
    .eq("id", id)
    .single();

  if (!job || job.user_id !== userId) notFound();
  if (job.status !== "complete") {
    const redis = getRedisClient();
    const raw = await redis.get<string>(`job:${id}`);
    const redisJob = (typeof raw === "string" ? JSON.parse(raw) : raw) as ProcessingJobRecord | null;
    if (!redisJob || redisJob.user_id !== userId || redisJob.status !== "complete") {
      redirect(`/jobs/${id}`);
    }
  }

  const results = await loadJobResults(id, userId, job.mode as JobMode);

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization, full_name")
    .eq("id", userId)
    .single();

  const orgName = profile?.organization ?? profile?.full_name ?? "Unknown";
  const surveyDate = new Date(job.created_at).toLocaleDateString("en-IN", {
    year: "numeric", month: "long", day: "numeric",
  });

  const sharedProps = { results, jobId: id, surveyDate, orgName };

  if (job.mode === "image_batch") return <ImageBatchResults {...sharedProps} />;
  if (job.mode === "handheld_video") return <HandheldVideoResults {...sharedProps} />;
  if (job.mode === "drone_footage") return <DroneJobResults {...sharedProps} />;

  notFound();
}

export default async function JobResultsPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <ResultsContent id={id} userId={user.id} />
    </Suspense>
  );
}
