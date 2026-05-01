import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadJobResults } from "@/lib/jobs/results";
import { ImageBatchResults } from "@/components/results/jobs/ImageBatchResults";
import { HandheldVideoResults } from "@/components/results/jobs/HandheldVideoResults";
import { DroneJobResults } from "@/components/results/jobs/DroneJobResults";
import type { JobMode } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function JobResultsPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: job } = await supabase
    .from("jobs")
    .select("id, user_id, mode, status, frame_count, gps_available, created_at, average_pci, r2_prefix")
    .eq("id", id)
    .single();

  if (!job || job.user_id !== user.id) notFound();
  if (job.status !== "complete") redirect(`/jobs/${id}`);

  const results = await loadJobResults(id, user.id, job.mode as JobMode);

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization, full_name")
    .eq("id", user.id)
    .single();

  const orgName = profile?.organization ?? profile?.full_name ?? user.email ?? "Unknown";
  const surveyDate = new Date(job.created_at).toLocaleDateString("en-IN", {
    year: "numeric", month: "long", day: "numeric",
  });

  const sharedProps = { results, jobId: id, surveyDate, orgName };

  if (job.mode === "image_batch") return <ImageBatchResults {...sharedProps} />;
  if (job.mode === "handheld_video") return <HandheldVideoResults {...sharedProps} />;
  if (job.mode === "drone_footage") return <DroneJobResults {...sharedProps} />;

  notFound();
}
