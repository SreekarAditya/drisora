import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JobList } from "@/components/dashboard/JobList";
import type { JobRecord } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, user_id, mode, status, frame_count, processed_count, gps_available, average_pci, r2_prefix, created_at, completed_at, error_message")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load jobs: ${error.message}`);

  return <JobList jobs={(jobs ?? []) as JobRecord[]} />;
}
