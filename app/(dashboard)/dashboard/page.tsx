import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JobList } from "@/components/dashboard/JobList";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import type { JobRecord } from "@/types";

async function JobListFetcher({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, user_id, mode, status, frame_count, processed_count, gps_available, average_pci, r2_prefix, created_at, completed_at, error_message, deleted_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load jobs: ${error.message}`);
  return <JobList jobs={(jobs ?? []) as JobRecord[]} />;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <JobListFetcher userId={user.id} />
    </Suspense>
  );
}
